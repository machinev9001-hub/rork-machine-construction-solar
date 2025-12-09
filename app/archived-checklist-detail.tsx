import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Circle, ArrowLeft, FileText, User, Calendar, AlertCircle } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { DailyChecklistEntry } from '@/types';

export default function ArchivedChecklistDetailScreen() {
  const { checklistId } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [checklist, setChecklist] = useState<DailyChecklistEntry | null>(null);

  const loadChecklistDetails = useCallback(async () => {
    if (!checklistId || typeof checklistId !== 'string') return;

    try {
      setIsLoading(true);
      const checklistRef = doc(db, 'dailyChecklists', checklistId);
      const checklistDoc = await getDoc(checklistRef);

      if (checklistDoc.exists()) {
        setChecklist({ id: checklistDoc.id, ...checklistDoc.data() } as DailyChecklistEntry);
      }
    } catch (error) {
      console.error('[ArchivedChecklistDetail] Error loading checklist:', error);
    } finally {
      setIsLoading(false);
    }
  }, [checklistId]);

  useEffect(() => {
    loadChecklistDetails();
  }, [loadChecklistDetails]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checklist Details</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading checklist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!checklist) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checklist Details</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.emptyContainer}>
          <AlertCircle size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>Checklist not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const groupedItems = checklist.checklist.reduce((acc, item) => {
    const category = getCategoryForItem(item.label);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof checklist.checklist>);

  const completionPercentage = checklist.totalCount > 0 
    ? Math.round((checklist.completedCount / checklist.totalCount) * 100) 
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checklist Details</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={[
          styles.statusCard,
          checklist.isFullyCompleted ? styles.statusCardComplete : styles.statusCardIncomplete
        ]}>
          <View style={styles.statusHeader}>
            {checklist.isFullyCompleted ? (
              <CheckCircle2 size={28} color="#10b981" strokeWidth={2.5} />
            ) : (
              <AlertCircle size={28} color="#f59e0b" strokeWidth={2.5} />
            )}
            <View style={styles.statusInfo}>
              <Text style={[
                styles.statusTitle,
                checklist.isFullyCompleted ? styles.statusTitleComplete : styles.statusTitleIncomplete
              ]}>
                {checklist.isFullyCompleted ? 'Fully Completed' : 'Partially Completed'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {checklist.completedCount} of {checklist.totalCount} items ({completionPercentage}%)
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <FileText size={18} color="#64748b" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Asset Type</Text>
              <Text style={styles.infoValue}>{checklist.assetType}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <FileText size={18} color="#64748b" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Asset ID</Text>
              <Text style={styles.infoValue}>{checklist.assetId}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <User size={18} color="#64748b" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Operator</Text>
              <Text style={styles.infoValue}>{checklist.operatorName}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Calendar size={18} color="#64748b" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {new Date(checklist.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </View>
          </View>

          {checklist.submittedAt && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Calendar size={18} color="#64748b" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Submitted At</Text>
                <Text style={styles.infoValue}>
                  {new Date(
                    typeof checklist.submittedAt === 'object' && 'toDate' in checklist.submittedAt
                      ? checklist.submittedAt.toDate()
                      : checklist.submittedAt
                  ).toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {checklist.notes && (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Operator Notes</Text>
            <Text style={styles.notesText}>{checklist.notes}</Text>
          </View>
        )}

        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Completion Progress</Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${completionPercentage}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {checklist.completedCount} / {checklist.totalCount} completed
          </Text>
        </View>

        {Object.entries(groupedItems).map(([category, items]) => (
          <View key={category} style={styles.categoryCard}>
            <Text style={styles.categoryTitle}>{category}</Text>
            
            {items.map((item) => (
              <View key={item.id} style={[
                styles.checklistItem,
                item.completed && styles.checklistItemCompleted
              ]}>
                <View style={styles.checkboxContainer}>
                  {item.completed ? (
                    <CheckCircle2 size={22} color="#10b981" strokeWidth={2.5} />
                  ) : (
                    <Circle size={22} color="#cbd5e1" strokeWidth={2} />
                  )}
                </View>
                <View style={styles.itemContent}>
                  <Text style={[
                    styles.itemLabel,
                    item.completed && styles.itemLabelCompleted
                  ]}>
                    {item.label}
                  </Text>
                  {item.completed && item.completedAt && (
                    <Text style={styles.itemMeta}>
                      Checked at {new Date(
                        typeof item.completedAt === 'object' && 'toDate' in item.completedAt
                          ? item.completedAt.toDate()
                          : item.completedAt
                      ).toLocaleTimeString()}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function getCategoryForItem(label: string): string {
  const lower = label.toLowerCase();
  
  if (lower.includes('fire') || lower.includes('extinguish') || lower.includes('first aid') || 
      lower.includes('ppe') || lower.includes('seat belt') || lower.includes('emergency') ||
      lower.includes('safety') || lower.includes('lock out')) {
    return 'Safety';
  }
  
  if (lower.includes('oil') || lower.includes('hydraulic') || lower.includes('coolant') ||
      lower.includes('leak') || lower.includes('grease') || lower.includes('battery') ||
      lower.includes('engine') || lower.includes('brake') || lower.includes('mechanical') ||
      lower.includes('tire') || lower.includes('wheel') || lower.includes('track')) {
    return 'Mechanical';
  }
  
  if (lower.includes('light') || lower.includes('indicator') || lower.includes('horn') ||
      lower.includes('hooter') || lower.includes('alarm') || lower.includes('strobe') ||
      lower.includes('mirror') || lower.includes('wiper') || lower.includes('screen')) {
    return 'Electrical';
  }
  
  if (lower.includes('instrument') || lower.includes('control') || lower.includes('hour') ||
      lower.includes('tacho') || lower.includes('meter') || lower.includes('time sheet')) {
    return 'Documentation';
  }
  
  return 'General';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statusCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
  },
  statusCardComplete: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  statusCardIncomplete: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde047',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  statusTitleComplete: {
    color: '#15803d',
  },
  statusTitleIncomplete: {
    color: '#b45309',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#0f172a',
  },
  notesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notesTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600' as const,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  checklistItemCompleted: {
    backgroundColor: '#f0fdf4',
  },
  checkboxContainer: {
    paddingTop: 2,
  },
  itemContent: {
    flex: 1,
    gap: 4,
  },
  itemLabel: {
    fontSize: 15,
    color: '#0f172a',
  },
  itemLabelCompleted: {
    color: '#15803d',
    fontWeight: '500' as const,
  },
  itemMeta: {
    fontSize: 12,
    color: '#10b981',
  },
});
