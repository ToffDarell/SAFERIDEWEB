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


def _violation_overlaps_plate_zone(violation_bbox, plate_bbox):
    """
    Require the violation bounding box to have meaningful vertical overlap
    with the estimated rider zone above the plate.  This rejects pedestrians
    who are merely *beside* a parked motorcycle plate but not actually above
    or on it.
    """
    vx1, vy1, vx2, vy2 = violation_bbox
    px1, py1, px2, py2 = plate_bbox

    plate_height = max(1, py2 - py1)
    plate_width = max(1, px2 - px1)

    # Estimated rider zone: extends from well above the plate to the plate
    rider_zone_top = py1 - max(plate_height * 10, plate_width * 4, 120)
    rider_zone_bottom = py2
    rider_zone_left = px1 - plate_width * 0.8
    rider_zone_right = px2 + plate_width * 0.8

    # Compute IoU between violation bbox and estimated rider zone
    inter_x1 = max(vx1, rider_zone_left)
    inter_y1 = max(vy1, rider_zone_top)
    inter_x2 = min(vx2, rider_zone_right)
    inter_y2 = min(vy2, rider_zone_bottom)

    if inter_x2 <= inter_x1 or inter_y2 <= inter_y1:
        return False

    inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
    violation_area = max(1, (vx2 - vx1) * (vy2 - vy1))

    # At least 15% of the violation box should overlap the rider zone
    return (inter_area / violation_area) >= 0.15


def _draw_status_panel(frame, compliant_count, violation_count, latest_plate):
    lines = [
        (f"Compliant: {compliant_count}", (0, 255, 0)),
        (f"Violations: {violation_count}", (0, 0, 255)),
    ]
    if latest_plate:
        lines.append((f"Plate: {latest_plate}", (0, 255, 255)))

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.9
    thickness = 2
    line_gap = 12
    padding_x = 16
    padding_y = 14
    right_margin = 16
    top_margin = 72 if frame.shape[0] >= 240 else 12

    text_sizes = [cv2.getTextSize(text, font, font_scale, thickness)[0] for text, _ in lines]
    max_text_width = max(width for width, _ in text_sizes)
    max_text_height = max(height for _, height in text_sizes)

    box_width = max_text_width + (padding_x * 2)
    box_height = (len(lines) * max_text_height) + ((len(lines) - 1) * line_gap) + (padding_y * 2)

    frame_height, frame_width = frame.shape[:2]
    panel_left = max(0, frame_width - box_width - right_margin)
    panel_top = top_margin
    if panel_top + box_height > frame_height:
        panel_top = max(8, frame_height - box_height - 8)
    panel_right = min(frame_width - 1, panel_left + box_width)
    panel_bottom = min(frame_height - 1, panel_top + box_height)

    overlay = frame.copy()
    cv2.rectangle(overlay, (panel_left, panel_top), (panel_right, panel_bottom), (18, 18, 32), -1)
    cv2.rectangle(overlay, (panel_left, panel_top), (panel_right, panel_bottom), (220, 220, 220), 1)
    cv2.addWeighted(overlay, 0.82, frame, 0.18, 0, frame)

    baseline_y = panel_top + padding_y + max_text_height
    for index, ((text, color), _) in enumerate(zip(lines, text_sizes)):
        y = baseline_y + (index * (max_text_height + line_gap))
        cv2.putText(
            frame,
            text,
            (panel_left + padding_x, y),
            font,
            font_scale,
            color,
            thickness,
            cv2.LINE_AA,
        )            


def _encode_plate_crop(frame_bgr, bbox, quality=90):
    x1, y1, x2, y2 = bbox
    frame_height, frame_width = frame_bgr.shape[:2]

    x1 = max(0, min(frame_width, int(x1)))
    x2 = max(0, min(frame_width, int(x2)))
    y1 = max(0, min(frame_height, int(y1)))
    y2 = max(0, min(frame_height, int(y2)))

    if x2 <= x1 or y2 <= y1:
        return None

    crop = frame_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None

    ok, encoded = cv2.imencode(
        '.jpg',
        crop,
        [cv2.IMWRITE_JPEG_QUALITY, max(30, min(95, int(quality)))],
    )
    return encoded.tobytes() if ok else None


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


# ---------------------------------------------------------------------------
# OCR background worker
# ---------------------------------------------------------------------------
# The OCR thread picks up plate crops from a queue, runs EasyOCR off the main
# inference loop, and writes the result into a shared variable. The main loop
# never blocks on OCR — it always uses the most recently available plate text.
# ---------------------------------------------------------------------------

class _OcrState:
    """Thread-safe container for the latest OCR result."""

    def __init__(self):
        self._lock = threading.Lock()
        self._plate = ""
        self._updated_at = 0.0  # time.time() of last successful OCR

    def get(self):
        with self._lock:
            return self._plate, self._updated_at

    def set(self, plate_text):
        with self._lock:
            self._plate = plate_text
            self._updated_at = time.time()

    def clear(self):
        with self._lock:
            self._plate = ""


