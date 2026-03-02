"""
backend_api.py
Handles all HTTP communication with the Django backend:
  - update_camera_status()
  - send_violation_to_backend()
  - fetch_settings_from_backend()
"""

import os
import cv2
import requests
from datetime import datetime


BASE_URL = "http://127.0.0.1:8000"


def _auth_headers(content_type=None):
    token = os.getenv('API_TOKEN')
    headers = {'Authorization': f'Bearer {token}'}
    if content_type:
        headers['Content-Type'] = content_type
    return headers


def update_camera_status(camera_id, status='active', stream_url=''):
    try:
        url = f"{BASE_URL}/api/cameras/{camera_id}/"
        payload = {
            'status': status,
            'last_seen_at': datetime.now().isoformat(),
            'stream_url': stream_url,
        }
        response = requests.patch(url, json=payload, headers=_auth_headers('application/json'))
        if response.status_code == 200:
            print(f"✓ Camera status updated to: {status}")
        else:
            print(f"⚠ Failed to update camera status: {response.status_code} | {response.text}")
    except Exception as e:
        print(f"Error updating camera status: {e}")


def send_violation_to_backend(detection_data, frame_bgr):
    try:
        url = f"{BASE_URL}/api/violations/"
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
            response = requests.post(
                url, data=payload, files=files,
                headers=_auth_headers(), timeout=15
            )

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


def fetch_settings_from_backend():
    """
    Fetch detection settings from the Django backend.
    Falls back to .env defaults if the backend is unreachable.
    Returns: (conf_threshold, send_cooldown, data_retention_days, ocr_conf)
    """
    try:
        url = f"{BASE_URL}/api/settings/"
        response = requests.get(url, headers=_auth_headers('application/json'), timeout=5)
        if response.status_code == 200:
            data = response.json()
            conf      = float(data.get('confidence_threshold',  os.getenv('CONF', '0.6')))
            cooldown  = float(data.get('send_cooldown_seconds', os.getenv('SEND_COOLDOWN_SECONDS', '3')))
            retention = int(data.get('data_retention_days', 90))
            ocr_conf  = float(data.get('ocr_confidence',        os.getenv('OCR_CONF', '0.2')))
            print("✓ Settings loaded from backend:")
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
