from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ViolationViewSet

router = DefaultRouter()
router.register(r'', ViolationViewSet, basename='violation')

urlpatterns = router.urls