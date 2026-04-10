# YOLO Service Code Bundle

Note: the `.env` section below has sensitive values redacted before sharing.

## `main.py`

```python
import os
import sys
import cv2
import time
import threading
import torch
from queue import Empty, Full, Queue
from ultralytics import YOLO
from dotenv import load_dotenv
import easyocr
from collections import deque
from mjpeg_server import start_mjpeg_server, update_frame

from backend_api import update_camera_status, send_violation_to_backend, fetch_settings_from_backend
from ocr import read_plate_text
from detection import filter_overlapping_boxes


def _extract_bbox(box):
    return tuple(int(v) for v in box.xyxy[0].cpu().numpy().astype(int))


def _plate_matches_violation(violation_bbox, plate_bbox):
    """
    Match a plate to the same rider instead of treating any plate anywhere
    in the frame as valid vehicle context.
    """
    vx1, vy1, vx2, vy2 = violation_bbox
    px1, py1, px2, py2 = plate_bbox

    violation_width = max(1, vx2 - vx1)
    plate_width = max(1, px2 - px1)
    plate_height = max(1, py2 - py1)
    plate_center_x = (px1 + px2) / 2

    horizontal_padding = max(violation_width * 0.6, plate_width * 1.5, 24)
    if not (vx1 - horizontal_padding <= plate_center_x <= vx2 + horizontal_padding):
        return False

    if py1 < vy1:
        return False

    vertical_gap = py1 - vy2
    max_vertical_gap = max(plate_width * 8.0, plate_height * 12.0, 180.0)
    return vertical_gap <= max_vertical_gap


def _heartbeat_worker(camera_id, stream_url, heartbeat_interval, stop_event):
    while not stop_event.wait(heartbeat_interval):
        try:
            update_camera_status(camera_id, 'active', stream_url)
        except Exception as exc:
            print(f"Error sending heartbeat: {exc}")


def _violation_sender_worker(send_queue, stop_event):
    while not stop_event.is_set() or not send_queue.empty():
        try:
            item = send_queue.get(timeout=0.2)
        except Empty:
            continue

        try:
            send_violation_to_backend(
                item['payload'],
                frame_jpeg=item['frame_jpeg'],
            )
        except Exception as exc:
            print(f"Error sending queued violation: {exc}")
        finally:
            send_queue.task_done()


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

    yolo_device = (os.getenv('YOLO_DEVICE', 'cuda:0') or 'cuda:0').strip()
    if yolo_device.startswith('cuda') and not torch.cuda.is_available():
        yolo_device = 'cpu'
    yolo_imgsz = max(320, int(os.getenv('YOLO_IMGSZ', '960')))
    yolo_vid_stride = max(1, int(os.getenv('YOLO_VID_STRIDE', '2')))
    yolo_half = os.getenv('YOLO_HALF', '1') == '1' and yolo_device != 'cpu'
    ocr_every_n_frames = max(1, int(os.getenv('OCR_EVERY_N_FRAMES', '2')))
    ocr_refresh_frames = max(
        ocr_every_n_frames,
        int(os.getenv('OCR_REFRESH_FRAMES', str(max(ocr_every_n_frames * 10, 10)))),
    )
    plate_hold_frames = max(0, int(os.getenv('PLATE_HOLD_FRAMES', '30')))
    mjpeg_quality = max(40, min(95, int(os.getenv('MJPEG_JPEG_QUALITY', '60'))))
    mjpeg_resize_width = max(0, int(os.getenv('MJPEG_RESIZE_WIDTH', '960')))
    show_window = os.getenv('SHOW_WINDOW', '1') == '1'

    conf_threshold, send_cooldown, _, ocr_conf, conf_no_helmet, conf_nutshell, conf_helmet, conf_license_plate = fetch_settings_from_backend()

    if not all([rtsp_ip, rtsp_user, rtsp_pass]):
        print("ERROR: Missing RTSP credentials in .env file")
        return

    rtsp_url = f"rtsp://{rtsp_user}:{rtsp_pass}@{rtsp_ip}:554/{stream}"
    print(f"Stream         : {stream}")
    print(f"Camera ID      : {camera_id}")
    print(f"Conf threshold : {conf_threshold}")
    print(f"Send cooldown  : {send_cooldown}s")
    print(f"YOLO device    : {yolo_device}")
    print(f"YOLO image size: {yolo_imgsz}")
    print(f"YOLO vid stride: {yolo_vid_stride}")
    print(f"YOLO FP16      : {yolo_half}")
    print(f"OCR interval   : every {ocr_every_n_frames} frame(s)")
    print(f"OCR refresh    : every {ocr_refresh_frames} frame(s) while plate is visible")
    print(f"MJPEG quality  : {mjpeg_quality}")
    print(f"MJPEG width    : {mjpeg_resize_width or 'native'}")
    print(f"Preview window : {'on' if show_window else 'off'}")
    print("-" * 60)

    model_path = os.path.join('weights', 'best_v31.pt')
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

    # FIX 1: release cap even on first failure
    if not cap.isOpened():
        print("ERROR: Failed to connect to RTSP stream")
        cap.release()  # â† added
        update_camera_status(camera_id, 'inactive', '')
        return

    ret, frame = cap.read()
    if not ret:
        print("ERROR: Connected but failed to read frame")
        cap.release()
        update_camera_status(camera_id, 'inactive', '')
        return

    print(f"âœ“ Connected! Frame size: {frame.shape[1]}x{frame.shape[0]}")
    print("-" * 60)
    cap.release()

    # FIX 2: start MJPEG server AFTER RTSP is confirmed working
    mjpeg_port = int(os.getenv('MJPEG_PORT', '8081'))
    start_mjpeg_server(port=mjpeg_port)

    # FIX 3: use LAN IP if frontend opens from another device
    # For capstone demo (same PC): use 127.0.0.1
    # For other devices on network: use 192.168.137.1
    mjpeg_url = f"http://127.0.0.1:{mjpeg_port}/stream"

    # âœ… Mark active ONCE, only after everything is confirmed
    update_camera_status(camera_id, 'active', mjpeg_url)

    heartbeat_interval = int(os.getenv('HEARTBEAT_SECONDS', '2'))
    heartbeat_stop_event = threading.Event()
    heartbeat_thread = threading.Thread(
        target=_heartbeat_worker,
        args=(camera_id, mjpeg_url, heartbeat_interval, heartbeat_stop_event),
        daemon=True,
    )
    heartbeat_thread.start()

    queue_size = max(1, int(os.getenv('VIOLATION_QUEUE_SIZE', '64')))
    violation_send_queue = Queue(maxsize=queue_size)
    sender_stop_event = threading.Event()
    sender_thread = threading.Thread(
        target=_violation_sender_worker,
        args=(violation_send_queue, sender_stop_event),
        daemon=True,
    )
    sender_thread.start()

    last_sent          = {}

    VIOLATION_CLASSES = ['no_helmet', 'nutshell']
    COMPLIANT_CLASSES = ['helmet']

    PER_CLASS_CONF = {
        'no_helmet':     conf_no_helmet,
        'nutshell':      conf_nutshell,
        'helmet':        conf_helmet,
        'license_plate': conf_license_plate,
    }

    latest_plate      = ""
    detection_history = deque(maxlen=3)
    frames_since_plate_seen = plate_hold_frames + 1
    last_plate_ocr_frame = -ocr_refresh_frames

    try:
        results_generator = model(
            rtsp_url,
            stream=True,
            conf=conf_threshold,
            iou=0.5,
            agnostic_nms=True,
            verbose=False,
            device=yolo_device,
            imgsz=yolo_imgsz,
            vid_stride=yolo_vid_stride,
            stream_buffer=False,
            half=yolo_half,
        )

        frame_count = 0
        for results in results_generator:
            frame_count += 1
            now = time.time()
            pending_violation_payloads = []

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

            # Collect stable detections and keep explicit box geometry so
            # a violation only uses a plate that actually lines up with it.
            frame_classes = []
            plate_boxes = []
            candidate_violation_boxes = []
            for box in boxes_filtered:
                cls_id = int(box.cls[0])
                cname  = model.names[cls_id].lower()
                if cname not in stable_classes:
                    continue

                frame_classes.append(cname)
                bbox = _extract_bbox(box)
                conf = float(box.conf[0])

                if cname == "license_plate" and conf >= conf_license_plate:
                    plate_boxes.append(
                        {
                            'bbox': bbox,
                            'confidence': conf,
                        }
                    )
                elif cname in VIOLATION_CLASSES and conf >= PER_CLASS_CONF.get(cname, conf_threshold):
                    candidate_violation_boxes.append(
                        {
                            'bbox': bbox,
                            'class_name': cname,
                            'confidence': conf,
                        }
                    )

            associated_plate_boxes = [
                plate_info
                for plate_info in plate_boxes
                if any(
                    _plate_matches_violation(violation_info['bbox'], plate_info['bbox'])
                    for violation_info in candidate_violation_boxes
                )
            ]

            # First pass: OCR only when a plate is associated with a
            # current violation candidate. Once a plate is already known,
            # refresh it less often so OCR does not stall realtime video.
            has_associated_plate_boxes = bool(associated_plate_boxes)
            should_run_ocr = False
            if has_associated_plate_boxes:
                if latest_plate:
                    should_run_ocr = (frame_count - last_plate_ocr_frame) >= ocr_refresh_frames
                else:
                    should_run_ocr = frame_count % ocr_every_n_frames == 0

            frame_plate = None
            if should_run_ocr:
                last_plate_ocr_frame = frame_count
                for plate_info in associated_plate_boxes:
                    x1, y1, x2, y2 = plate_info['bbox']
                    plate_text = read_plate_text(annotated_frame, x1, y1, x2, y2, reader, ocr_conf=ocr_conf)
                    if plate_text:
                        frame_plate = plate_text
                        break

                if frame_plate:
                    latest_plate = frame_plate
                    frames_since_plate_seen = 0
                else:
                    frames_since_plate_seen = 0 if latest_plate else frames_since_plate_seen + 1
            else:
                if has_associated_plate_boxes and latest_plate:
                    frames_since_plate_seen = 0
                else:
                    frames_since_plate_seen += 1

            if frames_since_plate_seen > plate_hold_frames:
                latest_plate = ""

            # Second pass: draw + send
            for box in boxes_filtered:
                x1, y1, x2, y2 = _extract_bbox(box)
                conf       = float(box.conf[0])
                cls_id     = int(box.cls[0])
                class_name = model.names[cls_id].lower()

                # Only draw stable detections
                if class_name not in stable_classes:
                    continue

                class_conf_min = PER_CLASS_CONF.get(class_name, conf_threshold)
                if conf < class_conf_min:
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

                    has_associated_plate = any(
                        _plate_matches_violation((x1, y1, x2, y2), plate_info['bbox'])
                        for plate_info in plate_boxes
                    )

                    # Skip sending if the violation box does not line up
                    # with a nearby motorcycle plate.
                    if not has_associated_plate:
                        if frame_count % 30 == 0:
                            print(f"[Skipped] {class_name} - no associated motorcycle plate for this detection")
                        continue

                    plate_key = latest_plate if latest_plate else "NO_PLATE"
                    key = f"{class_name}:{plate_key}"
                    if (now - last_sent.get(key, 0)) >= send_cooldown:
                        last_sent[key] = now
                        pending_violation_payloads.append(
                            {
                                'status': 'violation',
                                'confidence': conf,
                                'classification': class_name,
                                'plate_number': latest_plate,
                                'bounding_box': {
                                    'x1': int(x1), 'y1': int(y1),
                                    'x2': int(x2), 'y2': int(y2)
                                },
                                'detected_objects': {
                                    'objects': [
                                        {'class': c} for c in frame_classes
                                    ]
                                }
                            }
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
                new_conf, new_cooldown, _, new_ocr, new_no_helmet, new_nutshell, new_helmet, new_plate = fetch_settings_from_backend()
                if (new_conf != conf_threshold or
                    new_cooldown != send_cooldown or
                    new_ocr != ocr_conf or
                    new_no_helmet != conf_no_helmet or
                    new_nutshell  != conf_nutshell or
                    new_helmet    != conf_helmet or
                    new_plate     != conf_license_plate):
                    conf_threshold    = new_conf
                    send_cooldown     = new_cooldown
                    ocr_conf          = new_ocr
                    conf_no_helmet    = new_no_helmet
                    conf_nutshell     = new_nutshell
                    conf_helmet       = new_helmet
                    conf_license_plate = new_plate
                    PER_CLASS_CONF['no_helmet']     = conf_no_helmet
                    PER_CLASS_CONF['nutshell']      = conf_nutshell
                    PER_CLASS_CONF['helmet']        = conf_helmet
                    PER_CLASS_CONF['license_plate'] = conf_license_plate
                    print(f"[Settings updated] conf={conf_threshold} | cooldown={send_cooldown}s | ocr={ocr_conf}")
                    print(f"  per-class: no_helmet={conf_no_helmet} | nutshell={conf_nutshell} | helmet={conf_helmet} | plate={conf_license_plate}")

            cv2.putText(annotated_frame, f"Compliant: {compliant_count}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(annotated_frame, f"Violations: {violation_count}", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            if latest_plate:
                cv2.putText(annotated_frame, f"Plate: {latest_plate}", (10, 90),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

            # Encode a lighter MJPEG frame to reduce browser-side delay.
            stream_frame = annotated_frame
            if mjpeg_resize_width > 0 and stream_frame.shape[1] > mjpeg_resize_width:
                scale = mjpeg_resize_width / stream_frame.shape[1]
                resized_height = max(1, int(stream_frame.shape[0] * scale))
                stream_frame = cv2.resize(
                    stream_frame,
                    (mjpeg_resize_width, resized_height),
                    interpolation=cv2.INTER_AREA,
                )

            ret, jpeg = cv2.imencode(
                '.jpg',
                stream_frame,
                [cv2.IMWRITE_JPEG_QUALITY, mjpeg_quality],
            )
            if ret:
                frame_jpeg = jpeg.tobytes()
                update_frame(frame_jpeg)

                for payload in pending_violation_payloads:
                    try:
                        violation_send_queue.put_nowait(
                            {
                                'payload': payload,
                                'frame_jpeg': frame_jpeg,
                            }
                        )
                    except Full:
                        print('[Queue full] Dropping violation upload to keep realtime processing')
                        break

            if show_window:
                cv2.imshow('SafeRide YOLO Detection - Press Q to Quit', annotated_frame)

                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("\nStopping...")
                    break

    except Exception as e:
        print(f"\nERROR during inference: {e}")

    finally:
        heartbeat_stop_event.set()
        heartbeat_thread.join(timeout=2.0)
        sender_stop_event.set()
        sender_thread.join(timeout=2.0)
        update_camera_status(camera_id, 'inactive', mjpeg_url)
        if show_window:
            cv2.destroyAllWindows()
        print("\nStream closed.")


if __name__ == "__main__":
    main()
```

