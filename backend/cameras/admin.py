from django.contrib import admin
from .models import Camera


@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    list_display = ['name', 'location', 'status', 'last_seen_at', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'location']
    readonly_fields = ['created_at', 'updated_at']