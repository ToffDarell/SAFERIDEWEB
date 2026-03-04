from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import StreamingHttpResponse
from .models import Camera, SystemSettings
from .serializers import CameraSerializer, SystemSettingsSerializer
import cv2
import time
import logging
from pathlib import Path
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

# Load YOLO model once at module level (not per request)
_yolo_model = None

def get_yolo_model():
    global _yolo_model
    if _yolo_model is None:
        try:
            from ultralytics import YOLO
            model_path = Path(__file__).resolve().parent.parent.parent / 'yolo_service' / 'weights' / 'best.pt'
            if model_path.exists():
                logger.info(f"Loading YOLO model from: {model_path}")
                _yolo_model = YOLO(str(model_path))
                logger.info(f"YOLO model loaded! Classes: {_yolo_model.names}")
            else:
                logger.error(f"YOLO model NOT found at: {model_path}")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
    return _yolo_model


class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def stream(self, request, pk=None):
        """
        Stream camera feed as MJPEG with YOLO detection
        Endpoint: /api/cameras/{id}/stream/
        """
        # STEP 1: Manually validate token from query param
        token = request.GET.get('token')
        if not token:
            # Also try Authorization header as fallback
            auth_header = request.headers.get('Authorization', '')
            token = auth_header.replace('Bearer ', '').strip()

        if not token:
            return Response({"error": "Authentication required"}, status=401)

        try:
            validated_token = AccessToken(token)
            User = get_user_model()
            user = User.objects.get(id=validated_token['user_id'])
        except Exception:
            return Response({"error": "Invalid or expired token"}, status=401)

        # STEP 2: Get camera
        try:
            camera = Camera.objects.get(pk=pk)
        except Camera.DoesNotExist:
            return Response({"error": "Camera not found"}, status=404)

        if not camera.stream_url:
            return Response({"error": "Camera does not have a stream URL configured"}, status=400)

        if camera.status != 'active':
            return Response({"error": "Camera is currently offline"}, status=400)

        logger.info(f"Stream opened for: {camera.name} by user: {user.username}")

        def generate_frames():
            cap = None
            model = get_yolo_model()

            VIOLATION_CLASSES = ['no_helmet', 'nutshell', 'hat']
            COMPLIANT_CLASSES = ['helmet']

            frame_count = 0
            last_detections = []

            try:
                cap = cv2.VideoCapture(camera.stream_url)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                if not cap.isOpened():
                    logger.error(f"Cannot open stream: {camera.stream_url}")
                    return

                logger.info(f"Connected to stream: {camera.name}")

                while True:
                    success, frame = cap.read()
                    if not success:
                        logger.warning(f"Frame read failed for {camera.name}, reconnecting...")
                        cap.release()
                        time.sleep(1)
                        cap = cv2.VideoCapture(camera.stream_url)
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                        continue

                    frame_count += 1

                    if model and frame_count % 3 == 0:
                        try:
                            results = model(frame, conf=0.4, verbose=False)[0]
                            last_detections = []
                            if results.boxes is not None and len(results.boxes) > 0:
                                for box in results.boxes:
                                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                                    conf = float(box.conf[0])
                                    cls_id = int(box.cls[0])
                                    class_name = model.names[cls_id].lower()

                                    if class_name in COMPLIANT_CLASSES:
                                        color = (0, 255, 0)
                                        label = f"HELMET ({conf:.2f})"
                                    elif class_name in VIOLATION_CLASSES:
                                        color = (0, 0, 255)
                                        display = class_name.replace('_', ' ').upper()
                                        label = f"VIOLATION: {display} ({conf:.2f})"
                                    else:
                                        color = (0, 255, 255)
                                        label = f"{class_name.upper()} ({conf:.2f})"

                                    last_detections.append({
                                        'box': (x1, y1, x2, y2),
                                        'color': color,
                                        'label': label,
                                    })
                        except Exception as e:
                            logger.error(f"YOLO detection error: {e}")

                    font = cv2.FONT_HERSHEY_SIMPLEX
                    for det in last_detections:
                        x1, y1, x2, y2 = det['box']
                        color = det['color']
                        label = det['label']
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                        (tw, th), _ = cv2.getTextSize(label, font, 0.6, 2)
                        cv2.rectangle(frame, (x1, y1 - th - 10), (x1 + tw + 4, y1), color, -1)
                        cv2.putText(frame, label, (x1 + 2, y1 - 5), font, 0.6, (255, 255, 255), 2)

                    ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                    if not ret:
                        continue

                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

            except GeneratorExit:
                logger.info(f"Stream closed: {camera.name}")
            except Exception as e:
                logger.exception(f"Stream error for {camera.name}: {e}")
            finally:
                if cap:
                    cap.release()

        return StreamingHttpResponse(
            generate_frames(),
            content_type='multipart/x-mixed-replace; boundary=frame'
        )


class SystemSettingsView(APIView):
    """GET or PATCH the singleton system settings row."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings_obj = SystemSettings.get_settings()
        return Response(SystemSettingsSerializer(settings_obj).data)

    def patch(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        settings_obj = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


