import { useEffect, useState } from 'react';
import { notificationsService, type UserNotification } from '@/services/notifications';

const STORAGE_KEY = 'notifications';

interface StoredLocalNotification {
  id: number;
  message: string;
  time: string;
  read?: boolean;
}

const readStoredNotifications = (): StoredLocalNotification[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const normalizeNotifications = (
  notifications: StoredLocalNotification[]
): UserNotification[] =>
  notifications.map((notification) => ({
    id: notification.id,
    title: 'Violation Update',
    message: notification.message,
    sender: 0,
    sender_name: '',
    is_read: Boolean(notification.read),
    created_at: notification.time,
  }));

export const useLocalNotifications = () => {
  const [localNotifications, setLocalNotifications] = useState<UserNotification[]>(() =>
    normalizeNotifications(readStoredNotifications())
  );
  const [backendNotifications, setBackendNotifications] = useState<UserNotification[]>([]);

  // Poll backend for UserNotifications every 10s
  useEffect(() => {
    let isMounted = true;
    const fetchBackend = async () => {
      try {
        const data = await notificationsService.getNotifications();
        if (isMounted) setBackendNotifications(data || []);
      } catch {}
    };
    fetchBackend();
    const interval = setInterval(fetchBackend, 10000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  // Sync localStorage notifications
  useEffect(() => {
    const syncNotifications = () => {
      setLocalNotifications(normalizeNotifications(readStoredNotifications()));
    };
    syncNotifications();
    const interval = setInterval(syncNotifications, 3000);
    const handleStorage = () => syncNotifications();
    window.addEventListener('storage', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Merge: backend notifications first, then local violation notifications
  const notifications = [
    ...backendNotifications,
    ...localNotifications.filter((ln) => !backendNotifications.some((bn) => bn.id === ln.id)),
  ];

  const markAsRead = async (notificationId: number) => {
    // Try backend first
    const backendNotif = backendNotifications.find((n) => n.id === notificationId);
    if (backendNotif) {
      setBackendNotifications((prev) =>
        prev.map((n) => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      try {
        await notificationsService.markRead(notificationId);
      } catch {
        setBackendNotifications((prev) =>
          prev.map((n) => n.id === notificationId ? { ...n, is_read: false } : n)
        );
      }
      return;
    }
    // Fallback to localStorage
    const updatedStoredNotifications = readStoredNotifications().map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStoredNotifications));
    setLocalNotifications(normalizeNotifications(updatedStoredNotifications));
  };

  const markAllAsRead = async () => {
    setBackendNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await notificationsService.markAllRead();
    } catch {}
    const updatedStoredNotifications = readStoredNotifications().map((n) => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStoredNotifications));
  };

  const deleteNotification = async (notificationId: number) => {
    setBackendNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    setLocalNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    const updatedStoredNotifications = readStoredNotifications().filter((n) => n.id !== notificationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStoredNotifications));
  };

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loading: false,
  };
};
