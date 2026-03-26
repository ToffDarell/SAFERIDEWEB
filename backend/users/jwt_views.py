from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, Throttled
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

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
