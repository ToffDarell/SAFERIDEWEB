from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ViolationViewSet, ViolationExportView

router = DefaultRouter()
router.register(r'', ViolationViewSet, basename='violation')

urlpatterns = [
    path('export/', ViolationExportView.as_view(), name='violation-export'),
] + router.urls