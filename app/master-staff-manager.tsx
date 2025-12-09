import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Users, UserPlus, Calendar, Activity, ClipboardList, Send, UserCheck, MapPin, MessageCircle, BookOpen } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import StaffRequestModal from '@/components/StaffRequestModal';
import { collection, addDoc, Timestamp, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useTheme } from '@/utils/hooks/useTheme';
import { HeaderTitleWithSync, StandardHeaderRight, StandardSiteIndicator } from '@/components/HeaderSyncStatus';
import { getRoleAccentColor } from '@/constants/colors';

export default function MasterStaffManagerScreen() {
  const { user } = useAuth();
  const { theme, commonStyles } = useTheme();
  const router = useRouter();
  const [showStaffRequestModal, setShowStaffRequestModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unreadStaffRequestCount, setUnreadStaffRequestCount] = useState(0);

  useEffect(() => {
    if (!user?.siteId) {
      console.log('❌ No siteId for staff request counter');
      return;
    }

    console.log('🔍 Setting up staff request counter for siteId:', user.siteId);
    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'STAFF_REQUEST'),
      where('siteId', '==', user.siteId),
      where('status', '==', 'PENDING'),
      where('archived', '==', false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const count = snapshot.docs.length;
        console.log('📊 Staff request counter updated:', count);
        setUnreadStaffRequestCount(count);
      },
      (error) => {
        console.error('❌ Error listening to staff requests:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.siteId]);

  const handleStaffRequestSubmit = async (entries: any[]) => {
    console.log('[MasterStaffManager] Staff request submit:', entries);

    if (!user?.siteId || !user.masterAccountId) {
      Alert.alert('Error', 'Missing site or account information');
      return;
    }

    setIsSubmitting(true);

    try {
      for (const entry of entries) {
        const requestData = {
          type: 'STAFF_REQUEST',
          requestType: 'STAFF_REQUEST',
          status: 'PENDING',
          staffType: entry.employeeType || entry.employeeRole,
          numberOfStaff: parseInt(entry.quantity, 10),
          siteId: user.siteId,
          masterAccountId: user.masterAccountId,
          requestedBy: user.userId || user.id,
          requestedByName: user.name,
          requestedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          archived: false,
        };

        console.log('[MasterStaffManager] Creating staff request:', requestData);

        const requestsRef = collection(db, 'requests');
        await addDoc(requestsRef, requestData);
      }

      Alert.alert('Success', `${entries.length} staff request(s) submitted successfully`);
      setShowStaffRequestModal(false);
    } catch (error) {
      console.error('[MasterStaffManager] Error creating staff request:', error);
      Alert.alert('Error', 'Failed to create staff request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={commonStyles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitleWithSync title="Staff Manager" />,
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

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={styles.halfButton}
          onPress={() => router.push('/daily-diary')}
          activeOpacity={0.7}
        >
          <BookOpen size={18} color="#ffffff" strokeWidth={2} />
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

      <ScrollView style={commonStyles.scrollView} showsVerticalScrollIndicator={false}>

        <View style={styles.welcomeCard}>
          <Users size={48} color="#fff" />
          <Text style={styles.welcomeTitle}>Staff Manager Dashboard</Text>
          <Text style={styles.welcomeText}>
            Manage workforce allocation, track attendance, schedule shifts, and monitor staff performance across all site operations
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.requestButton}
          activeOpacity={0.7}
          onPress={() => setShowStaffRequestModal(true)}
        >
          <Send size={20} color="#ffffff" strokeWidth={2.5} />
          <Text style={styles.requestButtonText}>Request Staff</Text>
        </TouchableOpacity>

        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/staff-requests')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#ede9fe' }]}>
              <Users size={28} color="#8b5cf6" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Staff Requests</Text>
              <Text style={styles.menuSubtitle}>Process and approve staff allocation requests</Text>
            </View>
            {unreadStaffRequestCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadStaffRequestCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/staff-manager-employees')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#ede9fe' }]}>
              <UserCheck size={28} color="#8b5cf6" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Employees</Text>
              <Text style={styles.menuSubtitle}>Allocate employees to PV + Block areas</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/staff-allocation-overview')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#ede9fe' }]}>
              <MapPin size={28} color="#8b5cf6" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Staff Allocation Overview</Text>
              <Text style={styles.menuSubtitle}>View allocated staff by PV Areas and Blocks</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#dbeafe' }]}>
              <Calendar size={28} color="#3b82f6" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Shift Schedule</Text>
              <Text style={styles.menuSubtitle}>Manage shift rosters and schedules</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#fce7f3' }]}>
              <Activity size={28} color="#ec4899" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Attendance Tracking</Text>
              <Text style={styles.menuSubtitle}>Monitor staff attendance and timesheets</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#fed7aa' }]}>
              <ClipboardList size={28} color="#ea580c" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Performance Reports</Text>
              <Text style={styles.menuSubtitle}>View staff performance metrics</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <StaffRequestModal
        visible={showStaffRequestModal}
        onClose={() => setShowStaffRequestModal(false)}
        onSubmit={handleStaffRequestSubmit}
        masterAccountId={user?.masterAccountId || ''}
        siteId={user?.siteId || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  menuContainer: {
    marginHorizontal: 16,
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
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
    color: '#fff',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#a0a0a0',
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
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#8b5cf6',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
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
    fontWeight: '600' as const,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