## `backend_api.py`

```python
"""
backend_api.py
Handles all HTTP communication with the Django backend:
  - update_camera_status()
  - send_violation_to_backend()
  - fetch_settings_from_backend()
"""

import os
import json
import cv2
import requests
from datetime import datetime


BASE_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")


def _now_local():
    """
    Return a timezone-aware local datetime.
    This avoids Django interpreting naive timestamps as UTC.
    """
    return datetime.now().astimezone()


def _auth_headers(content_type=None):
    api_key = os.getenv('YOLO_API_KEY', '').strip()
    headers = {}
    if api_key:
        headers['Authorization'] = f'Api-Key {api_key}'
    if content_type:
        headers['Content-Type'] = content_type
    return headers


def update_camera_status(camera_id, status='active', stream_url=''):
    try:
        url = f"{BASE_URL}/api/cameras/{camera_id}/heartbeat/"
        now = _now_local()
        payload = {
            'status': status,
            'last_seen_at': now.isoformat(),
            'stream_url': stream_url,
        }
        response = requests.post(url, json=payload, headers=_auth_headers('application/json'))
        if response.status_code == 200:
            print(f"âœ“ Camera status updated to: {status}")
        else:
            print(f"âš  Failed to update camera status: {response.status_code} | {response.text}")
    except Exception as e:
        print(f"Error updating camera status: {e}")


def send_violation_to_backend(detection_data, frame_bgr=None, frame_jpeg=None):
    try:
        url = f"{BASE_URL}/api/violations/"
        camera_id = int(os.getenv('CAMERA_ID', '2'))
        now = _now_local()

        timestamp = now.strftime("%Y%m%d_%H%M%S_%f")
        image_filename = f"violation_{timestamp}.jpg"

        jpeg_bytes = frame_jpeg
        if jpeg_bytes is None and frame_bgr is not None:
            quality = int(os.getenv('EVIDENCE_JPEG_QUALITY', '85'))
            quality = max(30, min(95, quality))
            ok, encoded = cv2.imencode(
                '.jpg',
                frame_bgr,
                [cv2.IMWRITE_JPEG_QUALITY, quality],
            )
            if ok:
                jpeg_bytes = encoded.tobytes()

        if jpeg_bytes is None:
            print('Failed to send: no evidence frame bytes available')
            return False

        if os.getenv('SAVE_LOCAL_EVIDENCE', '0') == '1':
            evidence_dir = os.getenv("EVIDENCE_DIR", "evidence")
            os.makedirs(evidence_dir, exist_ok=True)
            image_path = os.path.join(evidence_dir, image_filename)
            with open(image_path, 'wb') as evidence_file:
                evidence_file.write(jpeg_bytes)

        detected_objects = detection_data.get('detected_objects')

        payload = {
            'camera': camera_id,
            'detected_at': now.isoformat(),
            'detection_status': detection_data['status'],
            'confidence_score': detection_data['confidence'],
            'classification': detection_data['classification'],
            'plate_number': detection_data.get('plate_number', ''),
            'bounding_box': json.dumps(detection_data.get('bounding_box', {})),
        }

        if detected_objects is not None:
            payload['detected_objects'] = json.dumps(detected_objects)

        files = {"evidence_image": (image_filename, jpeg_bytes, "image/jpeg")}
        response = requests.post(
            url,
            data=payload,
            files=files,
            headers=_auth_headers(),
            timeout=float(os.getenv('BACKEND_POST_TIMEOUT', '8')),
        )

        if response.status_code == 201:
            print(
                f"Violation sent: {payload['classification']} | "
                f"Plate: {payload['plate_number']} | "
                f"Confidence: {payload['confidence_score']:.2f}"
            )
            return True
        else:
            print(f"Failed to send: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        print(f"Error sending to backend: {e}")
        return False


def fetch_settings_from_backend():
    """
    Fetch detection settings from the Django backend.
    Falls back to .env defaults if the backend is unreachable.
    Returns: (conf_threshold, send_cooldown, data_retention_days, ocr_conf,
              conf_no_helmet, conf_nutshell, conf_helmet)
    """
    try:
        url = f"{BASE_URL}/api/settings/"
        response = requests.get(url, headers=_auth_headers('application/json'), timeout=5)
        if response.status_code == 200:
            data = response.json()
            conf           = float(data.get('confidence_threshold',  os.getenv('CONF', '0.6')))
            cooldown       = float(data.get('send_cooldown_seconds', os.getenv('SEND_COOLDOWN_SECONDS', '3')))
            retention      = int(data.get('data_retention_days', 90))
            ocr_conf       = float(data.get('ocr_confidence',        os.getenv('OCR_CONF', '0.2')))
            conf_no_helmet     = float(data.get('conf_no_helmet',     0.55))
            conf_nutshell      = float(data.get('conf_nutshell',      0.65))
            conf_helmet        = float(data.get('conf_helmet',        conf))
            conf_license_plate = float(data.get('conf_license_plate', 0.60))
            print("âœ“ Settings loaded from backend:")
            print(f"  Confidence threshold : {conf}")
            print(f"  Send cooldown        : {cooldown}s")
            print(f"  Data retention       : {retention} days")
            print(f"  OCR confidence       : {ocr_conf}")
            print(f"  Per-class conf       : no_helmet={conf_no_helmet} | nutshell={conf_nutshell} | helmet={conf_helmet} | plate={conf_license_plate}")
            return conf, cooldown, retention, ocr_conf, conf_no_helmet, conf_nutshell, conf_helmet, conf_license_plate
        else:
            print(f"âš  Could not load settings ({response.status_code}) â€” using .env defaults")
    except Exception as e:
        print(f"âš  Backend unreachable: {e} â€” using .env defaults")

    conf = float(os.getenv('CONF', '0.6'))
    return (
        conf,
        float(os.getenv('SEND_COOLDOWN_SECONDS', '3')),
        90,
        float(os.getenv('OCR_CONF', '0.2')),
        0.55,   # conf_no_helmet default
        0.65,   # conf_nutshell default
        conf,   # conf_helmet default = global threshold
        0.60,   # conf_license_plate default
    )
```

