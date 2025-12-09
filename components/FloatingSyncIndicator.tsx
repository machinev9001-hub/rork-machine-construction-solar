import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, PanResponder } from 'react-native';
import { useOfflineStatus } from '@/utils/hooks/useOfflineStatus';
import { RefreshCw, WifiOff, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FloatingSyncIndicator() {
  const { isConnected, syncStatus } = useOfflineStatus();
  const spinValue = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [
          null,
          { dx: pan.x, dy: pan.y }
        ],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      }
    })
  ).current;

  useEffect(() => {
    if (syncStatus.isSyncing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [syncStatus.isSyncing, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getStatusInfo = () => {
    if (!isConnected) {
      return {
        icon: <WifiOff size={20} color="#ffffff" />,
        text: 'Offline',
        backgroundColor: '#ef4444',
        emoji: '🔴',
      };
    }

    if (syncStatus.isSyncing) {
      return {
        icon: (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <RefreshCw size={20} color="#ffffff" />
          </Animated.View>
        ),
        text: 'Syncing',
        backgroundColor: '#3b82f6',
        emoji: '🔄',
      };
    }

    if (syncStatus.failedCount > 0) {
      return {
        icon: <AlertCircle size={20} color="#ffffff" />,
        text: `${syncStatus.failedCount} Failed`,
        backgroundColor: '#f59e0b',
        emoji: '⚠️',
      };
    }

    if (syncStatus.pendingCount > 0) {
      return {
        icon: <RefreshCw size={20} color="#ffffff" />,
        text: `${syncStatus.pendingCount} Pending`,
        backgroundColor: '#6b7280',
        emoji: '⏳',
      };
    }

    return {
      icon: <CheckCircle size={20} color="#ffffff" />,
      text: 'Synced',
      backgroundColor: '#10b981',
      emoji: '✅',
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <View 
      style={[
        styles.container,
        { 
          bottom: Platform.OS === 'web' ? 16 : 8 + Math.max(insets.bottom, 8),
        }
      ]}
      pointerEvents="box-none"
    >
      <Animated.View 
        style={[
          styles.innerContainer,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y }
            ]
          }
        ]}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.indicator,
            { backgroundColor: statusInfo.backgroundColor }
          ]}
          accessibilityLabel={`Sync status: ${statusInfo.text}`}
        >
          <Text style={styles.emoji}>{statusInfo.emoji}</Text>
          <View style={[styles.iconContainer, { marginLeft: 8 }]}>
            {statusInfo.icon}
          </View>
          <Text style={[styles.text, { marginLeft: 8 }]} numberOfLines={1}>
            {statusInfo.text}
          </Text>
          {(syncStatus.pendingCount > 0 || syncStatus.failedCount > 0) && (
            <View style={[styles.badge, { marginLeft: 8 }]}>
              <Text style={styles.badgeText}>
                {syncStatus.failedCount > 0 ? syncStatus.failedCount : syncStatus.pendingCount}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
    zIndex: 1000,
    elevation: 1000,
  },
  innerContainer: {
    zIndex: 1000,
    elevation: 1000,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 180,
  },
  emoji: {
    fontSize: 16,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});