def _ocr_worker(ocr_queue, reader, ocr_conf, ocr_state, stop_event):
    """
    Background thread that runs EasyOCR on plate crops.
    Drains stale items so only the freshest crop is processed.
    """
    while not stop_event.is_set():
        try:
            item = ocr_queue.get(timeout=0.3)
        except Empty:
            continue

        # Drain stale crops — only process the latest one
        latest = item
        while True:
            try:
                latest = ocr_queue.get_nowait()
            except Empty:
                break

        try:
            frame_bgr = latest['frame']
            x1, y1, x2, y2 = latest['bbox']
            plate_text = read_plate_text(frame_bgr, x1, y1, x2, y2, reader, ocr_conf=ocr_conf)
            if plate_text:
                ocr_state.set(plate_text)
                print(f"[OCR] Plate read: {plate_text}")
        except Exception as exc:
            print(f"[OCR] Error: {exc}")
        finally:
            ocr_queue.task_done()


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

    requested_yolo_device = (os.getenv('YOLO_DEVICE', 'cuda:0') or 'cuda:0').strip()
    cuda_available = torch.cuda.is_available()
    yolo_device = requested_yolo_device
    if yolo_device.startswith('cuda') and not cuda_available:
        print("WARNING: YOLO_DEVICE requested CUDA, but this Python environment cannot use it.")
        print(f"  torch version : {torch.__version__}")
        print(f"  torch cuda    : {torch.version.cuda}")
        print("  selected      : cpu")
        print("  hint          : use the yolo_service/venv_new interpreter for GPU inference")
        yolo_device = 'cpu'
    yolo_imgsz = max(320, int(os.getenv('YOLO_IMGSZ', '960')))
    yolo_vid_stride = max(1, int(os.getenv('YOLO_VID_STRIDE', '2')))
    yolo_half = os.getenv('YOLO_HALF', '1') == '1' and yolo_device != 'cpu'
    ocr_every_n_frames = max(1, int(os.getenv('OCR_EVERY_N_FRAMES', '2')))
    ocr_refresh_frames = max(
        ocr_every_n_frames,
        int(os.getenv('OCR_REFRESH_FRAMES', str(max(ocr_every_n_frames * 10, 10)))),
    )
    plate_hold_seconds = max(1.0, float(os.getenv('PLATE_HOLD_SECONDS', '5.0')))
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
    print(f"Torch version  : {torch.__version__}")
    print(f"Torch CUDA     : {torch.version.cuda}")
    print(f"YOLO device    : {yolo_device}")
    if yolo_device.startswith('cuda') and cuda_available:
        print(f"CUDA GPU       : {torch.cuda.get_device_name(0)}")
    print(f"YOLO image size: {yolo_imgsz}")
    print(f"YOLO vid stride: {yolo_vid_stride}")
    print(f"YOLO FP16      : {yolo_half}")
    print(f"OCR interval   : every {ocr_every_n_frames} frame(s)")
    print(f"OCR refresh    : every {ocr_refresh_frames} frame(s) while plate is visible")
    print(f"Plate hold     : {plate_hold_seconds}s")
    print(f"MJPEG quality  : {mjpeg_quality}")
    print(f"MJPEG width    : {mjpeg_resize_width or 'native'}")
    print(f"Preview window : {'on' if show_window else 'off'}")
    print("-" * 60)

    model_path = os.path.join('weights', 'v29.pt')
    if not os.path.exists(model_path):
        print(f"ERROR: Model not found at {model_path}")
        return

    print(f"Loading YOLO model from: {model_path}")
    model = YOLO(model_path)
    print(f"Model loaded! Classes: {model.names}")
    print("-" * 60)

    # ── EasyOCR ──────────────────────────────────────────────────
    # Always run OCR on CPU to avoid GPU contention with YOLO.
    # OCR now runs on a background thread, so CPU latency does not
    # affect the live MJPEG feed at all.
    print("Loading EasyOCR...")
    ocr_use_gpu = os.getenv("EASYOCR_GPU", "0") == "1"
    if ocr_use_gpu and yolo_device.startswith('cuda'):
        print("  ⚠ EasyOCR GPU mode disabled to avoid GPU contention with YOLO")
        ocr_use_gpu = False
    reader = easyocr.Reader(["en"], gpu=ocr_use_gpu)
    print(f"EasyOCR loaded! (gpu={ocr_use_gpu})")
    if yolo_device.startswith('cuda'):
        print(f"YOLO will still run on {yolo_device} while EasyOCR stays on CPU.")
    print("-" * 60)

    print("Connecting to RTSP stream...")
    cap = cv2.VideoCapture(rtsp_url)

    # FIX 1: release cap even on first failure
    if not cap.isOpened():
        print("ERROR: Failed to connect to RTSP stream")
        cap.release()  # ← added
        update_camera_status(camera_id, 'inactive', '')
        return

    ret, frame = cap.read()
    if not ret:
        print("ERROR: Connected but failed to read frame")
        cap.release()
        update_camera_status(camera_id, 'inactive', '')
        return

    print(f"✓ Connected! Frame size: {frame.shape[1]}x{frame.shape[0]}")
    print("-" * 60)
    cap.release()

    # FIX 2: start MJPEG server AFTER RTSP is confirmed working
    mjpeg_port = int(os.getenv('MJPEG_PORT', '8081'))
    start_mjpeg_server(port=mjpeg_port)

    # FIX 3: use LAN IP if frontend opens from another device
    # For capstone demo (same PC): use 127.0.0.1
    # For other devices on network: use 192.168.137.1
    mjpeg_url = f"http://127.0.0.1:{mjpeg_port}/stream"

    # ✅ Mark active ONCE, only after everything is confirmed
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

    # ── OCR background thread ────────────────────────────────────
    ocr_state = _OcrState()
    ocr_queue = Queue(maxsize=4)
    ocr_stop_event = threading.Event()
    ocr_thread = threading.Thread(
        target=_ocr_worker,
        args=(ocr_queue, reader, ocr_conf, ocr_state, ocr_stop_event),
        daemon=True,
    )
    ocr_thread.start()
    print("✓ OCR background thread started")

    last_sent          = {}

    VIOLATION_CLASSES = ['no_helmet', 'nutshell']
    COMPLIANT_CLASSES = ['helmet']

    PER_CLASS_CONF = {
        'no_helmet':     conf_no_helmet,
        'nutshell':      conf_nutshell,
        'helmet':        conf_helmet,
        'license_plate': conf_license_plate,
    }

    detection_history = deque(maxlen=3)
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

            # ── Read latest plate from OCR thread (non-blocking) ──
            latest_plate, plate_updated_at = ocr_state.get()
            if latest_plate and (now - plate_updated_at) > plate_hold_seconds:
                ocr_state.clear()
                latest_plate = ""

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

            # ── Submit plate crops to OCR thread (non-blocking) ───
            has_associated_plate_boxes = bool(associated_plate_boxes)
            should_submit_ocr = False
            if has_associated_plate_boxes:
                if latest_plate:
                    should_submit_ocr = (frame_count - last_plate_ocr_frame) >= ocr_refresh_frames
                else:
                    should_submit_ocr = frame_count % ocr_every_n_frames == 0

            if should_submit_ocr:
                last_plate_ocr_frame = frame_count
                # Pick the highest-confidence associated plate
                best_plate = max(associated_plate_boxes, key=lambda p: p['confidence'])
                x1, y1, x2, y2 = best_plate['bbox']
                try:
                    ocr_queue.put_nowait({
                        'frame': annotated_frame,
                        'bbox': (x1, y1, x2, y2),
                    })
                except Full:
                    pass  # OCR is busy — skip this crop, keep live feed running

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

                    # ── Pedestrian false-positive guard ────────────
                    # Even if the plate is spatially "associated", reject
                    # the violation if the person bbox does not actually
                    # overlap the rider zone above the plate.  This catches
                    # pedestrians walking beside a parked motorcycle.
                    has_rider_overlap = any(
                        _violation_overlaps_plate_zone((x1, y1, x2, y2), plate_info['bbox'])
                        for plate_info in plate_boxes
                        if _plate_matches_violation((x1, y1, x2, y2), plate_info['bbox'])
                    )
                    if not has_rider_overlap:
                        if frame_count % 30 == 0:
                            print(f"[Skipped] {class_name} - person not overlapping rider zone (likely pedestrian)")
                        continue

                    plate_key = latest_plate if latest_plate else "NO_PLATE"
                    key = f"{class_name}:{plate_key}"
                    if (now - last_sent.get(key, 0)) >= send_cooldown:
                        last_sent[key] = now
                        matched_plate_boxes = [
                            plate_info
                            for plate_info in plate_boxes
                            if _plate_matches_violation((x1, y1, x2, y2), plate_info['bbox'])
                        ]
                        best_matched_plate = (
                            max(matched_plate_boxes, key=lambda plate_info: plate_info['confidence'])
                            if matched_plate_boxes
                            else None
                        )
                        plate_crop_jpeg = (
                            _encode_plate_crop(
                                results.orig_img,
                                best_matched_plate['bbox'],
                                quality=int(os.getenv('PLATE_CROP_JPEG_QUALITY', '92')),
                            )
                            if best_matched_plate
                            else None
                        )
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
                                },
                                'plate_crop_jpeg': plate_crop_jpeg,
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

            _draw_status_panel(annotated_frame, compliant_count, violation_count, latest_plate)

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
        ocr_stop_event.set()
        ocr_thread.join(timeout=2.0)
        update_camera_status(camera_id, 'inactive', mjpeg_url)
        if show_window:
            cv2.destroyAllWindows()
        print("\nStream closed.")


if __name__ == "__main__":
    main()