## `detection.py`

```python
"""
detection.py
Detection utilities:
  - filter_overlapping_boxes()  â€” removes duplicate detections across classes using IoU
"""


def filter_overlapping_boxes(boxes, iou_threshold=0.5):
    """
    Removes lower-confidence boxes that significantly overlap with a higher-confidence box.
    Sorted by confidence descending â€” the best detection wins when boxes overlap.
    """
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
            box_area  = (x2 - x1) * (y2 - y1)
            kept_area = (kx2 - kx1) * (ky2 - ky1)
            union_area = box_area + kept_area - inter_area

            if union_area > 0 and inter_area / union_area >= iou_threshold:
                overlap = True
                break

        if not overlap:
            kept.append(box)

    return kept
```

## `mjpeg_server.py`

```python
"""
mjpeg_server.py
Serves the latest annotated frame as an MJPEG stream on port 8081.
The browser reads this instead of Django re-opening the RTSP.
"""
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

_latest_frame_lock = threading.Lock()
_latest_frame_jpeg = None


def update_frame(jpeg_bytes: bytes):
    global _latest_frame_jpeg
    with _latest_frame_lock:
        _latest_frame_jpeg = jpeg_bytes


class MJPEGHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress request logs

    def do_GET(self):
        if self.path.split('?', 1)[0] == '/stream':
            self.send_response(200)
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.send_header('Connection', 'close')
            self.end_headers()
            try:
                while True:
                    with _latest_frame_lock:
                        frame = _latest_frame_jpeg
                    if frame:
                        self.wfile.write(
                            b'--frame\r\n'
                            b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n'
                        )
                        self.wfile.flush()
                    time.sleep(0.033)  # ~30fps cap
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass
        else:
            self.send_response(404)
            self.end_headers()


def start_mjpeg_server(port=8081):
    server = ThreadingHTTPServer(('0.0.0.0', port), MJPEGHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"âœ“ MJPEG server running on http://localhost:{port}/stream")
    return server
```

