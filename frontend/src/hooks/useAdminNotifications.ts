import { useEffect, useRef, useState } from 'react';
import { notificationsService, type AdminNotification } from '@/services/notifications';

export type { AdminNotification };

export const useAdminNotifications = (scope: 'alerts' | 'activity' = 'alerts') => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = currentUser.role === 'admin';

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(isAdmin);
  const lastMutationAt = useRef(0);

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
        const response = await notificationsService.getAdminNotifications(false, scope);
        if (isMounted) {
          setNotifications(response || []);
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
    const interval = setInterval(() => {
      if (Date.now() - lastMutationAt.current < 2000) return;
      loadNotifications(false);
    }, 15000);

    // Debounce the burst of 'saferide-new-violation' events so a detection storm
    // triggers ONE admin-notifications reload, not one per violation (which
    // otherwise competes with the 1s notification poll on the dev server).
    let eventDebounce: ReturnType<typeof setTimeout> | undefined;
    const handleNewViolation = () => {
      clearTimeout(eventDebounce);
      eventDebounce = setTimeout(() => loadNotifications(false), 1200);
    };
    window.addEventListener('saferide-new-violation', handleNewViolation);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(eventDebounce);
      window.removeEventListener('saferide-new-violation', handleNewViolation);
    };
  }, [isAdmin, scope]);

  const markAsRead = async (notificationId: number) => {
    if (!isAdmin) return;
    lastMutationAt.current = Date.now();

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true }
          : notification
      )
    );

    try {
      await notificationsService.markAdminNotificationRead(notificationId);
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
    lastMutationAt.current = Date.now();

    const previousNotifications = notifications;
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, is_read: true }))
    );

    try {
      await notificationsService.markAllAdminNotificationsRead(scope);
    } catch (error) {
      setNotifications(previousNotifications);
      console.error('Failed to mark all admin notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    if (!isAdmin) return;
    lastMutationAt.current = Date.now();

    const previousNotifications = notifications;
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== notificationId)
    );

    try {
      await notificationsService.deleteAdminNotification(notificationId);
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
