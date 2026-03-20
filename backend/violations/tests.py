from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_api_key.models import APIKey

from cameras.models import Camera
from users.models import UserProfile
from violations.models import Violation


class ViolationAnalyticsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="operator",
            email="operator@example.com",
            password="password123",
        )
        UserProfile.objects.update_or_create(
            user=self.user,
            defaults={"role": "tmc_operator", "status": "approved"},
        )

        self.camera_a = Camera.objects.create(
            name="Camera A",
            location="North Road",
            stream_url="rtsp://example.com/a",
        )
        self.camera_b = Camera.objects.create(
            name="Camera B",
            location="South Road",
            stream_url="rtsp://example.com/b",
        )

        now = timezone.now()
        today = now
        two_days_ago = now - timedelta(days=2)
        six_days_ago = now - timedelta(days=6)
        eight_days_ago = now - timedelta(days=8)

        Violation.objects.create(
            camera=self.camera_a,
            detected_at=today,
            detection_status="violation",
            confidence_score=0.91,
            classification="no_helmet",
            review_status="pending",
        )
        Violation.objects.create(
            camera=self.camera_a,
            detected_at=today,
            detection_status="violation",
            confidence_score=0.83,
            classification="nutshell",
            review_status="reviewed",
        )
        Violation.objects.create(
            camera=self.camera_b,
            detected_at=two_days_ago,
            detection_status="violation",
            confidence_score=0.78,
            classification="helmet",
            review_status="pending",
        )
        Violation.objects.create(
            camera=self.camera_b,
            detected_at=six_days_ago,
            detection_status="violation",
            confidence_score=0.88,
            classification="license_plate",
            review_status="resolved",
        )
        Violation.objects.create(
            camera=self.camera_b,
            detected_at=eight_days_ago,
            detection_status="violation",
            confidence_score=0.72,
            classification="no_helmet",
            review_status="pending",
        )

    def test_summary_endpoint_returns_full_dataset_counts(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/violations/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_violations"], 5)
        self.assertEqual(response.data["pending_violations"], 3)
        self.assertEqual(response.data["today_violations"], 2)
        self.assertEqual(response.data["this_week_violations"], 4)

        by_class = {item["classification"]: item["count"] for item in response.data["by_class"]}
        self.assertEqual(by_class["no_helmet"], 2)
        self.assertEqual(by_class["helmet"], 1)
        self.assertEqual(by_class["nutshell"], 1)
        self.assertEqual(by_class["license_plate"], 1)

        by_camera = {item["camera_name"]: item["count"] for item in response.data["by_camera"]}
        self.assertEqual(by_camera["Camera A"], 2)
        self.assertEqual(by_camera["Camera B"], 3)

    def test_weekly_chart_endpoint_returns_last_seven_days(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/violations/weekly-chart/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 7)

        counts_by_date = {item["date"]: item["count"] for item in response.data}
        today = timezone.localdate().isoformat()
        two_days_ago = (timezone.localdate() - timedelta(days=2)).isoformat()
        six_days_ago = (timezone.localdate() - timedelta(days=6)).isoformat()
        eight_days_ago = (timezone.localdate() - timedelta(days=8)).isoformat()

        self.assertEqual(counts_by_date[today], 2)
        self.assertEqual(counts_by_date[two_days_ago], 1)
        self.assertEqual(counts_by_date[six_days_ago], 1)
        self.assertNotIn(eight_days_ago, counts_by_date)


class ViolationServiceAuthTests(APITestCase):
    def setUp(self):
        self.camera = Camera.objects.create(
            name="Service Camera",
            location="South Road",
            stream_url="rtsp://example.com/service",
        )
        _, self.api_key = APIKey.objects.create_key(name="YOLO Service")

    def test_api_key_can_create_violation(self):
        payload = {
            "camera": self.camera.id,
            "detected_at": timezone.now().isoformat(),
            "detection_status": "violation",
            "confidence_score": 0.94,
            "classification": "no_helmet",
            "plate_number": "ABC123",
            "bounding_box": {"x1": 1, "y1": 2, "x2": 3, "y2": 4},
        }

        response = self.client.post(
            "/api/violations/",
            payload,
            format="json",
            HTTP_AUTHORIZATION=f"Api-Key {self.api_key}",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Violation.objects.count(), 1)
        self.assertEqual(Violation.objects.get().classification, "no_helmet")
