import { useEffect, useRef } from 'react';
import { violationsService, type Violation } from '@/services/violations';
import { useToast } from './use-toast';

const STORAGE_KEY = 'notifications';
const POLL_INTERVAL_MS = 1500;
const MAX_TRACKED_IDS = 100;
const MAX_LOCAL_NOTIFICATIONS = 50;
const RECENT_THRESHOLD_MS = 30000;

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

const getViolationTimestamp = (violation: Violation) =>
  violation.processed_at || violation.detected_at;

const getViolationMessage = (violation: Violation) =>
  `${violation.classification.replace('_', ' ').toUpperCase()} detected at ${violation.camera_name}`;

const appendLocalNotification = (violation: Violation) => {
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
  const { toast } = useToast();
  const isBootstrappedRef = useRef(false);
  const seenViolationIdsRef = useRef(new Set<number>());

  useEffect(() => {
    let isMounted = true;

    const markSeen = (violationId: number) => {
      const seenIds = seenViolationIdsRef.current;
      if (seenIds.has(violationId)) {
        return;
      }

      seenIds.add(violationId);
      if (seenIds.size > MAX_TRACKED_IDS) {
        const oldestId = seenIds.values().next().value;
        if (typeof oldestId === 'number') {
          seenIds.delete(oldestId);
        }
      }
    };

    const checkNewViolations = async () => {
      try {
        const response = await violationsService.getViolations({
          page: 1,
          page_size: 10,
          detection_status: 'violation',
          ordering: '-detected_at',
        });

        if (!isMounted) {
          return;
        }

        const recentViolations: Violation[] = Array.isArray(response)
          ? response
          : response.results || [];

        if (!isBootstrappedRef.current) {
          recentViolations.forEach((violation) => markSeen(violation.id));
          isBootstrappedRef.current = true;
          return;
        }

        const freshUnseenViolations = recentViolations
          .filter((violation) => !seenViolationIdsRef.current.has(violation.id))
          .filter((violation) => {
            const timestamp = Date.parse(getViolationTimestamp(violation));
            return Number.isFinite(timestamp)
              ? Date.now() - timestamp <= RECENT_THRESHOLD_MS
              : true;
          })
          .sort(
            (left, right) =>
              Date.parse(getViolationTimestamp(left)) - Date.parse(getViolationTimestamp(right))
          );

        freshUnseenViolations.forEach((violation) => {
          toast({
            title: 'Violation Detected!',
            description: getViolationMessage(violation),
            variant: 'destructive',
            duration: 5000,
          });
          appendLocalNotification(violation);
        });

        recentViolations.forEach((violation) => markSeen(violation.id));
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
  }, [toast]);
};
