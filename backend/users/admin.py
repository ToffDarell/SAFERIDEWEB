from django.contrib import admin
from .models import UserProfile

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