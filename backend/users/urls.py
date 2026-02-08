from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import UserViewSet
from .views_google import GoogleLogin, GoogleAuthCallback

router = SimpleRouter()
router.register(r'', UserViewSet, basename='user')

urlpatterns = [
    path('auth/google/', GoogleLogin.as_view(), name='google_login'),
    path('auth/google/callback/', GoogleAuthCallback.as_view(), name='google_auth_callback'),
] + router.urls