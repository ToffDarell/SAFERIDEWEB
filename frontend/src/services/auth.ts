import { API_BASE } from "@/config";
import apiClient from "./api";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await fetch(`${API_BASE}/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.error || "Invalid credentials");
    }

    const data = await response.json();
    localStorage.setItem("accessToken", data.access);
    localStorage.setItem("refreshToken", data.refresh);
    return data;
  },

  logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("currentUser");
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem("accessToken");
  },

  async getCurrentUser() {
    try {
      const response = await apiClient.get("/users/me/");
      return response.data;
    } catch {
      return null;
    }
  },
};
