from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from django.contrib.auth.models import User
from .models import UserProfile
from .serializers import UserSerializer, UserRegistrationSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        # Allow public registration, but serializer will enforce role/status rules.
        if self.action == 'create':
            return [AllowAny()]
        return super().get_permissions()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        return UserSerializer
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Get current user profile"""
        try:
            profile = UserProfile.objects.get(user=request.user)
            return Response({
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
                'role': profile.role,
                'status': profile.status,
            })
        except UserProfile.DoesNotExist:
            # Fallback for superusers or users without a profile
            return Response({
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
                'role': 'admin' if request.user.is_staff or request.user.is_superuser else 'tmc_operator',
                'status': 'approved',
            })
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def pending(self, request):
        """Get pending user registrations (admin only)"""
        if not request.user.is_staff:
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)
        
        pending_users = User.objects.filter(profile__status='pending')
        serializer = self.get_serializer(pending_users, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def approve(self, request, pk=None):
        """Approve a pending user (admin only)"""
        if not request.user.is_staff:
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)
        
        user = self.get_object()
        profile = user.profile
        profile.status = 'approved'
        profile.approved_by = request.user
        profile.save()
        
        return Response({"message": f"User {user.username} approved"})
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def reject(self, request, pk=None):
        """Reject a pending user (admin only)"""
        if not request.user.is_staff:
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)
        
        user = self.get_object()
        profile = user.profile
        profile.status = 'rejected'
        profile.save()
        
        return Response({"message": f"User {user.username} rejected"})
    
    @action(detail=False, methods=['post'], url_path='create-operator')
    def create_operator(self, request):
        """Admin creates a TMC operator account directly (auto-approved)."""
        if not request.user.is_staff:
            return Response(
                {"error": "Admin access required"},
                status=status.HTTP_403_FORBIDDEN
            )

        name     = request.data.get("name", "").strip()
        email    = request.data.get("email", "").strip()
        password = request.data.get("password", "").strip()

        if not email or not password:
            return Response(
                {"error": "Email and password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"error": "A user with this email already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # use email prefix as username if no name given
        username = name.replace(" ", "_").lower() if name else email.split("@")[0]
        # make username unique if it already exists
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        # split name into first/last
        name_parts = name.split(" ", 1)
        first_name = name_parts[0] if name_parts else ""
        last_name  = name_parts[1] if len(name_parts) > 1 else ""

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        # auto-approve the operator profile
        UserProfile.objects.filter(user=user).update(
            role='tmc_operator',
            status='approved',
            approved_by=request.user,
        )

        return Response(
            {"detail": f"Operator '{username}' created successfully."},
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['patch'], url_path='me')
    def update_me(self, request):
        """Update current user's own profile."""
        user = request.user
        user.first_name = request.data.get('first_name', user.first_name)
        user.last_name  = request.data.get('last_name',  user.last_name)
        user.email      = request.data.get('email',      user.email)
        user.save()
        return Response({"detail": "Profile updated."})

    @action(detail=False, methods=['post'], url_path='change-password')
    def change_password(self, request):
        """Change current user's password."""
        user            = request.user
        current_password = request.data.get('current_password', '')
        new_password     = request.data.get('new_password', '')

        if not user.check_password(current_password):
            return Response(
                {"error": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if len(new_password) < 8:
            return Response(
                {"error": "New password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()
        return Response({"detail": "Password changed successfully."})

