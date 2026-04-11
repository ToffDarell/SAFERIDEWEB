export const DEFAULT_OPERATOR_PERMISSIONS = {
  can_view_violations: true,
  can_update_violation_status: true,
  can_view_live_monitor: true,
  can_view_reports: true,
  can_export_reports: false,
  can_view_cameras: true,
  can_manage_cameras: false,
} as const;

export type PermissionKey = keyof typeof DEFAULT_OPERATOR_PERMISSIONS;
export type OperatorPermissions = Record<PermissionKey, boolean>;

export interface CurrentUser {
  id?: number;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  role?: "admin" | "tmc_operator" | string;
  status?: string;
  permissions?: Partial<OperatorPermissions> | null;
}

export const PERMISSION_TOGGLE_ITEMS: Array<{ key: PermissionKey; label: string }> = [
  { key: "can_view_violations", label: "View violations" },
  { key: "can_update_violation_status", label: "Update violation status" },
  { key: "can_view_live_monitor", label: "View live monitor" },
  { key: "can_view_reports", label: "View reports" },
  { key: "can_export_reports", label: "Export reports" },
  { key: "can_view_cameras", label: "View cameras" },
  { key: "can_manage_cameras", label: "Manage cameras" },
];

export function normalizePermissions(
  permissions?: Partial<OperatorPermissions> | null
): OperatorPermissions {
  return {
    ...DEFAULT_OPERATOR_PERMISSIONS,
    ...(permissions ?? {}),
  };
}

export function buildCurrentUser(userData: CurrentUser | null | undefined): CurrentUser | null {
  if (!userData) {
    return null;
  }

  const fullName =
    [userData.first_name, userData.last_name].filter(Boolean).join(" ").trim() ||
    userData.name ||
    userData.username ||
    "";

  return {
    id: userData.id,
    username: userData.username,
    email: userData.email,
    first_name: userData.first_name,
    last_name: userData.last_name,
    name: fullName,
    role: userData.role,
    status: userData.status,
    permissions: normalizePermissions(userData.permissions),
  };
}

export function parseStoredCurrentUser(): CurrentUser | null {
  try {
    return buildCurrentUser(JSON.parse(localStorage.getItem("currentUser") || "null"));
  } catch {
    return null;
  }
}
