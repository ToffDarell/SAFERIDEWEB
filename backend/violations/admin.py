from django.contrib import admin
from .models import Violation


@admin.register(Violation)
class ViolationAdmin(admin.ModelAdmin):
    list_display = ['id', 'camera', 'classification', 'detection_status', 'plate_number', 'detected_at', 'confidence_score']
    list_filter = ['detection_status', 'classification', 'camera', 'detected_at']
    search_fields = ['plate_number']
    readonly_fields = ['processed_at']
    date_hierarchy = 'detected_at'