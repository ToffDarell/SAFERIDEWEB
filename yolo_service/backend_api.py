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
            print(f"✓ Camera status updated to: {status}")
        else:
            print(f"⚠ Failed to update camera status: {response.status_code} | {response.text}")
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
            print("✓ Settings loaded from backend:")
            print(f"  Confidence threshold : {conf}")
            print(f"  Send cooldown        : {cooldown}s")
            print(f"  Data retention       : {retention} days")
            print(f"  OCR confidence       : {ocr_conf}")
            print(f"  Per-class conf       : no_helmet={conf_no_helmet} | nutshell={conf_nutshell} | helmet={conf_helmet} | plate={conf_license_plate}")
            return conf, cooldown, retention, ocr_conf, conf_no_helmet, conf_nutshell, conf_helmet, conf_license_plate
        else:
            print(f"⚠ Could not load settings ({response.status_code}) — using .env defaults")
    except Exception as e:
        print(f"⚠ Backend unreachable: {e} — using .env defaults")

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
