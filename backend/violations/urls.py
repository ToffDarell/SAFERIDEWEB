from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ViolationSummaryView, ViolationViewSet, ViolationWeeklyChartView

router = DefaultRouter()
router.register(r'', ViolationViewSet, basename='violation')

urlpatterns = [
    path('summary/', ViolationSummaryView.as_view(), name='violation-summary'),
    path('weekly-chart/', ViolationWeeklyChartView.as_view(), name='violation-weekly-chart'),
] + router.urls
