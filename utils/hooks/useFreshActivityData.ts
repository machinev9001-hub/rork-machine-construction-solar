import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import NetInfo from '@react-native-community/netinfo';
import { dataFreshnessManager } from '@/utils/dataFreshnessSync';

type ActivityData = {
  id: string;
  name: string;
  scopeValue: number;
  qcValue: number;
  unit: string;
  scopeApproved: boolean;
  cablingHandoff?: boolean;
  terminationHandoff?: boolean;
  updatedAt?: string;
  [key: string]: any;
};

/**
 * Hook to load activity data with freshness checking
 * 
 * This hook:
 * 1. Loads data from both Firebase and AsyncStorage
 * 2. Compares timestamps to determine freshest data
 * 3. Sets up real-time listener when online
 * 4. Auto-updates when P0 sync completes
 */
export function useFreshActivityData(activityId: string) {
  const queryClient = useQueryClient();

  // Fetch activity with freshness checking
  const { data: activity, isLoading, error, refetch } = useQuery({
    queryKey: ['activity', activityId, 'fresh'],
    queryFn: async () => {
      console.log('\n🔄 [useFreshActivity] Loading activity:', activityId);

      try {
        const netInfo = await NetInfo.fetch();
        const isOnline = netInfo.isConnected;

        let firebaseData: ActivityData | null = null;
        let firebaseTimestamp: string | undefined;

        // Load from Firebase if online
        if (isOnline) {
          try {
            const activityRef = doc(db, 'activities', activityId);
            const activityDoc = await getDoc(activityRef);
            
            if (activityDoc.exists()) {
              firebaseData = { id: activityDoc.id, ...activityDoc.data() } as ActivityData;
              firebaseTimestamp = firebaseData.updatedAt || new Date().toISOString();
              console.log('✅ [useFreshActivity] Firebase data loaded, timestamp:', firebaseTimestamp);
            } else {
              console.log('⚠️ [useFreshActivity] Activity not found in Firebase');
            }
          } catch (error) {
            console.error('❌ [useFreshActivity] Firebase fetch error:', error);
          }
        }

        // Get freshest data using timestamp comparison
        const result = await dataFreshnessManager.getFreshestData<ActivityData>({
          firebaseData: firebaseData || undefined,
          firebaseTimestamp,
          asyncStorageKey: `@cached_activity_instance:${activityId}`,
          preferSource: 'firebase',
        });

        console.log('✅ [useFreshActivity] Using data from:', result.source);
        console.log('   Timestamp:', result.timestamp);
        console.log('   Is Fresh:', result.isFresh);

        return result;
      } catch (error) {
        console.error('❌ [useFreshActivity] Error loading activity:', error);
        throw error;
      }
    },
    enabled: !!activityId,
    staleTime: 0, // Always check for freshness
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Set up real-time listener when online
  useEffect(() => {
    let mounted = true;
    let currentListenerKey: string | null = null;

    const setupListener = async () => {
      try {
        const netInfo = await NetInfo.fetch();
        
        if (netInfo.isConnected && activityId) {
          console.log('🔔 [useFreshActivity] Setting up real-time listener for:', activityId);
          
          const key = await dataFreshnessManager.subscribeToDocument<ActivityData>(
            'activities',
            activityId,
            `@cached_activity_instance:${activityId}`,
            async (data, timestamp) => {
              if (mounted) {
                console.log('🔔 [useFreshActivity] Real-time update received, invalidating query');
                
                // Invalidate query to trigger refetch
                queryClient.invalidateQueries({ 
                  queryKey: ['activity', activityId, 'fresh'] 
                });
              }
            }
          );

          if (mounted && key !== 'offline_skip') {
            currentListenerKey = key;
          }
        }
      } catch (error) {
        console.error('❌ [useFreshActivity] Error setting up listener:', error);
      }
    };

    setupListener();

    return () => {
      mounted = false;
      if (currentListenerKey) {
        console.log('🔕 [useFreshActivity] Cleaning up listener:', currentListenerKey);
        dataFreshnessManager.unsubscribeFromDocument(currentListenerKey);
      }
    };
  }, [activityId, queryClient]);

  // Listen for P0 sync notifications
  useEffect(() => {
    const unsubscribe = dataFreshnessManager.subscribeToNotifications((notifications) => {
      // Check if any notification is related to this activity
      const relevantNotification = notifications.find(
        (n) => !n.read && n.entityId === activityId && n.entityType.includes('activity')
      );

      if (relevantNotification) {
        console.log('🔔 [useFreshActivity] P0 sync notification received, refreshing data');
        refetch();
        dataFreshnessManager.markNotificationAsRead(relevantNotification.id);
      }
    });

    return unsubscribe;
  }, [activityId, refetch]);

  const forceRefresh = useCallback(async () => {
    console.log('🔄 [useFreshActivity] Force refresh requested');
    await refetch();
  }, [refetch]);

  return {
    activity: activity?.data || null,
    source: activity?.source || 'asyncstorage',
    timestamp: activity?.timestamp || 'unknown',
    isFresh: activity?.isFresh || false,
    isLoading,
    error,
    forceRefresh,
  };
}
