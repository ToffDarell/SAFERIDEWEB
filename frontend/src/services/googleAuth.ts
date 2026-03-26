import apiClient from './api';

export const googleAuthService = {
  // Handle Google login callback
  async loginWithGoogle(
    credential: string,
    role?: string,
    isRegister: boolean = false,
    captchaToken: string = ""
  ) {
    try {
      const response = await apiClient.post('/users/auth/google/callback/', {
        token: credential,
        role: role,
        is_register: isRegister,
        captcha_token: captchaToken,
      });

      const { access, refresh, user } = response.data;

      // Store tokens
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);

      return { success: true, user };
    } catch (error: any) {
      const responseData = error.response?.data || {};
      const fieldMessage = Object.entries(responseData)
        .filter(([field]) => field !== 'error' && field !== 'user')
        .map(([, value]) => Array.isArray(value) ? String(value[0] ?? '') : typeof value === 'string' ? value : '')
        .find(Boolean);
      return { 
        success: false, 
        error: responseData.error || fieldMessage || 'Google login failed',
        status: error.response?.data?.user?.status || null,
      };
    }
  }
};