## `ocr.py`

```python
"""
ocr.py
License plate OCR helpers:
  - fix_plate_format() corrects common letter/digit mix-ups in PH plates
  - read_plate_text() crops, preprocesses and reads text from a detected plate region
"""

import re

import cv2

LETTER_TO_NUMBER = {"O": "0", "I": "1", "Z": "2", "S": "5", "B": "8", "G": "6"}
NUMBER_TO_LETTER = {"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G"}
STANDARD_PLATE_PATTERN = re.compile(r"^[A-Z]{3}\d{4}$")
OLD_MC_PLATE_PATTERN = re.compile(r"^\d{4}[A-Z]{3}$")
TEMP_MC_NUMERIC_ALPHA_PATTERN = re.compile(r"^\d{3}[A-Z]{3}$")
TEMP_MC_ALPHA_NUMERIC_PATTERN = re.compile(r"^[A-Z]\d{3}[A-Z]{2}$")
MV_FILE_PATTERN = re.compile(r"^\d{4}-\d{6,7}$")


def normalize_ocr_text(text: str) -> str:
    return "".join(ch for ch in text.upper() if ch.isalnum())


def normalize_digits(text: str) -> str:
    return "".join(ch for ch in text if ch.isdigit())


def fix_standard_plate_format(text: str) -> str:
    """
    Normalize a 7-character candidate into AAA1234.
    First 3 chars should be letters; last 4 chars should be digits.
    """
    clean = normalize_ocr_text(text)
    if len(clean) != 7:
        return ""

    letters_part = clean[:3]
    numbers_part = clean[3:]

    fixed_letters = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letters_part)
    fixed_numbers = "".join(LETTER_TO_NUMBER.get(ch, ch) for ch in numbers_part)
    candidate = fixed_letters + fixed_numbers

    return candidate if STANDARD_PLATE_PATTERN.fullmatch(candidate) else ""


def fix_old_motorcycle_plate_format(text: str) -> str:
    """
    Normalize a 7-character candidate into 1234ABC.
    First 4 chars should be digits; last 3 chars should be letters.
    """
    clean = normalize_ocr_text(text)
    if len(clean) != 7:
        return ""

    numbers_part = clean[:4]
    letters_part = clean[4:]

    fixed_numbers = "".join(LETTER_TO_NUMBER.get(ch, ch) for ch in numbers_part)
    fixed_letters = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letters_part)
    candidate = fixed_numbers + fixed_letters

    return candidate if OLD_MC_PLATE_PATTERN.fullmatch(candidate) else ""


def fix_mv_file_number_format(text: str) -> str:
    """
    Normalize a motorcycle MV file number into 1234-123456 or 1234-1234567.
    OCR may return it with or without the hyphen.
    """
    digits = normalize_digits(text)
    if len(digits) not in {10, 11}:
        return ""

    candidate = f"{digits[:4]}-{digits[4:]}"
    return candidate if MV_FILE_PATTERN.fullmatch(candidate) else ""


def fix_temp_motorcycle_numeric_alpha_format(text: str) -> str:
    """
    Normalize a 6-character temporary motorcycle plate into 123ABC.
    """
    clean = normalize_ocr_text(text)
    if len(clean) != 6:
        return ""

    numbers_part = clean[:3]
    letters_part = clean[3:]

    fixed_numbers = "".join(LETTER_TO_NUMBER.get(ch, ch) for ch in numbers_part)
    fixed_letters = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letters_part)
    candidate = fixed_numbers + fixed_letters

    return candidate if TEMP_MC_NUMERIC_ALPHA_PATTERN.fullmatch(candidate) else ""


def fix_temp_motorcycle_alpha_numeric_format(text: str) -> str:
    """
    Normalize a 6-character temporary motorcycle plate into A123BC.
    """
    clean = normalize_ocr_text(text)
    if len(clean) != 6:
        return ""

    letter_prefix = clean[:1]
    numbers_part = clean[1:4]
    letters_part = clean[4:]

    fixed_prefix = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letter_prefix)
    fixed_numbers = "".join(LETTER_TO_NUMBER.get(ch, ch) for ch in numbers_part)
    fixed_letters = "".join(NUMBER_TO_LETTER.get(ch, ch) for ch in letters_part)
    candidate = fixed_prefix + fixed_numbers + fixed_letters

    return candidate if TEMP_MC_ALPHA_NUMERIC_PATTERN.fullmatch(candidate) else ""


def fix_plate_format(text: str) -> str:
    """
    Normalize OCR output into a supported Philippine motorcycle identifier.
    Supported formats:
      - ABC1234
      - 1234ABC
      - 123ABC
      - A123BC
      - 1234-123456
      - 1234-1234567
    """
    return (
        fix_standard_plate_format(text)
        or fix_old_motorcycle_plate_format(text)
        or fix_temp_motorcycle_numeric_alpha_format(text)
        or fix_temp_motorcycle_alpha_numeric_format(text)
        or fix_mv_file_number_format(text)
    )


def extract_plate_candidate(texts) -> str:
    """
    Return the first valid plate-like candidate from OCR output.
    Keeps the format strict to avoid saving random words like "MODERN" or "TOMTI".
    """
    for raw_text in texts:
        clean = normalize_ocr_text(raw_text)
        digits_only = normalize_digits(raw_text)

        for mv_length in (11, 10):
            if len(digits_only) < mv_length:
                continue

            for start in range(len(digits_only) - mv_length + 1):
                candidate = fix_mv_file_number_format(digits_only[start:start + mv_length])
                if candidate:
                    return candidate

        if len(clean) >= 7:
            for start in range(len(clean) - 6):
                candidate = (
                    fix_standard_plate_format(clean[start:start + 7])
                    or fix_old_motorcycle_plate_format(clean[start:start + 7])
                )
                if candidate:
                    return candidate

        if len(clean) >= 6:
            for start in range(len(clean) - 5):
                candidate = (
                    fix_temp_motorcycle_numeric_alpha_format(clean[start:start + 6])
                    or fix_temp_motorcycle_alpha_numeric_format(clean[start:start + 6])
                )
                if candidate:
                    return candidate

    return ""


def read_plate_text(frame_bgr, x1, y1, x2, y2, reader, ocr_conf=0.2):
    """
    Crop the license plate region, preprocess it, and run EasyOCR.
    Returns a strict plate-like value, or "" if nothing valid was found.
    """
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
            if prob >= ocr_conf and len(normalize_ocr_text(text)) >= 3
        ]
        if not texts:
            return ""

        combined_text = "".join(texts)
        return extract_plate_candidate([combined_text, *texts])
    except Exception:
        return ""
```

## `.env`

```env
# TP Link Tapo CCTV Configuration
RTSP_IP=192.168.254.133
RTSP_USER=topefromyt
RTSP_PASS=<REDACTED>

# Stream Selection (TP Link Tapo Dual Lens)
# Wide lens HQ: stream1
# Tele lens HQ: stream6
# Wide lens LQ (lower bandwidth): stream2
# Tele lens LQ (lower bandwidth): stream7
STREAM=stream2
# YOLO Configuration
CONF=0.6
EASYOCR_GPU=0
PLATE_OCR_MIN_CONF=0.6
YOLO_DEVICE=cuda:0
YOLO_IMGSZ=640
YOLO_VID_STRIDE=3
YOLO_HALF=1
OCR_EVERY_N_FRAMES=4
OCR_REFRESH_FRAMES=24
PLATE_HOLD_FRAMES=30

CAMERA_ID=2
YOLO_API_KEY=<REDACTED>


BACKEND_URL=http://127.0.0.1:8000
# Set to 0 to reduce local rendering overhead and lower web delay.
SHOW_WINDOW=0
HEARTBEAT_SECONDS=2
MJPEG_PORT=8081
MJPEG_JPEG_QUALITY=60
MJPEG_RESIZE_WIDTH=800

```

