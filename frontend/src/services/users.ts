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
        (typeof (error as Record<string, unknown>).detail === "string" ? (error as Record<string, unknown>).detail : "") ||
        (typeof (error as Record<string, unknown>).error === "string" ? (error as Record<string, unknown>).error : "") ||
        Object.entries(error as Record<string, unknown>)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
          .join(" | ") ||
        "Registration failed";
      throw new Error(message as string);
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

  async getPendingUsers(): Promise<UserListItem[]> {
    const response = await apiClient.get("/users/pending/");
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  },

  async approveUser(id: number) {
    const response = await apiClient.post(`/users/${id}/approve/`);
    return response.data;
  },

  async rejectUser(id: number) {
    const response = await apiClient.post(`/users/${id}/reject/`);
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await apiClient.post("/users/change-password/", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  async createOperator(data: { name : string; email: string; password: string; role?: string; }) {
    const response = await apiClient.post("/users/create-operator/", data);
    return response.data;
  },

  async updateMe(data: { first_name?: string; last_name?: string; email?: string }) {
    const response = await apiClient.patch("/users/me/", data);
    return response.data;
  },

  async deleteUser(id: number) {
    await apiClient.delete(`/users/${id}/`);
  },  
};
