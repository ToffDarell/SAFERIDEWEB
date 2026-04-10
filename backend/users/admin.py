from django.contrib import admin
from .models import AdminNotification, UserNotification, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'status', 'organization', 'created_at']
    list_filter = ['role', 'status', 'created_at']
    search_fields = ['user__username', 'user__email', 'organization']
    readonly_fields = ['created_at', 'approved_at']
    
    actions = ['approve_users', 'reject_users']
    
    def approve_users(self, request, queryset):
        queryset.update(status='approved')
    approve_users.short_description = "Approve selected users"
    
    def reject_users(self, request, queryset):
        queryset.update(status='rejected')
    reject_users.short_description = "Reject selected users"


@admin.register(AdminNotification)
class AdminNotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'actor', 'violation', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['title', 'message', 'actor__username', 'actor__email', 'violation__plate_number']
    readonly_fields = ['title', 'message', 'notification_type', 'actor', 'violation', 'created_at']


@admin.register(UserNotification)
class UserNotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'recipient', 'sender', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['title', 'message', 'recipient__username', 'recipient__email', 'sender__username', 'sender__email']
    readonly_fields = ['title', 'message', 'notification_type', 'sender', 'recipient', 'created_at']
