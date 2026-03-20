from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_api_key.models import APIKey

from .models import Camera, SystemSettings


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
