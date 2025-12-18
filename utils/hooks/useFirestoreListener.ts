import { useEffect, useRef } from 'react';
import { Query, onSnapshot, Unsubscribe, DocumentData } from 'firebase/firestore';
import { logger } from '@/utils/logger';

/**
 * Hook to safely manage Firestore listeners with automatic cleanup
 * Prevents memory leaks from uncleaned onSnapshot subscriptions
 */
export function useFirestoreListener<T = DocumentData>(
  query: Query<T> | null,
  callback: (snapshot: any) => void,
  options: {
    context?: string;
    errorHandler?: (error: Error) => void;
    enabled?: boolean;
  } = {}
): void {
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const { context = 'unknown', errorHandler, enabled = true } = options;

  useEffect(() => {
    // Skip if disabled or no query
    if (!enabled || !query) {
      return;
    }

    logger.debug(`Setting up Firestore listener [${context}]`);

    // Set up the listener
    unsubscribeRef.current = onSnapshot(
      query,
      (snapshot) => {
        logger.debug(
          `Firestore listener update [${context}]:`,
          `${snapshot.size} documents`
        );
        callback(snapshot);
      },
      (error) => {
        logger.error(`Firestore listener error [${context}]:`, error);
        if (errorHandler) {
          errorHandler(error);
        }
      }
    );

    // Cleanup function
    return () => {
      if (unsubscribeRef.current) {
        logger.debug(`Cleaning up Firestore listener [${context}]`);
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query, callback, context, errorHandler, enabled]);
}

/**
 * Hook to manage multiple Firestore listeners
 */
export function useMultipleFirestoreListeners(
  listeners: Array<{
    query: Query | null;
    callback: (snapshot: any) => void;
    context?: string;
    errorHandler?: (error: Error) => void;
    enabled?: boolean;
  }>
): void {
  const unsubscribesRef = useRef<Unsubscribe[]>([]);

  useEffect(() => {
    // Clean up any existing listeners
    unsubscribesRef.current.forEach(unsubscribe => unsubscribe());
    unsubscribesRef.current = [];

    // Set up new listeners
    listeners.forEach(({ query, callback, context = 'unknown', errorHandler, enabled = true }) => {
      if (!enabled || !query) {
        return;
      }

      logger.debug(`Setting up Firestore listener [${context}]`);

      const unsubscribe = onSnapshot(
        query,
        (snapshot) => {
          logger.debug(
            `Firestore listener update [${context}]:`,
            `${snapshot.size} documents`
          );
          callback(snapshot);
        },
        (error) => {
          logger.error(`Firestore listener error [${context}]:`, error);
          if (errorHandler) {
            errorHandler(error);
          }
        }
      );

      unsubscribesRef.current.push(unsubscribe);
    });

    // Cleanup function
    return () => {
      logger.debug(`Cleaning up ${unsubscribesRef.current.length} Firestore listeners`);
      unsubscribesRef.current.forEach(unsubscribe => unsubscribe());
      unsubscribesRef.current = [];
    };
  }, [listeners]);
}
