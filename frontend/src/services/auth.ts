import apiClient from './api';

const API_BASE_URL = 'http://localhost:8000/api';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export const authService = {
  // Login
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await fetch(`${API_BASE_URL}/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    const data = await response.json();
    
    // Store tokens
    localStorage.setItem('accessToken', data.access);
    localStorage.setItem('refreshToken', data.refresh);

    return data;
  },

  // Logout
  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  },

  // Get current user info (from Django if needed)
  async getCurrentUser() {
    try {
      // You can add a Django endpoint for user profile
      const response = await apiClient.get('/users/me/');
      return response.data;
    } catch (error) {
      return null;
    }
  },
};