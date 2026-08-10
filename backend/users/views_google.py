import os

from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.exceptions import Throttled, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from users.auth_security import LoginAttemptTracker
from users.models import UserProfile, get_default_operator_permissions
from users.recaptcha import validate_recaptcha_token

User = get_user_model()


class GoogleLogin(SocialLoginView):
    permission_classes = [AllowAny]
    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:5173"
    client_class = OAuth2Client


class GoogleAuthCallback(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        validate_recaptcha_token(
            request.data.get("captcha_token", ""),
            request_context=request,
        )

        from google.auth.transport import requests
        from google.oauth2 import id_token

        token = request.data.get("token")
        if not token:
            return Response({"error": "Token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            google_client_id = os.getenv("GOOGLE_CLIENT_ID")
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                google_client_id,
            )

            email = (idinfo.get("email") or "").strip().lower()
            name = idinfo.get("name")

            if not email:
                return Response({"error": "Email not provided by Google"}, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.filter(email__iexact=email).first()
            created = user is None
            if created:
                username = email.split("@")[0]
                base_username = username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{counter}"
                    counter += 1

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=name.split()[0] if name else "",
                    last_name=" ".join(name.split()[1:]) if name and len(name.split()) > 1 else "",
                )
            tracker = LoginAttemptTracker(request=request, username=user.username)
            retry_after = tracker.get_retry_after()
            if retry_after:
                raise Throttled(
                    wait=retry_after,
                    detail="Too many failed login attempts. Try again later.",
                )

            is_register = request.data.get("is_register", False)
            if is_register and not created:
                return Response(
                    {"error": "An account with this Google email already exists. Please log in instead."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Public Google registration is always limited to operator accounts.
            requested_role = "tmc_operator"

            user_profile, _ = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    "role": requested_role,
                    "status": "pending",
                    "permissions": get_default_operator_permissions() if requested_role == "tmc_operator" else {},
                },
            )

            if not (user.is_staff or user.is_superuser) and user_profile.status != "approved":
                return Response(
                    {
                        "error": "Account is not approved.",
                        "user": {
                            "id": user.id,
                            "username": user.username,
                            "email": user.email,
                            "name": f"{user.first_name} {user.last_name}".strip(),
                            "role": user_profile.role,
                            "status": user_profile.status,
                            "permissions": user_profile.get_effective_permissions(),
                        },
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            refresh = RefreshToken.for_user(user)
            tracker.reset()

            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "name": f"{user.first_name} {user.last_name}".strip(),
                    "role": user_profile.role,
                    "status": user_profile.status,
                    "permissions": user_profile.get_effective_permissions(),
                },
            })

        except Throttled:
            raise
        except ValidationError:
            raise
        except ValueError:
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
        except KeyError:
            return Response({"error": "Missing required field in Google response"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"error": "Google authentication failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)