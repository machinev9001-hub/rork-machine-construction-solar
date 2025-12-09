import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Settings, ScanLine } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isHomeActive = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
  const isScanActive = pathname === '/qr-scanner';
  const isSettingsActive = pathname === '/settings' || pathname === '/(tabs)/settings';

  const handleHomePress = () => {
    router.push('/(tabs)');
  };

  const handleScanPress = () => {
    router.push({ pathname: '/qr-scanner', params: { context: 'hse' } });
  };

  const handleSettingsPress = () => {
    router.push('/(tabs)/settings');
  };

  return (
    <View 
      style={[
        styles.container,
        Platform.OS === 'web' && { paddingBottom: 8 },
        Platform.OS !== 'web' && { paddingBottom: Math.max(insets.bottom, 8) }
      ]}
    >
      <TouchableOpacity
        style={styles.tab}
        onPress={handleHomePress}
        activeOpacity={0.7}
      >
        <Home 
          size={24} 
          color={isHomeActive ? '#FFD600' : '#64748b'} 
          strokeWidth={isHomeActive ? 2.5 : 2}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={handleScanPress}
        activeOpacity={0.7}
      >
        <ScanLine 
          size={24} 
          color={isScanActive ? '#FFD600' : '#64748b'} 
          strokeWidth={isScanActive ? 2.5 : 2}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={handleSettingsPress}
        activeOpacity={0.7}
      >
        <Settings 
          size={24} 
          color={isSettingsActive ? '#FFD600' : '#64748b'} 
          strokeWidth={isSettingsActive ? 2.5 : 2}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
