import os
import sys
import cv2
import time
from ultralytics import YOLO
from dotenv import load_dotenv
import easyocr
from collections import deque

from backend_api import update_camera_status, send_violation_to_backend, fetch_settings_from_backend
from ocr import read_plate_text
from detection import filter_overlapping_boxes


def main():
    load_dotenv()

    print(f"Python executable: {sys.executable}")
    print(f"Current directory: {os.getcwd()}")
    print("-" * 60)

    rtsp_ip   = os.getenv('RTSP_IP')
    rtsp_user = os.getenv('RTSP_USER')
    rtsp_pass = os.getenv('RTSP_PASS')
    stream    = os.getenv('STREAM', 'stream2')
    camera_id = int(os.getenv('CAMERA_ID', '2'))

    # ← UPDATED: now returns 4 values
    conf_threshold, send_cooldown, _, ocr_conf = fetch_settings_from_backend()

    if not all([rtsp_ip, rtsp_user, rtsp_pass]):
        print("ERROR: Missing RTSP credentials in .env file")
        return

    rtsp_url = f"rtsp://{rtsp_user}:{rtsp_pass}@{rtsp_ip}:554/{stream}"
    print(f"Stream         : {stream}")
    print(f"Camera ID      : {camera_id}")
    print(f"Conf threshold : {conf_threshold}")
    print(f"Send cooldown  : {send_cooldown}s")
    print("-" * 60)

    model_path = os.path.join('weights', 'v8.pt')
    if not os.path.exists(model_path):
        print(f"ERROR: Model not found at {model_path}")
        return

    print(f"Loading YOLO model from: {model_path}")
    model = YOLO(model_path)
    print(f"Model loaded! Classes: {model.names}")
    print("-" * 60)

    print("Loading EasyOCR...")
    use_gpu = os.getenv("EASYOCR_GPU", "1") == "1"
    reader = easyocr.Reader(["en"], gpu=use_gpu)
    print(f"EasyOCR loaded! (gpu={use_gpu})")
    print("-" * 60)

    print("Connecting to RTSP stream...")
    cap = cv2.VideoCapture(rtsp_url)

    if not cap.isOpened():
        print("ERROR: Failed to connect to RTSP stream")
        update_camera_status(camera_id, 'inactive', rtsp_url)
        return

    ret, frame = cap.read()
    if not ret:
        print("ERROR: Connected but failed to read frame")
        cap.release()
        update_camera_status(camera_id, 'inactive', rtsp_url)
        return

    print(f"✓ Connected! Frame size: {frame.shape[1]}x{frame.shape[0]}")
    print("-" * 60)
    cap.release()

    update_camera_status(camera_id, 'active', rtsp_url)

    last_heartbeat     = time.time()
    heartbeat_interval = int(os.getenv('HEARTBEAT_SECONDS', '2'))
    last_sent          = {}

    VIOLATION_CLASSES = ['no_helmet', 'nutshell']
    COMPLIANT_CLASSES = ['helmet']

    # TODO: PER-CLASS CONFIDENCE THRESHOLDS
    # Add back here when needed:
    # PER_CLASS_CONF = {
    #     'no_helmet':     0.55,   # lenient — catch more violators
    #     'nutshell':      0.65,   # strict  — avoid wrongful violations
    #     'helmet':        conf_threshold,
    #     'license_plate': 0.60,
    # }

    latest_plate      = ""
    detection_history = deque(maxlen=3)

    try:
        # FIX 1: agnostic_nms removes helmet+no_helmet double boxes
        # TODO: when PER_CLASS_CONF is restored, replace conf=conf_threshold with:
        #   conf=min(PER_CLASS_CONF.values())
        results_generator = model(
            rtsp_url,
            stream=True,
            conf=conf_threshold,
            iou=0.5,
            agnostic_nms=True,
            verbose=False
        )

        frame_count = 0
        for results in results_generator:
            frame_count += 1
            now = time.time()

            if now - last_heartbeat >= heartbeat_interval:
                update_camera_status(camera_id, 'active', rtsp_url)
                last_heartbeat = now

            annotated_frame = results.orig_img.copy()
            compliant_count = 0
            violation_count = 0

            # Build stable class set from last 3 frames
            current_detections = set()
            if results.boxes is not None:
                for box in results.boxes:
                    cls_id = int(box.cls[0])
                    current_detections.add(model.names[cls_id].lower())
            detection_history.append(current_detections)

            stable_classes = set()
            if len(detection_history) >= 2:
                for cls in current_detections:
                    count = sum(1 for f in detection_history if cls in f)
                    if count >= 2:
                        stable_classes.add(cls)
            else:
                stable_classes = current_detections

            # FIX 2: filter overlapping boxes across classes
            boxes_filtered = filter_overlapping_boxes(
                list(results.boxes) if results.boxes is not None else []
            )

            # First pass: OCR plates
            for box in boxes_filtered:
                cls_id     = int(box.cls[0])
                conf_box   = float(box.conf[0])
                class_name = model.names[cls_id].lower()
                if class_name == "license_plate" and conf_box >= 0.6:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                    plate_text = read_plate_text(annotated_frame, x1, y1, x2, y2, reader, ocr_conf=ocr_conf)
                    if plate_text:
                        latest_plate = plate_text

            # Second pass: draw + send
            for box in boxes_filtered:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf       = float(box.conf[0])
                cls_id     = int(box.cls[0])
                class_name = model.names[cls_id].lower()

                # Only draw stable detections
                if class_name not in stable_classes:
                    continue

                # TODO: PER-CLASS CONFIDENCE FILTER
                # When PER_CLASS_CONF is restored, add back:
                #   class_conf_min = PER_CLASS_CONF.get(class_name, conf_threshold)
                #   if conf < class_conf_min: continue

                if class_name in COMPLIANT_CLASSES:
                    color = (0, 255, 0)
                    label = f"COMPLIANT: Helmet ({conf:.2f})"
                    compliant_count += 1

                elif class_name in VIOLATION_CLASSES:
                    color = (0, 0, 255)
                    display_name = class_name.replace('_', ' ').title()
                    label = f"VIOLATION: {display_name} ({conf:.2f})"
                    violation_count += 1

                    plate_key = latest_plate if latest_plate else "NO_PLATE"
                    key = f"{class_name}:{plate_key}"
                    if (now - last_sent.get(key, 0)) >= send_cooldown:
                        last_sent[key] = now
                        send_violation_to_backend(
                            {
                                'status': 'violation',
                                'confidence': conf,
                                'classification': class_name,
                                'plate_number': latest_plate,
                                'bounding_box': {
                                    'x1': int(x1), 'y1': int(y1),
                                    'x2': int(x2), 'y2': int(y2)
                                }
                            },
                            annotated_frame
                        )

                else:
                    color = (0, 255, 255)
                    label = f"PLATE: {latest_plate} ({conf:.2f})" if latest_plate else f"PLATE ({conf:.2f})"

                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)

                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.6
                thickness = 2
                (text_width, text_height), _ = cv2.getTextSize(label, font, font_scale, thickness)
                cv2.rectangle(annotated_frame,
                              (x1, y1 - text_height - 10),
                              (x1 + text_width, y1),
                              color, -1)
                cv2.putText(annotated_frame, label,
                            (x1, y1 - 5),
                            font, font_scale, (255, 255, 255), thickness)

            if frame_count % 30 == 0:
                print(
                    f"Frame {frame_count} | "
                    f"Compliant: {compliant_count} | "
                    f"Violations: {violation_count} | "
                    f"Plate: {latest_plate or 'N/A'}"
                )

            # Re-fetch settings from backend every 300 frames (~10s at 30fps)
            # so changes saved in the Settings page apply without restarting YOLO
            if frame_count % 300 == 0:
                new_conf, new_cooldown, _, new_ocr = fetch_settings_from_backend()
                if (new_conf != conf_threshold or
                    new_cooldown != send_cooldown or
                    new_ocr != ocr_conf):
                    conf_threshold = new_conf
                    send_cooldown  = new_cooldown
                    ocr_conf       = new_ocr
                    # TODO: when PER_CLASS_CONF is restored, add: PER_CLASS_CONF['helmet'] = conf_threshold
                    print(f"[Settings updated] conf={conf_threshold} | cooldown={send_cooldown}s | ocr={ocr_conf}")

            cv2.putText(annotated_frame, f"Compliant: {compliant_count}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(annotated_frame, f"Violations: {violation_count}", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            if latest_plate:
                cv2.putText(annotated_frame, f"Plate: {latest_plate}", (10, 90),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

            cv2.imshow('SafeRide YOLO Detection - Press Q to Quit', annotated_frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("\nStopping...")
                break

    except Exception as e:
        print(f"\nERROR during inference: {e}")

    finally:
        update_camera_status(camera_id, 'inactive', rtsp_url)
        cv2.destroyAllWindows()
        print("\nStream closed.")


if __name__ == "__main__":
    main()
