from django.contrib.auth import logout as django_logout
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers, status
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, Throttled
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView

from .auth_security import LoginAttemptTracker
from .recaptcha import validate_recaptcha_token
from .throttles import LoginBurstRateThrottle, LoginSustainedRateThrottle


class ApprovedTokenObtainPairSerializer(TokenObtainPairSerializer):
    captcha_token = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get("request")
        validate_recaptcha_token(
            attrs.pop("captcha_token", ""),
            request_context=request,
        )

        tracker = LoginAttemptTracker(
            request=request,
            username=attrs.get(self.username_field),
        )
        retry_after = tracker.get_retry_after()
        if retry_after:
            raise Throttled(
                wait=retry_after,
                detail="Too many failed login attempts. Try again later.",
            )

        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            tracker.register_failure()
            raise

        tracker.reset()
        return data

    @classmethod
    def get_token(cls, user):
        profile = getattr(user, "profile", None)

        if not (user.is_staff or user.is_superuser):
            if not profile or profile.status != "approved":
                raise PermissionDenied("Account is not approved.")

        return super().get_token(user)


class ApprovedTokenObtainPairView(TokenObtainPairView):
    serializer_class = ApprovedTokenObtainPairSerializer
    throttle_classes = [LoginBurstRateThrottle, LoginSustainedRateThrottle]


class ApprovedLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = str(request.data.get("refresh", "")).strip()
        auth_header = request.headers.get("Authorization", "")

        if auth_header.startswith("Bearer ") and not refresh_token:
            return Response(
                {"detail": "Refresh token is required to securely log out a JWT session."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                return Response(
                    {"detail": "Refresh token is invalid or already revoked."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            request.user.auth_token.delete()
        except (AttributeError, ObjectDoesNotExist):
            pass

        django_logout(request)
        return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)


class DisabledLegacyLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return Response(
            {
                "detail": (
                    "This login route is disabled. "
                    "Use /api/auth/token/ so account approval rules are enforced."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )


class DisabledLegacyRegistrationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return Response(
            {
                "detail": (
                    "This registration route is disabled. "
                    "Use /api/users/ for operator registration so admin approval is enforced."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )
