from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role', 'status', 'phone', 'organization', 'created_at']
        read_only_fields = ['status', 'created_at']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']
        read_only_fields = ['id']

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, default='tmc_operator')
    phone = serializers.CharField(required=False, allow_blank=True)
    organization = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name', 'role', 'phone', 'organization']
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords do not match"})
        return data
    
    def create(self, validated_data):
        # Remove extra fields
        validated_data.pop('password_confirm')
        # Determine role: if request is present and not an admin, force 'tmc_operator'
        request = self.context.get('request') if hasattr(self, 'context') else None
        incoming_role = validated_data.pop('role', 'tmc_operator')
        if request is not None and getattr(request, 'user', None) and request.user.is_authenticated:
            # If authenticated admin is creating, allow requested role
            role = incoming_role if request.user.is_staff else 'tmc_operator'
        else:
            # Public registration -> always operator
            role = 'tmc_operator'
        phone = validated_data.pop('phone', '')
        organization = validated_data.pop('organization', '')
        
        # Create user
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        
        # update_or_create handles the post_save signal already creating a blank
        # profile — atomically sets all fields in one step
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                'role':         role,
                'phone':        phone,
                'organization': organization,
                'status':       'approved' if role == 'admin' and request is not None and getattr(request, 'user', None) and request.user.is_staff else 'pending',
            }
        )

        return user