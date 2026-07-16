import apiClient from './api';
export interface UserNotification {
  id: number;
  title: string;
  message: string;
  sender: number;
  sender_name: string;
  is_read: boolean;
  created_at: string;
}
export interface AdminNotification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  actor: number;
  actor_name: string;
  actor_role: string | null;
  violation: number | null;
  violation_id: number | null;
  is_read: boolean;
  created_at: string;
}
export const notificationsService = {
  async getNotifications(unreadOnly = false): Promise<UserNotification[]> {
    const params = unreadOnly ? { unread_only: 'true' } : {};
    const response = await apiClient.get('/users/notifications/', { params });
    return response.data;
  },
  async markRead(notificationId: number) {
    const response = await apiClient.post(`/users/notifications/${notificationId}/mark-read/`);
    return response.data;
  },
  async markAllRead() {
    const response = await apiClient.post('/users/notifications/mark-all-read/');
    return response.data;
  },
  async getAdminNotifications(unreadOnly = false, scope: 'alerts' | 'activity' = 'alerts'): Promise<AdminNotification[]> {
    const params: Record<string, string> = { scope };
    if (unreadOnly) params.unread_only = 'true';
    const response = await apiClient.get('/users/admin-notifications/', { params });
    return response.data;
  },
  async markAdminNotificationRead(notificationId: number) {
    const response = await apiClient.post(`/users/admin-notifications/${notificationId}/mark-read/`);
    return response.data;
  },
  async markAllAdminNotificationsRead(scope: 'alerts' | 'activity' = 'alerts') {
    const response = await apiClient.post('/users/admin-notifications/mark-all-read/', null, { params: { scope } });
    return response.data;
  },
  async deleteAdminNotification(notificationId: number) {
    await apiClient.delete(`/users/admin-notifications/${notificationId}/delete/`);
  },
  async sendNotification(data: { title: string; message: string; send_to_all?: boolean; recipient_ids?: number[] }) {
    const response = await apiClient.post('/users/notifications/send/', data);
    return response.data;
  },
};