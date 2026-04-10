from datetime import timedelta

from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_api_key.models import APIKey

from .models import Camera, SystemSettings
from users.models import UserProfile, get_default_operator_permissions


class CameraServiceAuthTests(APITestCase):
    def setUp(self):
        self.camera = Camera.objects.create(
            name="YOLO Camera",
            location="Main Road",
            stream_url="rtsp://example.com/live",
            status="inactive",
        )
        self.settings = SystemSettings.get_settings()
        _, self.api_key = APIKey.objects.create_key(name="YOLO Service")

    def test_api_key_can_post_camera_heartbeat(self):
        response = self.client.post(
            f"/api/cameras/{self.camera.id}/heartbeat/",
            {
                "status": "active",
                "stream_url": "rtsp://example.com/updated",
                "last_seen_at": timezone.now().isoformat(),
            },
            format="json",
            HTTP_AUTHORIZATION=f"Api-Key {self.api_key}",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.camera.refresh_from_db()
        self.assertEqual(self.camera.status, "active")
        self.assertEqual(self.camera.stream_url, "rtsp://example.com/updated")
        self.assertIsNotNone(self.camera.last_seen_at)

    def test_api_key_can_read_system_settings(self):
        response = self.client.get(
            "/api/settings/",
            HTTP_AUTHORIZATION=f"Api-Key {self.api_key}",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("confidence_threshold", response.data)
        self.assertIn("notify_on_new_detection", response.data)
        self.assertIn("database_backup_enabled", response.data)


class CameraReadPermissionTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="password123",
            is_staff=True,
        )
        UserProfile.objects.update_or_create(
            user=self.admin_user,
            defaults={"role": "admin", "status": "approved"},
        )

        self.operator_user = User.objects.create_user(
            username="operator",
            email="operator@example.com",
            password="password123",
        )
        UserProfile.objects.update_or_create(
            user=self.operator_user,
            defaults={"role": "tmc_operator", "status": "approved"},
        )

        self.camera = Camera.objects.create(
            name="North Camera",
            location="North Road",
            stream_url="http://127.0.0.1:8081/stream",
            status="active",
        )

    def test_operator_without_camera_related_permissions_cannot_list_cameras(self):
        self.operator_user.profile.permissions = {
            **get_default_operator_permissions(),
            "can_view_cameras": False,
            "can_view_live_monitor": False,
            "can_view_reports": False,
        }
        self.operator_user.profile.save(update_fields=["permissions"])
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get("/api/cameras/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_operator_with_reports_permission_can_list_cameras_but_stream_is_redacted(self):
        self.operator_user.profile.permissions = {
            **get_default_operator_permissions(),
            "can_view_cameras": False,
            "can_view_live_monitor": False,
            "can_view_reports": True,
        }
        self.operator_user.profile.save(update_fields=["permissions"])
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get("/api/cameras/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data if isinstance(response.data, list) else response.data.get("results", [])
        self.assertEqual(payload[0]["stream_url"], "")

    def test_operator_with_live_monitor_permission_can_access_stream_url(self):
        self.operator_user.profile.permissions = {
            **get_default_operator_permissions(),
            "can_view_cameras": False,
            "can_view_live_monitor": True,
            "can_view_reports": False,
        }
        self.operator_user.profile.save(update_fields=["permissions"])
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(f"/api/cameras/{self.camera.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["stream_url"], self.camera.stream_url)

    def test_camera_with_stale_heartbeat_is_serialized_as_inactive(self):
        self.camera.last_seen_at = timezone.now() - timedelta(seconds=30)
        self.camera.save(update_fields=["last_seen_at"])
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(f"/api/cameras/{self.camera.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "inactive")
        self.assertFalse(response.data["is_live"])

    def test_camera_with_recent_heartbeat_is_serialized_as_active(self):
        self.camera.last_seen_at = timezone.now()
        self.camera.save(update_fields=["last_seen_at"])
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(f"/api/cameras/{self.camera.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "active")
        self.assertTrue(response.data["is_live"])

    def test_admin_can_update_notification_and_database_preferences_in_settings(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            "/api/settings/",
            {
                "notify_on_new_detection": False,
                "notify_on_operator_activity": False,
                "database_backup_enabled": False,
                "database_backup_frequency_hours": 12,
                "database_backup_retention_days": 14,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["notify_on_new_detection"])
        self.assertFalse(response.data["notify_on_operator_activity"])
        self.assertFalse(response.data["database_backup_enabled"])
        self.assertEqual(response.data["database_backup_frequency_hours"], 12)
        self.assertEqual(response.data["database_backup_retention_days"], 14)
