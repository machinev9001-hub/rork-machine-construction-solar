import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { useOfflineStatus } from '@/utils/hooks/useOfflineStatus';
import { RefreshCw, WifiOff, CheckCircle, AlertCircle, Clock, MapPin } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { getInitials } from '@/utils/nameHelpers';

export default function HeaderSyncStatus() {
  const { isConnected, syncStatus } = useOfflineStatus();
  const spinValue = useRef(new Animated.Value(0)).current;

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

  const getStatusIcon = () => {
    if (!isConnected) {
      return <WifiOff size={16} color="#ef4444" />;
    }

    if (syncStatus.isSyncing) {
      return (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <RefreshCw size={16} color="#FBBC04" />
        </Animated.View>
      );
    }

    if (syncStatus.failedCount > 0) {
      return <AlertCircle size={16} color="#f59e0b" />;
    }

    if (syncStatus.pendingCount > 0) {
      return <Clock size={16} color="#6b7280" />;
    }

    return <CheckCircle size={16} color="#10b981" />;
  };

  return (
    <View style={styles.container}>
      {getStatusIcon()}
    </View>
  );
}

export function HeaderTitleWithSync({ title }: { title: string }) {
  return (
    <View style={styles.titleContainer}>
      <Text style={styles.titleText}>{title}</Text>
    </View>
  );
}

export function StandardHeaderRight() {
  const { user } = useAuth();
  
  return (
    <View style={styles.headerRight}>
      <HeaderSyncStatus />
      <View style={styles.userInfo}>
        <Text style={styles.headerUserName}>{getInitials(user?.name || 'User')}</Text>
        <Text style={styles.headerCompanyName}>{user?.companyName || 'Company'}</Text>
      </View>
    </View>
  );
}

export function StandardSiteIndicator() {
  const { user } = useAuth();
  
  if (!user?.siteName) return null;
  
  return (
    <View style={styles.siteIndicator}>
      <MapPin size={12} color={Colors.textSecondary} strokeWidth={2} />
      <Text style={styles.siteIndicatorText}>{user.siteName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userInfo: {
    alignItems: 'flex-end',
  },
  headerUserName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerCompanyName: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  siteIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 4,
    backgroundColor: Colors.background,
  },
  siteIndicatorText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
});
