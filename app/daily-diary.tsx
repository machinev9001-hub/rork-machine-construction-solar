import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, CheckCircle, Archive, ChevronRight, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/utils/hooks/useTheme';
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';

type DiaryEntry = {
  id: string;
  activityId: string;
  activityName: string;
  taskId: string;
  taskName: string;
  pvArea: string;
  blockArea: string;
  subActivity: string;
  subActivityName: string;
  mainMenu: string;
  note: string;
  createdAt: any;
  updatedAt: any;
  archived: boolean;
  supervisorId: string;
  supervisorName: string;
  isPriority?: boolean;
};

export default function DailyDiaryScreen() {
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
      console.log('📚 Loading diary entries for supervisor:', user.userId);
      setIsLoading(true);

      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('supervisorInputBy', '==', user.userId)
      );
      
      const snapshot = await getDocs(q);
      
      const activeEntries: DiaryEntry[] = [];
      const archived: DiaryEntry[] = [];

      for (const activityDoc of snapshot.docs) {
        const activityData = activityDoc.data();
        
        const diaryEntriesRef = collection(db, 'activities', activityDoc.id, 'diaryEntries');
        const diaryEntriesSnapshot = await getDocs(diaryEntriesRef);
        
        if (diaryEntriesSnapshot.empty) {
          continue;
        }

        const taskRef = doc(db, 'tasks', activityData.taskId);
        const tasksRef = collection(db, 'tasks');
        const taskQuery = query(tasksRef, where('__name__', '==', activityData.taskId));
        const taskSnapshot = await getDocs(taskQuery);
        
        let taskData: any = {};
        if (!taskSnapshot.empty) {
          taskData = taskSnapshot.docs[0].data();
        }

        for (const diaryEntryDoc of diaryEntriesSnapshot.docs) {
          const diaryEntryData = diaryEntryDoc.data();
          
          const entry: DiaryEntry = {
            id: diaryEntryDoc.id,
            activityId: activityData.activityId || '',
            activityName: activityData.name || 'Unknown Activity',
            taskId: activityData.taskId || '',
            taskName: taskData.name || 'Unknown Task',
            pvArea: taskData.pvArea || '',
            blockArea: taskData.blockArea || '',
            subActivity: activityData.subMenuKey || '',
            subActivityName: taskData.subActivityName || '',
            mainMenu: activityData.mainMenu || '',
            note: diaryEntryData.note || '',
            createdAt: diaryEntryData.submittedAt || activityData.createdAt,
            updatedAt: diaryEntryData.submittedAt || activityData.updatedAt,
            archived: diaryEntryData.archived || false,
            supervisorId: user.userId,
            supervisorName: user.name || user.userId,
            isPriority: diaryEntryData.isPriority || false,
          };

          if (entry.archived) {
            archived.push(entry);
          } else {
            activeEntries.push(entry);
          }
        }
      }

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
      
      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', entry.taskId),
        where('activityId', '==', entry.activityId)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const activityDocId = snapshot.docs[0].id;
        const diaryEntryRef = doc(db, 'activities', activityDocId, 'diaryEntries', entry.id);
        
        await updateDoc(diaryEntryRef, {
          archived: true,
          archivedAt: new Date(),
        });

        setEntries(prev => prev.filter(e => e.id !== entry.id));
        setArchivedEntries(prev => [...prev, { ...entry, archived: true }]);

        Alert.alert('Success', 'Diary entry archived');
      }
    } catch (error) {
      console.error('❌ Error archiving entry:', error);
      Alert.alert('Error', 'Failed to archive entry');
    }
  };

  const handleViewTask = (entry: DiaryEntry) => {
    console.log('🔍 Navigating to task:', entry.taskId);
    router.push({
      pathname: '/supervisor-task-detail',
      params: {
        activity: entry.mainMenu,
        subActivity: entry.subActivity,
        name: entry.subActivityName,
      },
    });
  };

  const renderEntry = ({ item }: { item: DiaryEntry }) => (
    <View style={[
      styles.entryCard, 
      { backgroundColor: theme.cardBg },
      item.isPriority && styles.priorityCard,
    ]}>
      <View style={styles.entryHeader}>
        <View style={styles.entryHeaderLeft}>
          <Text style={[styles.entryTaskName, { color: theme.textSecondary }]}>{item.taskName}</Text>
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
          </View>
        </View>
        <View style={styles.entryHeaderRight}>
          {item.isPriority && (
            <View style={styles.priorityBadge}>
              <AlertCircle size={12} color="#fff" />
              <Text style={styles.priorityBadgeText}>URGENT</Text>
            </View>
          )}
          <BookOpen size={18} color={item.isPriority ? '#ef4444' : roleAccentColor} />
        </View>
      </View>

      <View style={[styles.noteContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.noteText, { color: theme.text }]} numberOfLines={3}>
          {item.note}
        </Text>
      </View>

      <View style={styles.entryActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton, { backgroundColor: '#3b82f6' }]}
          onPress={() => handleViewTask(item)}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewButtonText, { color: '#fff' }]}>View Task</Text>
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
          title: 'Daily Diary',
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
            <Text style={[styles.headerTitle, { color: theme.text }]}>Daily Diary</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Your activity notes and reminders
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
                  : 'Add notes to activities to see them here'}
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
  entryActivityName: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  entryTaskName: {
    fontSize: 13,
    fontWeight: '600' as const,
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
    borderLeftColor: '#3b82f6',
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
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
