from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework_api_key.permissions import HasAPIKey


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None

    if user.is_staff or user.is_superuser:
        return "admin"

    profile = getattr(user, "profile", None)
    if profile and profile.role:
        return profile.role

    return None


def is_admin_user(user):
    return get_user_role(user) == "admin"


def is_operator_user(user):
    return get_user_role(user) == "tmc_operator"


class IsApprovedUser(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if is_admin_user(user):
            return True

        profile = getattr(user, "profile", None)
        return bool(profile and profile.status == "approved")


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
