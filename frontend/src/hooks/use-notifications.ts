import { useState, useEffect, useRef } from 'react';
import { violationsService } from '@/services/violations';
import { useToast } from './use-toast';

export const useViolationNotifications = () => {
  const { toast } = useToast();
  const [lastChecked, setLastChecked] = useState<string>(new Date().toISOString());
  const isFirstRun = useRef(true); // Track first run

  useEffect(() => {
    const checkNewViolations = async () => {
      // Skip the first check to avoid showing old violations
      if (isFirstRun.current) {
        isFirstRun.current = false;
        console.log('Violation monitoring started - will only show NEW violations');
        return;
      }

      try {
        const response = await violationsService.getViolations({
          detected_at__gte: lastChecked,
          detection_status: 'violation',
          ordering: '-detected_at',
        });

        const newViolations = response.results || response || [];
        
        if (Array.isArray(newViolations) && newViolations.length > 0) {
          const latestViolation = newViolations[0];
          
          toast({
            title: "⚠️ Violation Detected!",
            description: `${latestViolation.classification.replace('_', ' ').toUpperCase()} detected at ${latestViolation.camera_name}`,
            variant: "destructive",
            duration: 5000,
          });
          
          setLastChecked(new Date().toISOString());
        }
      } catch (error) {
        console.error('Error checking violations:', error);
      }
    };

    // Check every 3 seconds
    const interval = setInterval(checkNewViolations, 3000);

    return () => clearInterval(interval);
  }, [lastChecked, toast]);
};