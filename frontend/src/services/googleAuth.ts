import apiClient from './api';

export const googleAuthService = {
  // Handle Google login callback
  async loginWithGoogle(credential: string) {
    try {
      const response = await apiClient.post('/users/auth/google/callback/', {
        token: credential
      });

      const { access, refresh, user } = response.data;

      // Store tokens
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
      localStorage.setItem('currentUser', JSON.stringify({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      }));

      return { success: true, user };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Google login failed' 
      };
    }
  }
};