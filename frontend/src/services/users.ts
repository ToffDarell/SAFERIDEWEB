import apiClient from './api';

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'tmc_operator';
  phone?: string;
  organization?: string;
}

export const usersService = {
  // Register new user
  async register(data: RegisterData) {
    const response = await fetch('http://localhost:8000/api/users/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // DRF can return flat string errors (detail/error) or field-level objects
      const message =
        error.detail ||
        error.error ||
        Object.entries(error)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
          .join(' | ') ||
        'Registration failed';
      throw new Error(message);
    }

    return response.json();
  },

  // Get current user
  async getCurrentUser() {
    const response = await apiClient.get('/users/me/');
    return response.data;
  },
};