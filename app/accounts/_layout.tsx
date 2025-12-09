import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Settings } from 'lucide-react-native';

export default function AccountsLayout() {
  const router = useRouter();
  const { user } = useAuth();

  const hasAccess = user && (user.role === 'master' || (user.role as string) === 'Accounts');

  useEffect(() => {
    if (!hasAccess) {
      console.log('[Accounts] Access denied - redirecting to home');
      router.replace('/(tabs)/' as any);
    }
  }, [hasAccess, router]);

  if (!hasAccess) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1e3a8a',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '600' as const,
        },
        tabBarActiveTintColor: '#1e3a8a',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          backgroundColor: '#ffffff',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'Accounts Dashboard',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
          tabBarLabel: 'Settings',
        }}
      />
    </Tabs>
  );
}
