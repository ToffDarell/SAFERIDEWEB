import os
import sys
import cv2
import requests
from datetime import datetime
import time
from ultralytics import YOLO
from dotenv import load_dotenv
import easyocr
from collections import deque


def update_camera_status(camera_id, status='active', stream_url=''):
    try:
        url = f"http://127.0.0.1:8000/api/cameras/{camera_id}/"
        token = os.getenv('API_TOKEN')
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        payload = {
            'status': status,
            'last_seen_at': datetime.now().isoformat(),
            'stream_url': stream_url
        }
        response = requests.patch(url, json=payload, headers=headers)
        if response.status_code == 200:
            print(f"✓ Camera status updated to: {status}")
        else:
            print(f"⚠ Failed to update camera status: {response.status_code} | {response.text}")
    except Exception as e:
        print(f"Error updating camera status: {e}")


def send_violation_to_backend(detection_data, frame_bgr):
    try:
        url = "http://127.0.0.1:8000/api/violations/"
        token = os.getenv('API_TOKEN')
        headers = {'Authorization': f'Bearer {token}'}

        camera_id = int(os.getenv('CAMERA_ID', '2'))

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        evidence_dir = os.getenv("EVIDENCE_DIR", "evidence")
        os.makedirs(evidence_dir, exist_ok=True)
        image_path = os.path.join(evidence_dir, f"violation_{timestamp}.jpg")
        cv2.imwrite(image_path, frame_bgr)

        payload = {
            'camera': camera_id,
            'detected_at': datetime.now().isoformat(),
            'detection_status': detection_data['status'],
            'confidence_score': detection_data['confidence'],
            'classification': detection_data['classification'],
            'plate_number': detection_data.get('plate_number', ''),
            'bounding_box': str(detection_data.get('bounding_box', {})),
        }

        with open(image_path, "rb") as img:
            files = {"evidence_image": (os.path.basename(image_path), img, "image/jpeg")}
            response = requests.post(url, data=payload, files=files, headers=headers, timeout=15)

        if response.status_code == 201:
            print(
                f"Violation sent: {payload['classification']} | "
                f"Plate: {payload['plate_number']} | "
                f"Confidence: {payload['confidence_score']:.2f}"
            )
        else:
            print(f"Failed to send: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"Error sending to backend: {e}")


# -----------------------------
# OCR helpers
# -----------------------------
def fix_plate_format(text: str) -> str:
    LETTER_TO_NUMBER = {"O": "0", "I": "1", "Z": "2", "S": "5", "B": "8", "G": "6"}
    NUMBER_TO_LETTER = {"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G"}

    clean = text.replace(" ", "")

    if len(clean) >= 6:
        letters_part = clean[:3]
        numbers_part = clean[3:]

        fixed_letters = ""
        for ch in letters_part:
            fixed_letters += NUMBER_TO_LETTER.get(ch, ch)

        fixed_numbers = ""
        for ch in numbers_part:
            fixed_numbers += LETTER_TO_NUMBER.get(ch, ch)

        return fixed_letters + fixed_numbers

    return text


def read_plate_text(frame_bgr, x1, y1, x2, y2, reader, ocr_conf=0.2):
    try:
        h, w = frame_bgr.shape[:2]
        x1 = max(0, min(x1, w - 1))
        x2 = max(0, min(x2, w))
        y1 = max(0, min(y1, h - 1))
        y2 = max(0, min(y2, h))

        if x2 <= x1 or y2 <= y1:
            return ""

        crop = frame_bgr[y1:y2, x1:x2]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        results = reader.readtext(thresh)
        texts = [
            text for (_, text, prob) in results
            if prob >= ocr_conf  # ← uses dynamic threshold instead of hardcoded
            and len(text) >= 3
        ]
        text = " ".join(texts)
        text = "".join(ch for ch in text if ch.isalnum() or ch == " ").strip().upper()
        text = fix_plate_format(text)

        return text if len(text) >= 3 else ""
    except Exception:
        return ""


# -----------------------------
# Overlap filter - removes double detections across classes
# -----------------------------
def filter_overlapping_boxes(boxes, iou_threshold=0.5):
    if not boxes:
        return boxes

    kept = []
    boxes_sorted = sorted(boxes, key=lambda b: float(b.conf[0]), reverse=True)

    for box in boxes_sorted:
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
        overlap = False

        for kept_box in kept:
            kx1, ky1, kx2, ky2 = kept_box.xyxy[0].cpu().numpy().astype(int)
            inter_x1 = max(x1, kx1)
            inter_y1 = max(y1, ky1)
            inter_x2 = min(x2, kx2)
            inter_y2 = min(y2, ky2)
            inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
            box_area   = (x2 - x1) * (y2 - y1)
            kept_area  = (kx2 - kx1) * (ky2 - ky1)
            union_area = box_area + kept_area - inter_area

            if union_area > 0 and inter_area / union_area >= iou_threshold:
                overlap = True
                break

        if not overlap:
            kept.append(box)

    return kept


def fetch_settings_from_backend():
    """Fetch detection settings from Django backend on startup."""
    try:
        token = os.getenv('API_TOKEN')
        url   = "http://127.0.0.1:8000/api/settings/"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            conf         = float(data.get('confidence_threshold',  os.getenv('CONF', '0.6')))
            cooldown     = float(data.get('send_cooldown_seconds', os.getenv('SEND_COOLDOWN_SECONDS', '3')))
            retention    = int(data.get('data_retention_days',     90))
            ocr_conf     = float(data.get('ocr_confidence',        os.getenv('OCR_CONF', '0.2')))
            print(f"✓ Settings loaded from backend:")
            print(f"  Confidence threshold : {conf}")
            print(f"  Send cooldown        : {cooldown}s")
            print(f"  Data retention       : {retention} days")
            print(f"  OCR confidence       : {ocr_conf}")
            return conf, cooldown, retention, ocr_conf
        else:
            print(f"⚠ Could not load settings ({response.status_code}) — using .env defaults")
    except Exception as e:
        print(f"⚠ Backend unreachable: {e} — using .env defaults")

    return (
        float(os.getenv('CONF', '0.6')),
        float(os.getenv('SEND_COOLDOWN_SECONDS', '3')),
        90,
        float(os.getenv('OCR_CONF', '0.2')),
    )


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

    latest_plate      = ""
    detection_history = deque(maxlen=3)

    try:
        # FIX 1: agnostic_nms removes helmet+no_helmet double boxes
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
