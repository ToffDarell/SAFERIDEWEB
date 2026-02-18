import os
import sys
import cv2
import numpy as np
from ultralytics import YOLO
from dotenv import load_dotenv
import requests
from datetime import datetime
import time


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


def send_violation_to_backend(detection_data):
    try:
        url = "http://127.0.0.1:8000/api/violations/"
        token = os.getenv('API_TOKEN')
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        camera_id = int(os.getenv('CAMERA_ID', '1'))
        payload = {
            'camera': camera_id,
            'detected_at': datetime.now().isoformat(),
            'detection_status': detection_data['status'],
            'confidence_score': detection_data['confidence'],
            'classification': detection_data['classification'],
            'plate_number': detection_data.get('plate_number', ''),
            'bounding_box': detection_data.get('bounding_box', {}),
        }
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 201:
            print(f"✅ Violation sent: {payload['classification']} ({payload['confidence_score']:.2f})")
        else:
            print(f"❌ Failed to send: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error sending to backend: {e}")


def main():
    load_dotenv()

    print(f"Python executable: {sys.executable}")
    print(f"Current directory: {os.getcwd()}")
    print("-" * 60)

    rtsp_ip = os.getenv('RTSP_IP')
    rtsp_user = os.getenv('RTSP_USER')
    rtsp_pass = os.getenv('RTSP_PASS')
    stream = os.getenv('STREAM', 'stream1')
    conf_threshold = float(os.getenv('CONF', '0.4'))
    camera_id = int(os.getenv('CAMERA_ID', '1'))

    if not all([rtsp_ip, rtsp_user, rtsp_pass]):
        print("ERROR: Missing RTSP credentials in .env file")
        return

    rtsp_url = f"rtsp://{rtsp_user}:{rtsp_pass}@{rtsp_ip}:554/{stream}"
    print(f"Stream: {stream}")
    print(f"Camera ID: {camera_id}")
    print(f"Confidence threshold: {conf_threshold}")
    print("-" * 60)

    model_path = os.path.join('weights', 'best.pt')
    if not os.path.exists(model_path):
        print(f"ERROR: Model not found at {model_path}")
        return

    print(f"Loading YOLO model from: {model_path}")
    model = YOLO(model_path)
    print(f"Model loaded! Classes: {model.names}")
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

    last_heartbeat = time.time()
    heartbeat_interval = 5

    VIOLATION_CLASSES = ['no_helmet', 'nutshell', 'hat']
    COMPLIANT_CLASSES = ['helmet']

    try:
        results_generator = model(rtsp_url, stream=True, conf=conf_threshold, verbose=False)

        frame_count = 0
        for results in results_generator:
            frame_count += 1

            current_time = time.time()
            if current_time - last_heartbeat >= heartbeat_interval:
                update_camera_status(camera_id, 'active', rtsp_url)
                last_heartbeat = current_time

            annotated_frame = results.orig_img.copy()
            compliant_count = 0
            violation_count = 0

            if results.boxes is not None and len(results.boxes) > 0:
                for box in results.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    class_name = model.names[cls_id].lower()

                    if class_name in COMPLIANT_CLASSES:
                        color = (0, 255, 0)  # Green
                        label = f"COMPLIANT: Helmet ({conf:.2f})"
                        compliant_count += 1

                    elif class_name in VIOLATION_CLASSES:
                        color = (0, 0, 255)  # Red
                        display_name = class_name.replace('_', ' ').title()
                        label = f"VIOLATION: {display_name} ({conf:.2f})"
                        violation_count += 1

                        send_violation_to_backend({
                            'status': 'violation',
                            'confidence': conf,
                            'classification': class_name,
                            'bounding_box': {
                                'x1': int(x1), 'y1': int(y1),
                                'x2': int(x2), 'y2': int(y2)
                            }
                        })

                    else:
                        # license_plate
                        color = (0, 255, 255)  # Yellow
                        label = f"PLATE ({conf:.2f})"

                    # Draw bounding box
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)

                    # Draw label background
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
                print(f"Frame {frame_count} | Compliant: {compliant_count} | Violations: {violation_count}")

            # HUD overlay
            cv2.putText(annotated_frame, f"Compliant: {compliant_count}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(annotated_frame, f"Violations: {violation_count}", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

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
