import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, CheckCircle, Archive, ChevronRight, AlertCircle, Truck } from 'lucide-react-native';
import { useTheme } from '@/utils/hooks/useTheme';
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';

type DiaryEntry = {
  id: string;
  requestId: string;
  plantType: string;
  quantity: number;
  pvArea: string;
  blockArea: string;
  purpose: string;
  requestedBy: string;
  requestedByName: string;
  scheduledDate: any;
  note: string;
  createdAt: any;
  updatedAt: any;
  archived: boolean;
  isPriority?: boolean;
  notificationType: 'plant_allocation_due';
};

export default function PlantManagerDiaryScreen() {
  const { user } = useAuth();
  const { theme, roleAccentColor, commonStyles } = useTheme();
  const router = useRouter();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [archivedEntries, setArchivedEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    loadDiaryEntries();
  }, [user?.userId, user?.siteId]);

  const loadDiaryEntries = async () => {
    if (!user?.userId || !user?.siteId) {
      console.log('❌ Missing userId or siteId');
      setIsLoading(false);
      return;
    }

    try {
      console.log('📚 Loading plant manager diary entries for:', user.userId);
      setIsLoading(true);

      const diaryEntriesRef = collection(db, 'plantManagerDiary');
      const q = query(
        diaryEntriesRef,
        where('plantManagerId', '==', user.userId),
        where('siteId', '==', user.siteId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      const activeEntries: DiaryEntry[] = [];
      const archived: DiaryEntry[] = [];

      snapshot.docs.forEach(diaryDoc => {
        const diaryData = diaryDoc.data();
        
        const entry: DiaryEntry = {
          id: diaryDoc.id,
          requestId: diaryData.requestId || '',
          plantType: diaryData.plantType || 'Unknown',
          quantity: diaryData.quantity || 0,
          pvArea: diaryData.pvArea || '',
          blockArea: diaryData.blockArea || '',
          purpose: diaryData.purpose || '',
          requestedBy: diaryData.requestedBy || '',
          requestedByName: diaryData.requestedByName || '',
          scheduledDate: diaryData.scheduledDate,
          note: diaryData.note || '',
          createdAt: diaryData.createdAt,
          updatedAt: diaryData.updatedAt,
          archived: diaryData.archived || false,
          isPriority: diaryData.isPriority || false,
          notificationType: diaryData.notificationType || 'plant_allocation_due',
        };

        if (entry.archived) {
          archived.push(entry);
        } else {
          activeEntries.push(entry);
        }
      });

      activeEntries.sort((a, b) => {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return timeB - timeA;
      });

      archived.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return timeB - timeA;
      });

      console.log('✅ Loaded', activeEntries.length, 'active entries and', archived.length, 'archived entries');
      setEntries(activeEntries);
      setArchivedEntries(archived);
    } catch (error) {
      console.error('❌ Error loading diary entries:', error);
      Alert.alert('Error', 'Failed to load diary entries');
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchiveEntry = async (entry: DiaryEntry) => {
    try {
      console.log('📥 Archiving entry:', entry.id);
      
      const diaryEntryRef = doc(db, 'plantManagerDiary', entry.id);
      
      await updateDoc(diaryEntryRef, {
        archived: true,
        archivedAt: new Date(),
      });

      setEntries(prev => prev.filter(e => e.id !== entry.id));
      setArchivedEntries(prev => [...prev, { ...entry, archived: true }]);

      Alert.alert('Success', 'Diary entry archived');
    } catch (error) {
      console.error('❌ Error archiving entry:', error);
      Alert.alert('Error', 'Failed to archive entry');
    }
  };

  const handleViewRequest = (entry: DiaryEntry) => {
    console.log('🔍 Navigating to plant allocation requests with requestId:', entry.requestId);
    router.push('/plant-allocation-requests');
  };

  const renderEntry = ({ item }: { item: DiaryEntry }) => (
    <View style={[
      styles.entryCard, 
      { backgroundColor: theme.cardBg },
      item.isPriority && styles.priorityCard,
    ]}>
      <View style={styles.entryHeader}>
        <View style={styles.entryHeaderLeft}>
          <Text style={[styles.entryPlantType, { color: theme.text }]}>{item.plantType}</Text>
          <View style={styles.entryMetadata}>
            {item.pvArea && (
              <View style={styles.metadataRow}>
                <Text style={[styles.metadataLabel, { color: theme.textSecondary }]}>PV:</Text>
                <Text style={[styles.metadataValue, { color: theme.text }]}>{item.pvArea}</Text>
              </View>
            )}
            {item.blockArea && (
              <View style={styles.metadataRow}>
                <Text style={[styles.metadataLabel, { color: theme.textSecondary }]}>Block:</Text>
                <Text style={[styles.metadataValue, { color: theme.text }]}>{item.blockArea}</Text>
              </View>
            )}
            {item.quantity && (
              <View style={styles.metadataRow}>
                <Text style={[styles.metadataLabel, { color: theme.textSecondary }]}>Qty:</Text>
                <Text style={[styles.metadataValue, { color: theme.text }]}>{item.quantity}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.entryHeaderRight}>
          {item.isPriority && (
            <View style={styles.priorityBadge}>
              <AlertCircle size={12} color="#fff" />
              <Text style={styles.priorityBadgeText}>URGENT</Text>
            </View>
          )}
          <Truck size={18} color={item.isPriority ? '#ef4444' : roleAccentColor} />
        </View>
      </View>

      <View style={[styles.noteContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.noteText, { color: theme.text }]} numberOfLines={3}>
          {item.note || item.purpose || 'Plant allocation due'}
        </Text>
      </View>

      {item.requestedByName && (
        <View style={styles.requestedByRow}>
          <Text style={[styles.requestedByLabel, { color: theme.textSecondary }]}>Requested by:</Text>
          <Text style={[styles.requestedByValue, { color: theme.text }]}>{item.requestedByName}</Text>
        </View>
      )}

      {item.scheduledDate && (
        <View style={styles.scheduledDateRow}>
          <Text style={[styles.scheduledDateLabel, { color: theme.textSecondary }]}>Scheduled for:</Text>
          <Text style={[styles.scheduledDateValue, { color: '#ef4444' }]}>
            {item.scheduledDate.toDate().toLocaleString()}
          </Text>
        </View>
      )}

      <View style={styles.entryActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton, { backgroundColor: '#3b82f6' }]}
          onPress={() => handleViewRequest(item)}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewButtonText, { color: '#fff' }]}>View Request</Text>
          <ChevronRight size={16} color="#fff" />
        </TouchableOpacity>

        {!item.archived && (
          <TouchableOpacity
            style={[styles.actionButton, styles.doneButton, { backgroundColor: '#10b981' }]}
            onPress={() => {
              Alert.alert(
                'Archive Entry',
                'Mark this diary entry as done and archive it?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Archive', onPress: () => handleArchiveEntry(item) },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <CheckCircle size={16} color="#fff" />
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>

      {item.updatedAt && (
        <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
          Updated {item.updatedAt.toDate().toLocaleString()}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[commonStyles.container, styles.container]}>
      <Stack.Screen
        options={{
          title: 'Plant Manager Diary',
          headerStyle: { backgroundColor: theme.headerBg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '600' as const },
        }}
      />
      <View style={[commonStyles.headerBorder, { backgroundColor: roleAccentColor }]} />

      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <View style={styles.headerContent}>
          <BookOpen size={28} color={roleAccentColor} />
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Plant Manager Diary</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Your plant allocation reminders
            </Text>
          </View>
        </View>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              !showArchived && styles.toggleButtonActive,
              !showArchived && { backgroundColor: roleAccentColor },
            ]}
            onPress={() => setShowArchived(false)}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleButtonText, !showArchived && styles.toggleButtonTextActive]}>
              Active ({entries.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              showArchived && styles.toggleButtonActive,
              showArchived && { backgroundColor: roleAccentColor },
            ]}
            onPress={() => setShowArchived(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleButtonText, showArchived && styles.toggleButtonTextActive]}>
              Archived ({archivedEntries.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={roleAccentColor} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading diary entries...</Text>
        </View>
      ) : (
        <FlatList
          data={showArchived ? archivedEntries : entries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {showArchived ? (
                <Archive size={48} color={theme.border} />
              ) : (
                <BookOpen size={48} color={theme.border} />
              )}
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {showArchived ? 'No archived entries' : 'No active diary entries'}
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                {showArchived
                  ? 'Completed entries will appear here'
                  : 'Scheduled plant allocation notifications will appear here'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
  },
  toggleButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  entryCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  priorityCard: {
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  entryHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  priorityBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  entryHeaderLeft: {
    flex: 1,
  },
  entryPlantType: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  entryMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  metadataValue: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  noteContainer: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  requestedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  requestedByLabel: {
    fontSize: 12,
    marginRight: 6,
  },
  requestedByValue: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  scheduledDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  scheduledDateLabel: {
    fontSize: 12,
    marginRight: 6,
  },
  scheduledDateValue: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  entryActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 5,
  },
  viewButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  doneButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  timestamp: {
    fontSize: 10,
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
