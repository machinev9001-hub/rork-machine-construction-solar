import { useRef, useCallback } from 'react';

export function useButtonProtection() {
  const actionInProgressRef = useRef<Record<string, boolean>>({});

  const protectAction = useCallback(
    <T extends (...args: any[]) => unknown | Promise<unknown>>(
      actionId: string,
      action: T
    ): ((...args: Parameters<T>) => Promise<void>) => {
      return async (...args: Parameters<T>) => {
        if (actionInProgressRef.current[actionId]) {
          console.log(`[ButtonProtection] Action "${actionId}" already in progress, ignoring duplicate`);
          return;
        }

        actionInProgressRef.current[actionId] = true;
        console.log(`[ButtonProtection] Starting action "${actionId}"`);

        try {
          await Promise.resolve(action(...args));
          console.log(`[ButtonProtection] Completed action "${actionId}"`);
        } catch (error) {
          console.error(`[ButtonProtection] Error in action "${actionId}":`, error);
          throw error;
        } finally {
          setTimeout(() => {
            actionInProgressRef.current[actionId] = false;
            console.log(`[ButtonProtection] Unlocked action "${actionId}"`);
          }, 1000);
        }
      };
    },
    []
  );

  return { protectAction };
}
