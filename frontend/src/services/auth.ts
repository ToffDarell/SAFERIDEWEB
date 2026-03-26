import { API_BASE } from "@/config";
import apiClient from "./api";

export interface LoginCredentials {
  username: string;
  password: string;
  captcha_token: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

function formatRetryDelay(totalSeconds: number): string {
  const safeSeconds = Math.max(1, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes <= 0) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }

  if (seconds === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
}

function buildLoginErrorMessage(error: Record<string, unknown>, response: Response): string {
  const detail = typeof error.detail === "string" ? error.detail : "";
  const fieldMessage = Object.entries(error)
    .filter(([field]) => field !== "detail" && field !== "error")
    .map(([, value]) => {
      if (Array.isArray(value)) {
        return String(value[0] ?? "");
      }
      return typeof value === "string" ? value : "";
    })
    .find(Boolean);
  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
  const matchedSeconds = detail.match(/(\d+)\s+seconds?/i);
  const parsedDetailSeconds = matchedSeconds ? Number.parseInt(matchedSeconds[1], 10) : NaN;
  const waitSeconds = Number.isFinite(retryAfterSeconds)
    ? retryAfterSeconds
    : Number.isFinite(parsedDetailSeconds)
      ? parsedDetailSeconds
      : NaN;

  if (response.status === 429 && Number.isFinite(waitSeconds)) {
    return `Too many failed login attempts. Please wait ${formatRetryDelay(waitSeconds)} before trying again.`;
  }

  return detail || fieldMessage || (typeof error.error === "string" ? error.error : "") || "Invalid credentials";
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
      throw new Error(buildLoginErrorMessage(error, response));
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
