import { useEffect, useState } from 'react';

const STORAGE_KEY = 'notifications';

interface StoredLocalNotification {
  id: number;
  message: string;
  time: string;
  read?: boolean;
}

export interface LocalNotification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
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
): LocalNotification[] =>
  notifications.map((notification) => ({
    id: notification.id,
    title: 'Violation Update',
    message: notification.message,
    is_read: Boolean(notification.read),
    created_at: notification.time,
  }));

export const useLocalNotifications = () => {
  const [notifications, setNotifications] = useState<LocalNotification[]>(() =>
    normalizeNotifications(readStoredNotifications())
  );

  useEffect(() => {
    const syncNotifications = () => {
      setNotifications(normalizeNotifications(readStoredNotifications()));
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

  const markAsRead = (notificationId: number) => {
    const updatedStoredNotifications = readStoredNotifications().map((notification) =>
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStoredNotifications));
    setNotifications(normalizeNotifications(updatedStoredNotifications));
  };

  const markAllAsRead = () => {
    const updatedStoredNotifications = readStoredNotifications().map((notification) => ({
      ...notification,
      read: true,
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStoredNotifications));
    setNotifications(normalizeNotifications(updatedStoredNotifications));
  };

  const deleteNotification = (notificationId: number) => {
    const updatedStoredNotifications = readStoredNotifications().filter(
      (notification) => notification.id !== notificationId
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStoredNotifications));
    setNotifications(normalizeNotifications(updatedStoredNotifications));
  };

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.is_read).length,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loading: false,
  };
};
