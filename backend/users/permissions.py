from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework_api_key.permissions import HasAPIKey

from .models import DEFAULT_OPERATOR_PERMISSIONS, UserProfile


def get_user_profile(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None

    if user.is_staff or user.is_superuser:
        return None

    return UserProfile.objects.filter(user=user).first()


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None

    if user.is_staff or user.is_superuser:
        return "admin"

    profile = get_user_profile(user)
    if profile and profile.role:
        return profile.role

    return None


def is_admin_user(user):
    return get_user_role(user) == "admin"


def is_operator_user(user):
    return get_user_role(user) == "tmc_operator"


def get_user_permissions(user):
    if not user or not user.is_authenticated:
        return {}

    if is_admin_user(user):
        return DEFAULT_OPERATOR_PERMISSIONS.copy()

    profile = get_user_profile(user)
    if profile and hasattr(profile, "get_effective_permissions"):
        return profile.get_effective_permissions()

    return DEFAULT_OPERATOR_PERMISSIONS.copy() if is_operator_user(user) else {}


def has_user_permission(user, permission_key):
    if is_admin_user(user):
        return True
    return bool(get_user_permissions(user).get(permission_key, False))


def has_any_user_permission(user, permission_keys):
    if is_admin_user(user):
        return True
    return any(has_user_permission(user, permission_key) for permission_key in permission_keys)


class IsApprovedUser(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if is_admin_user(user):
            return True

        profile = get_user_profile(user)
        return bool(profile and profile.status == "approved")


class HasApprovedPermission(BasePermission):
    permission_keys = ()
    message = "You do not have permission to access this resource."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if is_admin_user(user):
            return True

        profile = get_user_profile(user)
        if not (profile and profile.status == "approved"):
            return False

        return has_any_user_permission(user, self.permission_keys)


class CanAccessViolationRecords(HasApprovedPermission):
    permission_keys = ("can_view_violations", "can_view_reports")
    message = "You do not have permission to access violation records."


class CanViewViolations(HasApprovedPermission):
    permission_keys = ("can_view_violations",)
    message = "You do not have permission to view violations."


class CanViewViolationAnalytics(HasApprovedPermission):
    permission_keys = ("can_view_violations", "can_view_reports")
    message = "You do not have permission to view violation analytics."


class CanAccessCameraData(HasApprovedPermission):
    permission_keys = ("can_view_cameras", "can_manage_cameras", "can_view_live_monitor", "can_view_reports")
    message = "You do not have permission to access camera data."


class CanManageCameras(HasApprovedPermission):
    permission_keys = ("can_manage_cameras",)
    message = "You do not have permission to manage cameras."


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and is_admin_user(user))


class IsOperator(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and is_operator_user(user))


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return is_admin_user(user) or is_operator_user(user)

        return is_admin_user(user)


class IsYoloService(HasAPIKey):
    """Allow authenticated machine requests from the YOLO service."""

    pass
