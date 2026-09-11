from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import Camera, SystemSettings
from .retention import cleanup_old_violations
from .serializers import CameraSerializer, SystemSettingsSerializer
import logging
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from users.models import AdminNotification
from users.permissions import (
    CanAccessCameraData,
    CanManageCameras,
    IsAdmin,
    IsAdminOrCanManageDetection,
    IsAdminOrReadOnly,
    IsYoloService,
)

logger = logging.getLogger(__name__)


class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer

    # Fields worth recording an old→new diff for in the Activity Log on update.
    TRACKED_FIELDS = [
        'name', 'location', 'stream_url', 'rtsp_url', 'status',
        'active_lens', 'preferred_lens', 'supports_lens_switching',
    ]

    def perform_create(self, serializer):
        camera = serializer.save()
        try:
            AdminNotification.create_for_camera_created(actor=self.request.user, camera=camera)
        except Exception:  # noqa: BLE001 - never let logging block the request
            pass

    def perform_update(self, serializer):
        old_instance = serializer.instance
        old_snapshot = {field: getattr(old_instance, field, None) for field in self.TRACKED_FIELDS}
        camera = serializer.save()
        changes = {
            field: (old_snapshot[field], getattr(camera, field, None))
            for field in self.TRACKED_FIELDS
            if old_snapshot[field] != getattr(camera, field, None)
        }
        try:
            AdminNotification.create_for_camera_updated(actor=self.request.user, camera=camera, changes=changes)
        except Exception:  # noqa: BLE001
            pass

    def perform_destroy(self, instance):
        actor = self.request.user
        camera_id = instance.id
        camera_name = instance.name
        instance.delete()
        try:
            AdminNotification.create_for_camera_deleted(actor=actor, camera_id=camera_id, camera_name=camera_name)
        except Exception:  # noqa: BLE001
            pass

    def get_permissions(self):
        auth_header = self.request.headers.get("Authorization", "")
        is_api_key = auth_header.startswith("Api-Key ")

        if self.action == 'heartbeat':
            return [IsYoloService()]
        if self.action in ['list', 'retrieve']:
            if is_api_key:
                return [IsYoloService()]
            return [CanAccessCameraData()]
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [CanManageCameras()]
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
    """GET or PATCH the singleton system settings row.

    Per the project's functional requirements, TMC Operators can only manage
    their own personal account settings (profile, password, display
    preferences) — they cannot modify global system, security, or
    notification settings. Every field on this endpoint (detection
    thresholds, data retention, and Alert Cooldown alike) is therefore
    restricted to admins / operators explicitly granted can_manage_detection.
    """

    def get_permissions(self):
        auth_header = self.request.headers.get("Authorization", "")
        if self.request.method in {"GET", "HEAD", "OPTIONS"} and auth_header.startswith("Api-Key "):
            return [IsYoloService()]
        if self.request.method in {"GET", "HEAD", "OPTIONS"}:
            return [IsAdminOrReadOnly()]
        if self.request.method == "POST":
            return [IsAdmin()]
        return [IsAdminOrCanManageDetection()]

    def get(self, request):
        settings_obj = SystemSettings.get_settings()
        return Response(SystemSettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            user = request.user
            if user and user.is_authenticated:
                profile = getattr(user, 'profile', None)
                actor_is_admin = bool(profile and profile.role == 'admin')

                # Detect which mode was applied
                new = {**serializer.data, **request.data}
                PRESETS = {
                    'Balanced': {'confidence_threshold': 0.60, 'conf_no_helmet': 0.75, 'conf_nutshell': 0.80, 'conf_helmet': 0.70, 'conf_license_plate': 0.65, 'ocr_confidence': 0.60},
                    'Sensitive': {'confidence_threshold': 0.45, 'conf_no_helmet': 0.55, 'conf_nutshell': 0.60, 'conf_helmet': 0.50, 'conf_license_plate': 0.50, 'ocr_confidence': 0.40},
                    'Strict': {'confidence_threshold': 0.75, 'conf_no_helmet': 0.85, 'conf_nutshell': 0.88, 'conf_helmet': 0.80, 'conf_license_plate': 0.78, 'ocr_confidence': 0.75},
                }
                mode_name = None
                for name, values in PRESETS.items():
                    if all(abs(float(new.get(k, 0)) - v) < 0.001 for k, v in values.items()):
                        mode_name = name
                        break

                # Always record the change in the admin Activity Log, regardless of
                # whether the actor is an operator or an admin.
                actor_label = user.get_full_name() or user.username
                activity_msg = f"{actor_label} changed detection mode to {mode_name}" if mode_name \
                    else f"{actor_label} updated detection settings (Custom)"
                AdminNotification.objects.create(
                    notification_type='settings_changed',
                    title='Detection Settings Updated',
                    message=activity_msg,
                    actor=user,
                )

                if actor_is_admin:
                    # Admin changed settings → additionally notify all operators
                    msg = f"System administrator changed detection mode to {mode_name}" if mode_name \
                        else f"System administrator updated detection settings (Custom)"
                    from users.models import UserNotification
                    from django.contrib.auth.models import User
                    operators = User.objects.filter(
                        profile__role='tmc_operator',
                        profile__status='approved',
                    )
                    UserNotification.create_for_recipients(
                        sender=user,
                        recipients=operators,
                        title='Detection Settings Updated',
                        message=msg,
                        notification_type='settings_changed',
                    )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        if not request.path.rstrip("/").endswith("/cleanup"):
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

        result = cleanup_old_violations()
        return Response(
            {
                "deleted": result.deleted,
                "cutoff_date": result.cutoff_date.isoformat() if result.cutoff_date else None,
                "retention_days": result.retention_days,
            }
        )
