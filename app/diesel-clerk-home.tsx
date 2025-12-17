import { Stack, router } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fuel, QrCode, MessageCircle, BookOpen, LogOut, Home, Settings, Keyboard } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export default function DieselClerkHomeScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualAssetId, setManualAssetId] = useState('');

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

  const handleManualEntry = () => {
    if (!manualAssetId.trim()) {
      Alert.alert('Error', 'Please enter a plant asset ID');
      return;
    }

    setShowManualEntry(false);
    router.push({
      pathname: '/diesel-clerk-fuel-log',
      params: { plantAssetId: manualAssetId.trim() }
    });
    setManualAssetId('');
  };

  const navItems = [
    {
      title: 'Scan QR Code',
      subtitle: 'Scan plant asset QR to log fuel',
      icon: QrCode,
      color: '#10b981',
      bgColor: '#f0fdf4',
      onPress: () => router.push({ pathname: '/qr-scanner', params: { context: 'diesel-clerk' } })
    },
    {
      title: 'Manual Entry',
      subtitle: 'Enter asset ID manually',
      icon: Keyboard,
      color: '#f59e0b',
      bgColor: '#fef3c7',
      onPress: () => setShowManualEntry(true)
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
          <Text style={styles.headerTitle}>{user?.siteName || 'Diesel Clerk Dashboard'}</Text>
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
            <Fuel size={40} color="#fff" strokeWidth={2.5} />
          </View>
          <Text style={styles.welcomeText}>Fuel Logging</Text>
          <Text style={styles.welcomeSubtext}>Scan or enter plant asset to log diesel</Text>
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

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity 
          style={[styles.navButton, styles.navButtonActive]}
          onPress={() => router.push('/diesel-clerk-home')}
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

      <Modal
        visible={showManualEntry}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualEntry(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manual Entry</Text>
            <Text style={styles.modalSubtitle}>
              Enter the plant asset ID or number
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Plant Asset ID"
              value={manualAssetId}
              onChangeText={setManualAssetId}
              autoFocus
              autoCapitalize="characters"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowManualEntry(false);
                  setManualAssetId('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleManualEntry}
              >
                <Text style={styles.modalButtonTextConfirm}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontWeight: '700' as const,
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
    paddingBottom: 24,
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
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '700' as const,
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
    fontWeight: '700' as const,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#1e293b',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f1f5f9',
  },
  modalButtonConfirm: {
    backgroundColor: '#3b82f6',
  },
  modalButtonTextCancel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  modalButtonTextConfirm: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
