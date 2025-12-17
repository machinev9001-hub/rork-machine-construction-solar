import { Stack, router } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Truck, MessageCircle, User, LogOut, Home, Settings, BookOpen } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function OperatorHomeScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const navItems = [
    {
      title: 'Man Hours',
      subtitle: 'Log your daily work hours',
      icon: Clock,
      color: '#10b981',
      bgColor: '#f0fdf4',
      onPress: () => router.push('/operator-man-hours')
    },
    {
      title: 'Machine Hours',
      subtitle: 'Scan QR to record plant hours',
      icon: Truck,
      color: '#f59e0b',
      bgColor: '#fef3c7',
      onPress: () => router.push({ pathname: '/qr-scanner', params: { context: 'plant' } })
    },
    {
      title: 'Messages',
      subtitle: 'Chat with your team',
      icon: MessageCircle,
      color: '#3b82f6',
      bgColor: '#eff6ff',
      onPress: () => router.push('/messages')
    },
    {
      title: 'Daily Diary',
      subtitle: 'View site diary entries',
      icon: BookOpen,
      color: '#8b5cf6',
      bgColor: '#f5f3ff',
      onPress: () => router.push('/daily-diary')
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{ 
          headerShown: false
        }} 
      />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{user?.siteName || 'Operator Dashboard'}</Text>
          <Text style={styles.headerSubtitle}>{user?.name}</Text>
        </View>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <LogOut size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.welcomeCard}>
          <View style={styles.avatarCircle}>
            <User size={40} color="#fff" strokeWidth={2.5} />
          </View>
          <Text style={styles.welcomeText}>Welcome back!</Text>
          <Text style={styles.welcomeSubtext}>What would you like to do today?</Text>
        </View>

        <View style={styles.gridContainer}>
          {navItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.navCard, { backgroundColor: item.bgColor }]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
                  <Icon size={28} color="#fff" strokeWidth={2.5} />
                </View>
                <Text style={styles.navTitle}>{item.title}</Text>
                <Text style={styles.navSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navButton, styles.navButtonActive]}
          onPress={() => router.push('/operator-home')}
        >
          <Home size={24} color="#3b82f6" strokeWidth={2.5} />
          <Text style={[styles.navButtonText, styles.navButtonTextActive]}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => Alert.alert('Settings', 'Settings screen coming soon')}
        >
          <Settings size={24} color="#64748b" strokeWidth={2} />
          <Text style={styles.navButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerLeft: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#64748b',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  navCard: {
    width: '48%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  navSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  navButtonActive: {
    backgroundColor: '#eff6ff',
  },
  navButtonText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500' as const,
  },
  navButtonTextActive: {
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
});
