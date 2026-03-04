from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import UserProfile
from .permissions import IsApprovedUser
from .serializers import UserRegistrationSerializer, UserSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return User.objects.none()
        if user.is_staff or user.is_superuser:
            return User.objects.all().order_by("id")
        return User.objects.filter(id=user.id)

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        if self.action in ["me", "update_me", "change_password"]:
            return [IsApprovedUser()]
        return [IsAdminUser()]

    def get_serializer_class(self):
        if self.action == "create":
            return UserRegistrationSerializer
        return UserSerializer

    @action(detail=False, methods=["get"])
    def me(self, request):
        try:
            profile = UserProfile.objects.get(user=request.user)
            return Response({
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "role": profile.role,
                "status": profile.status,
            })
        except UserProfile.DoesNotExist:
            return Response({
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "role": "admin" if request.user.is_staff or request.user.is_superuser else "tmc_operator",
                "status": "approved",
            })

    @action(detail=False, methods=["get"], permission_classes=[IsAdminUser])
    def pending(self, request):
        pending_users = User.objects.filter(profile__status="pending")
        serializer = self.get_serializer(pending_users, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        user = self.get_object()
        profile = user.profile
        profile.status = "approved"
        profile.approved_by = request.user
        profile.approved_at = timezone.now()
        profile.save()

        if profile.role == "admin" and not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        return Response({"message": f"User {user.username} approved"})

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def reject(self, request, pk=None):
        user = self.get_object()
        profile = user.profile
        profile.status = "rejected"
        profile.approved_by = None
        profile.approved_at = None
        profile.save()

        if user.is_staff and not user.is_superuser:
            user.is_staff = False
            user.save(update_fields=["is_staff"])

        return Response({"message": f"User {user.username} rejected"})

    @action(detail=False, methods=["post"], url_path="create-operator", permission_classes=[IsAdminUser])
    def create_operator(self, request):
        name = request.data.get("name", "").strip()
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "").strip()
        requested_role = request.data.get("role", "tmc_operator").strip()

        if requested_role not in ["admin", "tmc_operator"]:
            requested_role = "tmc_operator"

        if not email or not password:
            return Response(
                {"error": "Email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"error": "A user with this email already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = name.replace(" ", "_").lower() if name else email.split("@")[0]
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        name_parts = name.split(" ", 1)
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        if requested_role == "admin":
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "role": requested_role,
                "status": "approved",
                "approved_by": request.user,
                "approved_at": timezone.now(),
            },
        )

        return Response(
            {"detail": f"{requested_role.capitalize()} '{username}' created successfully."},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["patch"], url_path="me")
    def update_me(self, request):
        user = request.user
        user.first_name = request.data.get("first_name", user.first_name)
        user.last_name = request.data.get("last_name", user.last_name)
        user.email = request.data.get("email", user.email)
        user.save()
        return Response({"detail": "Profile updated."})

    @action(detail=False, methods=["post"], url_path="change-password")
    def change_password(self, request):
        user = request.user
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")

        if not user.check_password(current_password):
            return Response(
                {"error": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"error": "New password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()
        return Response({"detail": "Password changed successfully."})
