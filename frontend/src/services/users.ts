import { API_BASE } from "@/config";
import apiClient from "./api";
import type { CurrentUser, OperatorPermissions, PermissionKey } from "@/lib/permissions";

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  captcha_token: string;
  first_name: string;
  last_name: string;
  role: "admin" | "tmc_operator";
  phone?: string;
  organization?: string;
}

export interface UserListItem extends CurrentUser {
  profile?: {
    role?: "admin" | "tmc_operator" | string;
    status?: string;
    phone?: string;
    organization?: string;
    permissions?: Partial<OperatorPermissions>;
    created_at?: string;
  };
}

export const usersService = {
  async register(data: RegisterData) {
    const response = await fetch(`${API_BASE}/users/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({} as Record<string, unknown>));
      const emailField = (error as Record<string, unknown>).email;
      const emailMessage = Array.isArray(emailField)
        ? String(emailField[0] ?? "")
        : typeof emailField === "string"
          ? emailField
          : "";

      if (emailMessage.toLowerCase().includes("already exist")) {
        throw new Error("This email already exist");
      }

      const message =
        (error as Record<string, unknown>).detail ||
        (error as Record<string, unknown>).error ||
        Object.entries(error as Record<string, unknown>)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
          .join(" | ") ||
        "Registration failed";
      throw new Error(message);
    }

    return response.json();
  },

  async getCurrentUser() {
    const response = await apiClient.get("/users/me/");
    return response.data;
  },

  async getUsers(): Promise<UserListItem[]> {
    const response = await apiClient.get("/users/");
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  },

  async updatePermissions(
    userId: number,
    updates: Partial<Record<PermissionKey, boolean>>
  ): Promise<OperatorPermissions> {
    const response = await apiClient.patch(`/users/${userId}/permissions/`, updates);
    return response.data;
  },
};
