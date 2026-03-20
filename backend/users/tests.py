from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, APITestCase

from cameras.models import Camera, SystemSettings
from users.models import AdminNotification, UserProfile
from users.permissions import IsAdmin, IsOperator
from violations.models import Violation


class LoginAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.approved_user = User.objects.create_user(
            username="approved_user",
            email="approved@example.com",
            password="password123",
        )
        UserProfile.objects.update_or_create(
            user=self.approved_user,
            defaults={"role": "tmc_operator", "status": "approved"},
        )

        self.pending_user = User.objects.create_user(
            username="pending_login",
            email="pending-login@example.com",
            password="password123",
        )
        UserProfile.objects.update_or_create(
            user=self.pending_user,
            defaults={"role": "tmc_operator", "status": "pending"},
        )

    def test_login_with_valid_credentials_returns_tokens(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "approved_user", "password": "password123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_with_invalid_credentials_returns_unauthorized(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "approved_user", "password": "wrong-password"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("detail", response.data)

    def test_login_with_pending_account_returns_forbidden_message(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "pending_login", "password": "password123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(str(response.data["detail"]), "Account is not approved.")


class RolePermissionTests(APITestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

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

        self.pending_user = User.objects.create_user(
            username="pending_user",
            email="pending@example.com",
            password="password123",
        )
        UserProfile.objects.update_or_create(
            user=self.pending_user,
            defaults={"role": "tmc_operator", "status": "pending"},
        )

        self.camera = Camera.objects.create(
            name="Main Road Camera",
            location="Main Road",
            stream_url="rtsp://example.com/stream",
        )
        self.violation = Violation.objects.create(
            camera=self.camera,
            detected_at=timezone.now(),
            detection_status="violation",
            confidence_score=0.91,
            classification="no_helmet",
            plate_number="ABC123",
            review_status="pending",
        )
        SystemSettings.get_settings()

    def test_is_admin_allows_admin_only_and_protects_exports(self):
        permission = IsAdmin()
        request = self.factory.get("/api/violations/export/")
        request.user = self.admin_user
        self.assertTrue(permission.has_permission(request, None))

        request.user = self.operator_user
        self.assertFalse(permission.has_permission(request, None))

        self.client.force_authenticate(user=self.operator_user)
        response = self.client.get("/api/violations/export/?export_format=csv")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/violations/export/?export_format=csv")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_is_operator_allows_operator_only(self):
        permission = IsOperator()
        request = self.factory.get("/api/operators-only/")
        request.user = self.operator_user
        self.assertTrue(permission.has_permission(request, None))

        request.user = self.admin_user
        self.assertFalse(permission.has_permission(request, None))

    def test_is_admin_or_read_only_allows_operator_get_but_blocks_patch(self):
        self.client.force_authenticate(user=self.operator_user)
        get_response = self.client.get("/api/settings/")
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)

        patch_response = self.client.patch(
            "/api/settings/",
            {"confidence_threshold": 0.75},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin_user)
        admin_patch_response = self.client.patch(
            "/api/settings/",
            {"confidence_threshold": 0.75},
            format="json",
        )
        self.assertEqual(admin_patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_patch_response.data["confidence_threshold"], 0.75)

    def test_operator_cannot_approve_pending_registration(self):
        self.client.force_authenticate(user=self.operator_user)
        operator_response = self.client.post(f"/api/users/{self.pending_user.id}/approve/")
        self.assertEqual(operator_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin_user)
        admin_response = self.client.post(f"/api/users/{self.pending_user.id}/approve/")
        self.assertEqual(admin_response.status_code, status.HTTP_200_OK)

    def test_operator_cannot_create_operator_account(self):
        payload = {
            "name": "New Operator",
            "email": "new-operator@example.com",
            "password": "password123",
            "role": "tmc_operator",
        }

        self.client.force_authenticate(user=self.operator_user)
        operator_response = self.client.post("/api/users/create-operator/", payload, format="json")
        self.assertEqual(operator_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin_user)
        admin_response = self.client.post("/api/users/create-operator/", payload, format="json")
        self.assertEqual(admin_response.status_code, status.HTTP_201_CREATED)


class AdminNotificationTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='password123',
            is_staff=True,
        )
        UserProfile.objects.update_or_create(
            user=self.admin_user,
            defaults={'role': 'admin', 'status': 'approved'},
        )

        self.operator_user = User.objects.create_user(
            username='operator',
            email='operator@example.com',
            password='password123',
            first_name='Traffic',
            last_name='Operator',
        )
        UserProfile.objects.update_or_create(
            user=self.operator_user,
            defaults={'role': 'tmc_operator', 'status': 'approved'},
        )

        self.camera = Camera.objects.create(
            name='Main Road Camera',
            location='Main Road',
            stream_url='rtsp://example.com/stream',
        )
        self.violation = Violation.objects.create(
            camera=self.camera,
            detected_at=timezone.now(),
            detection_status='violation',
            confidence_score=0.91,
            classification='no_helmet',
            plate_number='ABC123',
            review_status='pending',
        )

    def test_operator_violation_action_creates_admin_notification(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.patch(
            f'/api/violations/{self.violation.id}/',
            {'review_status': 'reviewed'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification = AdminNotification.objects.get()
        self.assertEqual(notification.actor, self.operator_user)
        self.assertEqual(notification.violation, self.violation)
        self.assertFalse(notification.is_read)
        self.assertIn('Traffic Operator', notification.message)
        self.assertIn('Pending', notification.message)
        self.assertIn('Reviewed', notification.message)

    def test_admin_violation_action_does_not_create_notification(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            f'/api/violations/{self.violation.id}/',
            {'review_status': 'reviewed'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(AdminNotification.objects.count(), 0)

    def test_admin_can_list_and_mark_notifications_read(self):
        notification = AdminNotification.objects.create(
            actor=self.operator_user,
            violation=self.violation,
            title='Operator updated a violation action',
            message='Operator changed a violation.',
        )
        self.client.force_authenticate(user=self.admin_user)

        list_response = self.client.get('/api/users/admin-notifications/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]['id'], notification.id)

        read_response = self.client.post(
            f'/api/users/admin-notifications/{notification.id}/mark-read/'
        )
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)

        notification.refresh_from_db()
        self.assertTrue(notification.is_read)
