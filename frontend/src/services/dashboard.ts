import apiClient from './api';
export interface DashboardData {
  summary: {
    total_violations: number;
    pending_violations: number;
    reviewed_violations: number;
    resolved_violations: number;
    today_violations: number;
  };
  recent_detections: unknown[];
  camera_overview: {
    total_cameras: number;
    active_cameras: number;
    inactive_cameras: number;
  };
  camera_statuses: unknown[];
  role: string;
  // Admin-only fields
  system_alert_count?: number;
  system_alerts?: unknown[];
  settings_snapshot?: Record<string, unknown>;
  // Operator-only fields
  unread_notification_count?: number;
  notifications?: unknown[];
}
export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    const response = await apiClient.get('/users/dashboard/');
    return response.data;
  },
};