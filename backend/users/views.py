from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from cameras.models import Camera, SystemSettings
from cameras.serializers import CameraSerializer
from violations.models import Violation
from violations.serializers import ViolationSerializer

from .models import (
    AdminNotification,
    DEFAULT_OPERATOR_PERMISSIONS,
    UserNotification,
    UserProfile,
    get_default_operator_permissions,
)
from .permissions import IsAdmin, IsApprovedUser, is_admin_user
from .serializers import (
    AdminNotificationSerializer,
    UserNotificationSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    @staticmethod
    def _build_user_payload(user):
        profile = getattr(user, "profile", None)
        role = profile.role if profile else ("admin" if is_admin_user(user) else "tmc_operator")
        status_value = profile.status if profile else "approved"
        permissions = (
            profile.get_effective_permissions()
            if profile and hasattr(profile, "get_effective_permissions")
            else (get_default_operator_permissions() if role == "tmc_operator" else {})
        )
        payload = UserSerializer(user).data
        payload.update(
            {
                "role": role,
                "status": status_value,
                "permissions": permissions,
            }
        )
        if isinstance(payload.get("profile"), dict):
            payload["profile"]["role"] = role
            payload["profile"]["status"] = status_value
            payload["profile"]["permissions"] = permissions
        return payload

    @staticmethod
    def _build_violation_summary(queryset):
        today = timezone.localdate()
        return {
            "total_violations": queryset.count(),
            "pending_violations": queryset.filter(review_status="pending").count(),
            "reviewed_violations": queryset.filter(review_status="reviewed").count(),
            "resolved_violations": queryset.filter(review_status="resolved").count(),
            "today_violations": queryset.filter(detected_at__date=today).count(),
        }

    @staticmethod
    def _build_camera_overview(cameras):
        active_cameras = sum(1 for camera in cameras if camera.is_live())
        total_cameras = len(cameras)
        return {
            "total_cameras": total_cameras,
            "active_cameras": active_cameras,
            "inactive_cameras": total_cameras - active_cameras,
        }

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return User.objects.none()
        if is_admin_user(user):
            return User.objects.all().order_by("id")
        return User.objects.filter(id=user.id)

    def get_permissions(self):
        request_path = self.request.path.rstrip("/")
        if self.action == "create":
            return [AllowAny()]
        if self.action in [
            "me",
            "preferences",
            "update_me",
            "change_password",
            "dashboard",
            "notifications",
            "mark_notification_read",
            "mark_all_notifications_read",
        ] or request_path.endswith("/users/me") or request_path.endswith("/users/change-password"):
            return [IsApprovedUser()]
        return [IsAdmin()]

    def get_serializer_class(self):
        if self.action == "create":
            return UserRegistrationSerializer
        return UserSerializer

    @action(detail=False, methods=["get"])
    def me(self, request):
        return Response(self._build_user_payload(request.user))

    @action(detail=False, methods=["get", "patch"], url_path="preferences")
    def preferences(self, request):
        profile = getattr(request.user, "profile", None)
        if not profile:
            return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)
        if request.method.lower() == "patch":
            request.user.first_name = request.data.get("first_name", request.user.first_name)
            request.user.last_name = request.data.get("last_name", request.user.last_name)
            request.user.email = request.data.get("email", request.user.email)
            request.user.save()

            profile.phone = request.data.get("phone", profile.phone)
            profile.organization = request.data.get("organization", profile.organization)
            if "display_preferences" in request.data:
                profile.display_preferences = request.data.get("display_preferences")
            profile.save()

            return Response(
                {
                    "detail": "Preferences updated.",
                    "display_preferences": profile.get_display_preferences(),
                }
            )

        return Response(
            {
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "email": request.user.email,
                "phone": profile.phone,
                "organization": profile.organization,
                "display_preferences": profile.get_display_preferences(),
            }
        )

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        violations = Violation.objects.select_related("camera", "reviewed_by__profile").order_by("-detected_at")
        recent_violations = violations[:5]
        cameras = list(Camera.objects.all())
        base_payload = {
            "summary": self._build_violation_summary(violations),
            "recent_detections": ViolationSerializer(
                recent_violations,
                many=True,
                context={"request": request},
            ).data,
            "camera_overview": self._build_camera_overview(cameras),
            "camera_statuses": CameraSerializer(
                cameras,
                many=True,
                context={"request": request},
            ).data,
        }

        if is_admin_user(request.user):
            alert_queryset = AdminNotification.objects.select_related(
                "actor",
                "actor__profile",
                "violation",
            ).filter(
                notification_type__in=AdminNotification.get_alert_notification_types()
            )
            unread_alerts = alert_queryset.filter(is_read=False)
            base_payload.update(
                {
                    "role": "admin",
                    "system_alert_count": unread_alerts.count(),
                    "system_alerts": AdminNotificationSerializer(
                        unread_alerts[:10],
                        many=True,
                    ).data,
                }
            )
            settings_obj = SystemSettings.get_settings()
            base_payload["settings_snapshot"] = {
                "notify_on_new_detection": settings_obj.notify_on_new_detection,
                "notify_on_operator_activity": settings_obj.notify_on_operator_activity,
                "notify_on_camera_offline": settings_obj.notify_on_camera_offline,
                "database_backup_enabled": settings_obj.database_backup_enabled,
                "database_backup_frequency_hours": settings_obj.database_backup_frequency_hours,
            }
            return Response(base_payload)

        user_notifications = UserNotification.objects.filter(recipient=request.user)
        base_payload.update(
            {
                "role": "tmc_operator",
                "unread_notification_count": user_notifications.filter(is_read=False).count(),
                "notifications": UserNotificationSerializer(
                    user_notifications[:10],
                    many=True,
                ).data,
            }
        )
        return Response(base_payload)

    @action(detail=False, methods=["get"], permission_classes=[IsAdmin])
    def pending(self, request):
        pending_users = User.objects.filter(profile__status="pending")
        serializer = self.get_serializer(pending_users, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        user = self.get_object()
        profile = user.profile
        profile.status = "approved"
        profile.approved_by = request.user
        profile.approved_at = timezone.now()
        profile.save()

        if profile.role == "admin" and not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        return Response({"message": f"User {user.username} approved"})

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def reject(self, request, pk=None):
        user = self.get_object()
        profile = user.profile
        profile.status = "rejected"
        profile.approved_by = None
        profile.approved_at = None
        profile.save()

        if user.is_staff and not user.is_superuser:
            user.is_staff = False
            user.save(update_fields=["is_staff"])

        return Response({"message": f"User {user.username} rejected"})

    @action(detail=False, methods=["post"], url_path="create-operator", permission_classes=[IsAdmin])
    def create_operator(self, request):
        name = request.data.get("name", "").strip()
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "").strip()
        requested_role = request.data.get("role", "tmc_operator").strip()
        min_length = max(1, SystemSettings.get_settings().password_min_length)

        if requested_role not in ["admin", "tmc_operator"]:
            requested_role = "tmc_operator"

        if not email or not password:
            return Response(
                {"error": "Email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < min_length:
            return Response(
                {"error": f"Password must be at least {min_length} characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {"error": "A user with this email already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = name.replace(" ", "_").lower() if name else email.split("@")[0]
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        name_parts = name.split(" ", 1)
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        if requested_role == "admin":
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "role": requested_role,
                "status": "approved",
                "permissions": get_default_operator_permissions() if requested_role == "tmc_operator" else {},
                "approved_by": request.user,
                "approved_at": timezone.now(),
            },
        )

        return Response(
            {"detail": f"{requested_role.capitalize()} '{username}' created successfully."},
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch"],
        url_path="permissions",
        url_name="permissions",
        permission_classes=[IsAdmin],
    )
    def permissions(self, request, pk=None):
        user = self.get_object()
        profile = getattr(user, "profile", None)

        if not profile:
            return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)

        if profile.role != "tmc_operator":
            return Response(
                {"error": "Permissions can only be updated for TMC Operators."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(request.data, dict):
            return Response({"error": "A permission object is required."}, status=status.HTTP_400_BAD_REQUEST)

        updated_permissions = profile.get_effective_permissions()
        for key, value in request.data.items():
            if key in DEFAULT_OPERATOR_PERMISSIONS:
                updated_permissions[key] = bool(value)

        profile.permissions = updated_permissions
        profile.save(update_fields=["permissions"])

        return Response(profile.get_effective_permissions())

    @action(detail=False, methods=["patch"], url_path="me")
    def update_me(self, request):
        user = request.user
        profile = getattr(user, "profile", None)
        user.first_name = request.data.get("first_name", user.first_name)
        user.last_name = request.data.get("last_name", user.last_name)
        user.email = request.data.get("email", user.email)
        user.save()
        if profile:
            profile.phone = request.data.get("phone", profile.phone)
            profile.organization = request.data.get("organization", profile.organization)
            if "display_preferences" in request.data:
                profile.display_preferences = request.data.get("display_preferences")
            profile.save()
        return Response({"detail": "Profile updated."})

    @action(detail=False, methods=["get"], url_path="admin-notifications", permission_classes=[IsAdmin])
    def admin_notifications(self, request):
        unread_only = str(request.query_params.get("unread_only", "")).lower() in {"1", "true", "yes"}
        scope = str(request.query_params.get("scope", "alerts")).lower()
        queryset = AdminNotification.objects.select_related(
            "actor",
            "actor__profile",
            "violation",
        )
        if scope == "activity":
            queryset = queryset.filter(
                notification_type__in=AdminNotification.get_activity_notification_types()
            )
        else:
            queryset = queryset.filter(
                notification_type__in=AdminNotification.get_alert_notification_types()
            )
        if unread_only:
            queryset = queryset.filter(is_read=False)

        serializer = AdminNotificationSerializer(queryset[:50], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="notifications")
    def notifications(self, request):
        unread_only = str(request.query_params.get("unread_only", "")).lower() in {"1", "true", "yes"}
        queryset = UserNotification.objects.filter(recipient=request.user)
        if unread_only:
            queryset = queryset.filter(is_read=False)
        serializer = UserNotificationSerializer(queryset[:50], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="notifications/send", permission_classes=[IsAdmin])
    def send_notification(self, request):
        title = str(request.data.get("title", "")).strip()
        message = str(request.data.get("message", "")).strip()
        send_to_all = bool(request.data.get("send_to_all", False))
        recipient_ids = request.data.get("recipient_ids", [])

        if not title or not message:
            return Response(
                {"error": "Title and message are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        recipients = User.objects.filter(profile__status="approved").exclude(id=request.user.id)
        if not send_to_all:
            if not isinstance(recipient_ids, list) or not recipient_ids:
                return Response(
                    {"error": "Provide recipient_ids or set send_to_all to true."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            recipients = recipients.filter(id__in=recipient_ids)

        created_notifications = UserNotification.create_for_recipients(
            sender=request.user,
            recipients=recipients,
            title=title,
            message=message,
        )
        return Response(
            {"detail": f"Update sent to {len(created_notifications)} user(s)."},
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path=r"notifications/(?P<notification_id>\d+)/mark-read",
    )
    def mark_notification_read(self, request, notification_id=None):
        updated = UserNotification.objects.filter(
            id=notification_id,
            recipient=request.user,
        ).update(is_read=True)
        if not updated:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"detail": "Notification marked as read."})

    @action(detail=False, methods=["post"], url_path="notifications/mark-all-read")
    def mark_all_notifications_read(self, request):
        updated = UserNotification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).update(is_read=True)
        return Response({"detail": f"{updated} notification(s) marked as read."})

    @action(
        detail=False,
        methods=["post"],
        url_path=r"admin-notifications/(?P<notification_id>\d+)/mark-read",
        permission_classes=[IsAdmin],
    )
    def mark_admin_notification_read(self, request, notification_id=None):
        updated = AdminNotification.objects.filter(id=notification_id).update(is_read=True)
        if not updated:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"detail": "Notification marked as read."})

    @action(
        detail=False,
        methods=["post"],
        url_path="admin-notifications/mark-all-read",
        permission_classes=[IsAdmin],
    )
    def mark_all_admin_notifications_read(self, request):
        scope = str(request.query_params.get("scope", "alerts")).lower()
        queryset = AdminNotification.objects.filter(is_read=False)
        if scope == "activity":
            queryset = queryset.filter(
                notification_type__in=AdminNotification.get_activity_notification_types()
            )
        else:
            queryset = queryset.filter(
                notification_type__in=AdminNotification.get_alert_notification_types()
            )
        updated = queryset.update(is_read=True)
        return Response({"detail": f"{updated} notification(s) marked as read."})

    @action(
        detail=False,
        methods=["delete"],
        url_path=r"admin-notifications/(?P<notification_id>\d+)/delete",
        permission_classes=[IsAdmin],
    )
    def delete_admin_notification(self, request, notification_id=None):
        deleted, _ = AdminNotification.objects.filter(id=notification_id).delete()
        if not deleted:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="change-password")
    def change_password(self, request):
        user = request.user
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        min_length = max(1, SystemSettings.get_settings().password_min_length)

        if not user.check_password(current_password):
            return Response(
                {"error": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < min_length:
            return Response(
                {"error": f"New password must be at least {min_length} characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()
        return Response({"detail": "Password changed successfully."})
