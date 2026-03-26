from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, APITestCase
from unittest.mock import patch

from cameras.models import Camera, SystemSettings
from users.models import AdminNotification, UserProfile, get_default_operator_permissions
from users.permissions import IsAdmin, IsOperator
from violations.models import Violation


class LoginAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()

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

    def test_login_is_locked_after_repeated_failed_attempts(self):
        for _ in range(5):
            response = self.client.post(
                "/api/auth/token/",
                {"username": "approved_user", "password": "wrong-password"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        locked_response = self.client.post(
            "/api/auth/token/",
            {"username": "approved_user", "password": "password123"},
            format="json",
        )

        self.assertEqual(locked_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Too many failed login attempts", str(locked_response.data["detail"]))

    @override_settings(RECAPTCHA_VERIFY_ENABLED=True)
    def test_login_requires_captcha_when_verification_is_enabled(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "approved_user", "password": "password123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("captcha_token", response.data)

    def test_successful_login_resets_failed_attempt_counter(self):
        first_failed_response = self.client.post(
            "/api/auth/token/",
            {"username": "approved_user", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(first_failed_response.status_code, status.HTTP_401_UNAUTHORIZED)

        successful_response = self.client.post(
            "/api/auth/token/",
            {"username": "approved_user", "password": "password123"},
            format="json",
        )
        self.assertEqual(successful_response.status_code, status.HTTP_200_OK)

        for _ in range(5):
            response = self.client.post(
                "/api/auth/token/",
                {"username": "approved_user", "password": "wrong-password"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        locked_response = self.client.post(
            "/api/auth/token/",
            {"username": "approved_user", "password": "password123"},
            format="json",
        )
        self.assertEqual(locked_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_respects_existing_password_lockout(self, mock_verify_token):
        mock_verify_token.return_value = {
            "email": self.approved_user.email,
            "name": "Approved User",
        }

        for _ in range(5):
            response = self.client.post(
                "/api/auth/token/",
                {"username": "approved_user", "password": "wrong-password"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        google_response = self.client.post(
            "/api/users/auth/google/callback/",
            {"token": "valid-google-token"},
            format="json",
        )

        self.assertEqual(google_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(RECAPTCHA_VERIFY_ENABLED=True)
    def test_google_login_requires_captcha_when_verification_is_enabled(self):
        response = self.client.post(
            "/api/users/auth/google/callback/",
            {"token": "valid-google-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("captcha_token", response.data)

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_registration_ignores_admin_role_request(self, mock_verify_token):
        mock_verify_token.return_value = {
            "email": "google-operator@example.com",
            "name": "Google Operator",
        }

        response = self.client.post(
            "/api/users/auth/google/callback/",
            {
                "token": "valid-google-token",
                "role": "admin",
                "is_register": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["user"]["role"], "tmc_operator")
        self.assertEqual(response.data["user"]["status"], "pending")

        created_user = User.objects.get(email="google-operator@example.com")
        self.assertFalse(created_user.is_staff)
        self.assertEqual(created_user.profile.role, "tmc_operator")

    @override_settings(RECAPTCHA_VERIFY_ENABLED=True)
    def test_registration_requires_captcha_when_verification_is_enabled(self):
        response = self.client.post(
            "/api/users/",
            {
                "username": "new_user",
                "email": "new@example.com",
                "password": "password123",
                "password_confirm": "password123",
                "first_name": "New",
                "last_name": "User",
                "role": "tmc_operator",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("captcha_token", response.data)

    def test_registration_rejects_existing_email_case_insensitively(self):
        response = self.client.post(
            "/api/users/",
            {
                "username": "new_user",
                "email": "APPROVED@EXAMPLE.COM",
                "password": "password123",
                "password_confirm": "password123",
                "first_name": "New",
                "last_name": "User",
                "role": "tmc_operator",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertEqual(
            User.objects.filter(email__iexact="approved@example.com").count(),
            1,
        )


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

    def test_is_admin_allows_admin_only(self):
        permission = IsAdmin()
        request = self.factory.get("/api/users/pending/")
        request.user = self.admin_user
        self.assertTrue(permission.has_permission(request, None))

        request.user = self.operator_user
        self.assertFalse(permission.has_permission(request, None))

    def test_export_permissions_require_opt_in_for_operator(self):
        self.client.force_authenticate(user=self.operator_user)
        response = self.client.get("/api/violations/export/?export_format=csv")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.operator_user.profile.permissions = {
            **get_default_operator_permissions(),
            "can_export_reports": True,
        }
        self.operator_user.profile.save(update_fields=["permissions"])

        response = self.client.get("/api/violations/export/?export_format=csv")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/violations/export/?export_format=csv")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_can_patch_operator_permissions_and_ignore_unknown_keys(self):
        self.client.force_authenticate(user=self.operator_user)
        response = self.client.patch(
            f"/api/users/{self.operator_user.id}/permissions/",
            {"can_export_reports": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.patch(
            f"/api/users/{self.operator_user.id}/permissions/",
            {"can_export_reports": True, "unknown_key": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["can_export_reports"])
        self.assertNotIn("unknown_key", response.data)

        self.operator_user.profile.refresh_from_db()
        self.assertTrue(self.operator_user.profile.permissions["can_export_reports"])

    def test_user_list_and_me_include_permissions(self):
        self.client.force_authenticate(user=self.admin_user)
        list_response = self.client.get("/api/users/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        payload = list_response.data if isinstance(list_response.data, list) else list_response.data.get("results", [])
        operator_payload = next(item for item in payload if item["id"] == self.operator_user.id)
        self.assertEqual(
            operator_payload["permissions"],
            get_default_operator_permissions(),
        )

        operator_client = APIClient()
        self.operator_user.refresh_from_db()
        operator_client.force_authenticate(user=self.operator_user)
        me_response = operator_client.get("/api/users/me/")
        self.assertEqual(
            me_response.status_code,
            status.HTTP_200_OK,
            getattr(me_response, "data", getattr(me_response, "content", b"")),
        )
        self.assertEqual(me_response.data["permissions"], get_default_operator_permissions())

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

    def test_admin_can_delete_notification(self):
        notification = AdminNotification.objects.create(
            actor=self.operator_user,
            violation=self.violation,
            title='Operator updated a violation action',
            message='Operator changed a violation.',
        )
        self.client.force_authenticate(user=self.admin_user)

        delete_response = self.client.delete(
            f'/api/users/admin-notifications/{notification.id}/delete/'
        )

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(AdminNotification.objects.filter(id=notification.id).exists())

    def test_admin_notification_scope_filters_alerts_and_activity(self):
        AdminNotification.objects.create(
            actor=self.operator_user,
            violation=self.violation,
            notification_type='violation_action',
            title='Operator updated a violation action',
            message='Operator changed a violation.',
        )
        AdminNotification.objects.create(
            actor=self.operator_user,
            violation=self.violation,
            notification_type='evidence_view',
            title='Evidence image viewed',
            message='Operator viewed evidence.',
        )
        self.client.force_authenticate(user=self.admin_user)

        alert_response = self.client.get('/api/users/admin-notifications/')
        self.assertEqual(alert_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(alert_response.data), 1)
        self.assertEqual(alert_response.data[0]['notification_type'], 'violation_action')

        activity_response = self.client.get('/api/users/admin-notifications/', {'scope': 'activity'})
        self.assertEqual(activity_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(activity_response.data), 2)
        self.assertEqual(
            {entry['notification_type'] for entry in activity_response.data},
            {'violation_action', 'evidence_view'},
        )
