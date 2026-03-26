from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import Camera, SystemSettings
from .serializers import CameraSerializer, SystemSettingsSerializer
import logging
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from users.permissions import (
    CanAccessCameraData,
    IsAdmin,
    IsAdminOrReadOnly,
    IsYoloService,
)

logger = logging.getLogger(__name__)


class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [CanAccessCameraData()]
        if self.action == 'heartbeat':
            return [IsYoloService()]
        return [IsAdmin()]

    @action(detail=True, methods=['post'], url_path='heartbeat')
    def heartbeat(self, request, pk=None):
        """
        Update camera liveliness details from the YOLO service.
        Endpoint: /api/cameras/{id}/heartbeat/
        """
        camera = self.get_object()
        status_value = request.data.get('status', 'active')

        if status_value not in dict(Camera.STATUS_CHOICES):
            return Response(
                {"status": ["Invalid status value."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        heartbeat_payload = {
            'status': status_value,
            'stream_url': request.data.get('stream_url', camera.stream_url),
            'last_seen_at': request.data.get('last_seen_at') or timezone.now(),
        }

        serializer = CameraSerializer(camera, data=heartbeat_payload, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class SystemSettingsView(APIView):
    """GET or PATCH the singleton system settings row."""

    def get_permissions(self):
        auth_header = self.request.headers.get("Authorization", "")
        if self.request.method in {"GET", "HEAD", "OPTIONS"} and auth_header.startswith("Api-Key "):
            return [IsYoloService()]
        return [IsAdminOrReadOnly()]

    def get(self, request):
        settings_obj = SystemSettings.get_settings()
        return Response(SystemSettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
