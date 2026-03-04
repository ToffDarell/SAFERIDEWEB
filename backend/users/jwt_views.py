from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class ApprovedTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        profile = getattr(user, "profile", None)

        if not (user.is_staff or user.is_superuser):
            if not profile or profile.status != "approved":
                raise AuthenticationFailed("Account is not approved.")

        return super().get_token(user)


class ApprovedTokenObtainPairView(TokenObtainPairView):
    serializer_class = ApprovedTokenObtainPairSerializer
