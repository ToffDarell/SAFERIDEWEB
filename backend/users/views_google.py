import os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from users.models import UserProfile

User = get_user_model()

class GoogleLogin(SocialLoginView):
    permission_classes = [AllowAny]
    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:5173"
    client_class = OAuth2Client

class GoogleAuthCallback(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        """Handle Google OAuth callback with access token"""
        from google.oauth2 import id_token
        from google.auth.transport import requests
        
        token = request.data.get('token')
        
        if not token:
            return Response({'error': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Verify the token with Google
            google_client_id = os.getenv('GOOGLE_CLIENT_ID')
            idinfo = id_token.verify_oauth2_token(
                token, 
                requests.Request(), 
                google_client_id
            )
            
            email = idinfo.get('email')
            name = idinfo.get('name')
            
            if not email:
                return Response({'error': 'Email not provided by Google'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get or create user
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email.split('@')[0],
                    'first_name': name.split()[0] if name else '',
                    'last_name': ' '.join(name.split()[1:]) if name and len(name.split()) > 1 else '',
                }
            )
            
            is_register = request.data.get('is_register', False)
            if is_register and not created:
                return Response(
                    {'error': 'An account with this Google email already exists. Please log in instead.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            requested_role = request.data.get('role', 'tmc_operator')
            if requested_role not in ['admin', 'tmc_operator']:
                requested_role = 'tmc_operator'

            # Create or update UserProfile
            user_profile, _ = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'role': requested_role,
                    'status': 'pending',  # Requires admin approval
                }
            )
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'name': f"{user.first_name} {user.last_name}".strip(),
                    'role': user_profile.role,
                    'status': user_profile.status,
                }
            })
            
        except ValueError as e:
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)