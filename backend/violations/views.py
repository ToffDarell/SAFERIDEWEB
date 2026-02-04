from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Violation
from .serializers import ViolationSerializer


class ViolationViewSet(viewsets.ModelViewSet):
    queryset = Violation.objects.select_related('camera')
    serializer_class = ViolationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['detection_status', 'camera', 'classification']
    ordering_fields = ['detected_at', 'confidence_score']
    ordering = ['-detected_at']