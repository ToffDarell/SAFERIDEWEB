import { useEffect, useState } from 'react';
import apiClient from '@/services/api';

export interface AdminNotification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  actor: number | null;
  actor_name: string | null;
  actor_role: string | null;
  violation: number | null;
  violation_id: number | null;
}
    
export const useAdminNotifications = (scope: 'alerts' | 'activity' = 'alerts') => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = currentUser.role === 'admin';

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(isAdmin);

  useEffect(() => {
    if (!isAdmin) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadNotifications = async (showLoader = false) => {
      if (showLoader && isMounted) {
        setLoading(true);
      }

      try {
        const response = await apiClient.get('/users/admin-notifications/', {
          params: { scope },
        });
        if (isMounted) {
          setNotifications(response.data || []);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load admin notifications:', error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadNotifications(true);
    const interval = setInterval(() => loadNotifications(false), 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdmin, scope]);

  const markAsRead = async (notificationId: number) => {
    if (!isAdmin) return;

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true }
          : notification
      )
    );

    try {
      await apiClient.post(`/users/admin-notifications/${notificationId}/mark-read/`);
    } catch (error) {
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, is_read: false }
            : notification
        )
      );
      console.error('Failed to mark admin notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!isAdmin) return;

    const previousNotifications = notifications;
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, is_read: true }))
    );

    try {
      await apiClient.post('/users/admin-notifications/mark-all-read/', null, {
        params: { scope },
      });
    } catch (error) {
      setNotifications(previousNotifications);
      console.error('Failed to mark all admin notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    if (!isAdmin) return;

    const previousNotifications = notifications;
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== notificationId)
    );

    try {
      await apiClient.delete(`/users/admin-notifications/${notificationId}/delete/`);
    } catch (error) {
      setNotifications(previousNotifications);
      console.error('Failed to delete admin notification:', error);
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loading,
  };
};
