import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Package, Clock, MapPin, BookOpen, MessageCircle, FileSpreadsheet, Home, Settings, QrCode } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/utils/hooks/useTheme';
import { HeaderTitleWithSync, StandardHeaderRight, StandardSiteIndicator } from '@/components/HeaderSyncStatus';
import { useState, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

export default function MasterPlantManagerScreen() {
  const { user } = useAuth();
  const { theme, commonStyles } = useTheme();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isLoadingCount, setIsLoadingCount] = useState<boolean>(true);

  const loadPendingCount = useCallback(async () => {
    if (!user?.siteId) {
      setIsLoadingCount(false);
      return;
    }

    try {
      setIsLoadingCount(true);
      const requestsRef = collection(db, 'requests');
      const q = query(
        requestsRef,
        where('type', '==', 'PLANT_ALLOCATION_REQUEST'),
        where('siteId', '==', user.siteId),
        where('status', '==', 'PENDING'),
        where('archived', '==', false)
      );
      
      const snapshot = await getDocs(q);
      setPendingCount(snapshot.size);
      console.log('🔢 [Plant Manager] Pending allocation requests:', snapshot.size);
    } catch (error) {
      console.error('❌ [Plant Manager] Error loading pending count:', error);
    } finally {
      setIsLoadingCount(false);
    }
  }, [user?.siteId]);

  useFocusEffect(
    useCallback(() => {
      loadPendingCount();
    }, [loadPendingCount])
  );

  return (
    <View style={commonStyles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitleWithSync title="Plant Manager" />,
          headerRight: () => <StandardHeaderRight />,
          headerStyle: {
            backgroundColor: theme.headerBg,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />
      <View style={commonStyles.headerBorder} />
      <StandardSiteIndicator />

      <ScrollView style={commonStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.halfButton}
            onPress={() => router.push('/plant-manager-diary')}
            activeOpacity={0.7}
          >
            <BookOpen size={18} color="#fff" />
            <Text style={styles.halfButtonText}>Daily Diary</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.halfButton, styles.messagesHalfButton]}
            onPress={() => router.push('/messages')}
            activeOpacity={0.7}
          >
            <MessageCircle size={18} color="#ffffff" strokeWidth={2} />
            <Text style={styles.halfButtonText}>Messages</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/plant-manager-assets')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#fef3c7' }]}>
              <Package size={28} color="#f59e0b" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Plant Assets</Text>
              <Text style={styles.menuSubtitle}>Manage plant and equipment on site</Text>
            </View>
          </TouchableOpacity>



          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/plant-allocation-requests')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#e0e7ff' }]}>
              <Clock size={28} color="#6366f1" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Allocation Requests</Text>
              <Text style={styles.menuSubtitle}>Manage equipment allocation requests</Text>
            </View>
            {isLoadingCount ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : pendingCount > 0 ? (
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>{pendingCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/plant-allocation-overview')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#dcfce7' }]}>
              <MapPin size={28} color="#16a34a" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Plant Allocation Overview</Text>
              <Text style={styles.menuSubtitle}>View plant allocation by PV Areas and Blocks</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/plant-manager-timesheets')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#fef3c7' }]}>
              <FileSpreadsheet size={28} color="#f59e0b" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Time Sheets</Text>
              <Text style={styles.menuSubtitle}>Review and verify plant & man hour timesheets</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.7}
        >
          <Home size={24} color="#f59e0b" />
          <Text style={styles.footerButtonText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => router.push('/qr-scanner')}
          activeOpacity={0.7}
        >
          <View style={styles.scanQRButton}>
            <QrCode size={28} color="#fff" />
          </View>
          <Text style={styles.footerButtonText}>Scan QR</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => router.push('/company-settings')}
          activeOpacity={0.7}
        >
          <Settings size={24} color="#f59e0b" />
          <Text style={styles.footerButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    marginHorizontal: 16,
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#5f6368',
    lineHeight: 18,
  },
  infoBanner: {
    backgroundColor: '#fef3c7',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  infoText: {
    fontSize: 14,
    color: '#78350f',
    textAlign: 'center',
    lineHeight: 20,
  },

  counterBadge: {
    backgroundColor: '#ef4444',
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  halfButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  messagesHalfButton: {
    backgroundColor: '#FFD600',
  },
  halfButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  footerButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  scanQRButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
