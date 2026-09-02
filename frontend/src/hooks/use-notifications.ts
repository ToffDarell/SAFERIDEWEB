import { useEffect, useRef } from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { violationsService, type RecentViolation } from '@/services/violations';
// Import the module-level stable toast function, NOT the hook version.
// The hook's toast reference changes on every render (because useToast re-subscribes
// via listeners.push on state change), which caused the useEffect to tear down and
// restart the poll interval every time a toast was displayed.
import { toast } from './use-toast';

const STORAGE_KEY = 'notifications';
const SETTINGS_KEY = 'notificationSettings';
// 1 000 ms: /violations/recent/ is now a hand-built lightweight response
// (~5 fields, <=10 rows, one indexed query), so a 1 s cadence is cheap. The
// earlier 1 500-2 500 ms values were sized around the old heavy ViolationSerializer
// that made each response take 200-400 ms.
const POLL_INTERVAL_MS = 1000;
const MAX_LOCAL_NOTIFICATIONS = 50;

type NotificationPreferences = {
  live_violation_popups: boolean;
  notification_sound: boolean;
  auto_hide_ms: number;
};

type StoredLocalNotification = {
  id: number;
  message: string;
  time: string;
  read?: boolean;
};

const readStoredNotifications = (): StoredLocalNotification[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const readNotificationPreferences = (): NotificationPreferences => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      live_violation_popups: parsed.live_violation_popups ?? true,
      notification_sound: parsed.notification_sound ?? false,
      auto_hide_ms: parsed.auto_hide_ms ?? 5000,
    };
  } catch {
    return {
      live_violation_popups: true,
      notification_sound: false,
      auto_hide_ms: 5000,
    };
  }
};

const playNotificationTone = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.035;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
    oscillator.onended = () => {
      void audioContext.close();
    };
  } catch {
    // Ignore browser audio restrictions.
  }
};

const getViolationTimestamp = (violation: RecentViolation) =>
  violation.processed_at || violation.detected_at;

const getViolationMessage = (violation: RecentViolation) =>
  `${violation.classification.replace(/_/g, ' ').toUpperCase()} detected at ${violation.camera_name}`;

const appendLocalNotification = (violation: RecentViolation) => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  if (currentUser.role !== 'tmc_operator') {
    return;
  }

  const existing = readStoredNotifications();
  if (existing.some((notification) => notification.id === violation.id)) {
    return;
  }

  const nextNotifications: StoredLocalNotification[] = [
    {
      id: violation.id,
      message: getViolationMessage(violation),
      time: getViolationTimestamp(violation),
      read: false,
    },
    ...existing,
  ].slice(0, MAX_LOCAL_NOTIFICATIONS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextNotifications));
};

export const useViolationNotifications = () => {
  const { hasPermission, isLoading } = usePermissions();
  const isBootstrappedRef = useRef(false);
  const maxSeenIdRef = useRef<number>(0);
  const canViewViolations = hasPermission('can_view_violations');

  useEffect(() => {
    if (isLoading || !canViewViolations) {
      return;
    }

    let isMounted = true;

    const checkNewViolations = async () => {
      try {
        const sinceId = isBootstrappedRef.current ? maxSeenIdRef.current : undefined;
        const recentViolations = await violationsService.getRecentViolations(sinceId);

        if (!isMounted) {
          return;
        }

        // Bootstrap: establish the high-water mark ID so historical violations do not trigger toasts
        if (!isBootstrappedRef.current) {
          if (recentViolations.length > 0) {
            maxSeenIdRef.current = Math.max(...recentViolations.map((v) => v.id));
          }
          isBootstrappedRef.current = true;
          return;
        }

        // Incremental poll: every violation returned with id > sinceId is genuinely new
        if (recentViolations.length > 0) {
          const preferences = readNotificationPreferences();

          if (preferences.live_violation_popups) {
            if (recentViolations.length >= 3) {
              toast({
                title: `${recentViolations.length} New Violations Detected!`,
                description: recentViolations
                  .map((v) => getViolationMessage(v))
                  .join(' · '),
                variant: 'destructive',
                duration: preferences.auto_hide_ms,
              });
            } else {
              recentViolations.forEach((violation) => {
                toast({
                  title: 'Violation Detected!',
                  description: getViolationMessage(violation),
                  variant: 'destructive',
                  duration: preferences.auto_hide_ms,
                });
              });
            }

            if (preferences.notification_sound) {
              playNotificationTone();
            }
          }

          recentViolations.forEach((violation) => {
            appendLocalNotification(violation);
          });

          // Dispatch sync event for bell icon and notification counts
          const latestViolation = recentViolations[recentViolations.length - 1];
          window.dispatchEvent(
            new CustomEvent('saferide-new-violation', { detail: latestViolation })
          );

          // Advance high-water mark
          const newMax = Math.max(...recentViolations.map((v) => v.id));
          if (newMax > maxSeenIdRef.current) {
            maxSeenIdRef.current = newMax;
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error checking violations:', error);
        }
      }
    };

    void checkNewViolations();
    const interval = setInterval(() => {
      void checkNewViolations();
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [canViewViolations, isLoading]);
};
