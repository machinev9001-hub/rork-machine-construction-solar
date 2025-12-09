import { Stack, router } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckSquare, Square, Send, AlertCircle, Home, Settings } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset, ChecklistItem, DailyChecklistEntry } from '@/types';

export default function OperatorChecklistScreen() {
  const { user } = useAuth();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [notes, setNotes] = useState('');
  const [asset, setAsset] = useState<PlantAsset | null>(null);
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);

  const loadOperatorAssetAndChecklist = useCallback(async () => {


    if (!user?.userId || !user?.masterAccountId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('[OperatorChecklist] Loading asset for operator:', user.userId);

      const assetsQuery = query(
        collection(db, 'plantAssets'),
        where('masterAccountId', '==', user.masterAccountId),
        where('currentOperatorId', '==', user.userId)
      );

      const assetsSnapshot = await getDocs(assetsQuery);

      if (assetsSnapshot.empty) {
        console.log('[OperatorChecklist] No plant asset assigned to operator');
        Alert.alert('No Asset Assigned', 'You do not have a plant asset assigned. Please contact your supervisor.');
        setIsLoading(false);
        return;
      }

      const assetData = { id: assetsSnapshot.docs[0].id, ...assetsSnapshot.docs[0].data() } as PlantAsset;
      setAsset(assetData);

      const masterChecklist = assetData.checklist || [];
      if (masterChecklist.length === 0) {
        console.log('[OperatorChecklist] No checklist template found for asset');
        Alert.alert('No Checklist Template', 'This asset does not have a checklist template. Please contact HSE.');
        setIsLoading(false);
        return;
      }

      const freshChecklist: ChecklistItem[] = masterChecklist.map(item => ({
        ...item,
        completed: false,
        completedAt: undefined,
        completedBy: undefined,
      }));

      setChecklistItems(freshChecklist);

      const today = new Date().toISOString().split('T')[0];
      const checklistQuery = query(
        collection(db, 'dailyChecklists'),
        where('assetId', '==', assetData.assetId),
        where('operatorId', '==', user.userId),
        where('date', '==', today),
        limit(1)
      );

      const checklistSnapshot = await getDocs(checklistQuery);
      if (!checklistSnapshot.empty) {
        setHasSubmittedToday(true);
        console.log('[OperatorChecklist] Checklist already submitted for today');
      }

      console.log('[OperatorChecklist] Loaded checklist with', freshChecklist.length, 'items');
    } catch (error) {
      console.error('[OperatorChecklist] Error loading checklist:', error);
      Alert.alert('Error', 'Failed to load checklist. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOperatorAssetAndChecklist();
  }, [loadOperatorAssetAndChecklist]);

  const toggleItem = (id: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedItems(newChecked);
  };

  const handleSubmit = () => {
    const allChecked = checkedItems.size === checklistItems.length;
    
    if (!allChecked) {
      Alert.alert(
        'Incomplete Checklist',
        `You have checked ${checkedItems.size} of ${checklistItems.length} items. Are you sure you want to submit?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit Anyway',
            onPress: () => submitChecklist()
          }
        ]
      );
    } else {
      submitChecklist();
    }
  };

  const submitChecklist = async () => {
    if (!user || !asset) return;

    try {
      setIsSaving(true);

      const completedChecklist: ChecklistItem[] = checklistItems.map(item => ({
        ...item,
        completed: checkedItems.has(item.id),
        completedAt: checkedItems.has(item.id) ? new Date() : undefined,
        completedBy: checkedItems.has(item.id) ? user.userId : undefined,
      }));

      const dailyChecklistEntry: Omit<DailyChecklistEntry, 'id'> = {
        assetId: asset.assetId,
        assetType: asset.type,
        date: new Date().toISOString().split('T')[0],
        operatorId: user.userId,
        operatorName: user.name,
        checklist: completedChecklist,
        completedCount: checkedItems.size,
        totalCount: checklistItems.length,
        isFullyCompleted: checkedItems.size === checklistItems.length,
        notes: notes.trim() || undefined,
        siteId: user.siteId,
        siteName: user.siteName,
        masterAccountId: user.masterAccountId || '',
        companyId: user.currentCompanyId,
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'dailyChecklists'), dailyChecklistEntry);

      console.log('[OperatorChecklist] Checklist submitted successfully');
      
      Alert.alert(
        'Success',
        'Daily checklist submitted successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              setCheckedItems(new Set());
              setNotes('');
              setHasSubmittedToday(true);
            }
          }
        ]
      );
    } catch (error) {
      console.error('[OperatorChecklist] Error submitting checklist:', error);
      Alert.alert('Error', 'Failed to submit checklist. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const groupedItems = checklistItems.reduce((acc, item) => {
    const category = getCategoryForItem(item.label);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const progress = checklistItems.length > 0 ? (checkedItems.size / checklistItems.length) * 100 : 0;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen 
          options={{ 
            title: 'Daily Checklist',
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerTintColor: '#0f172a',
            headerTitleStyle: {
              fontWeight: '600' as const,
            },
          }} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading checklist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!asset || checklistItems.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen 
          options={{ 
            title: 'Daily Checklist',
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerTintColor: '#0f172a',
            headerTitleStyle: {
              fontWeight: '600' as const,
            },
          }} 
        />
        <View style={styles.emptyContainer}>
          <AlertCircle size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Checklist Available</Text>
          <Text style={styles.emptySubtitle}>
            {!asset 
              ? 'No plant asset is assigned to you.' 
              : 'This asset does not have a checklist template.'}
          </Text>
          <Text style={styles.emptyContact}>Please contact your supervisor or HSE.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (hasSubmittedToday) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen 
          options={{ 
            title: 'Daily Checklist',
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerTintColor: '#0f172a',
            headerTitleStyle: {
              fontWeight: '600' as const,
            },
          }} 
        />
        <View style={styles.submittedContainer}>
          <CheckSquare size={64} color="#10b981" />
          <Text style={styles.submittedTitle}>Checklist Complete</Text>
          <Text style={styles.submittedSubtitle}>
            You have already submitted your daily checklist for today.
          </Text>
          <Text style={styles.submittedDate}>
            {new Date().toLocaleDateString()}
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{ 
          title: 'Daily Checklist',
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTintColor: '#0f172a',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }} 
      />

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerCard}>
          <Text style={styles.title}>Daily Safety Checklist</Text>
          <Text style={styles.subtitle}>Complete all items before starting work</Text>
          
          <View style={styles.assetInfo}>
            <Text style={styles.assetLabel}>Asset:</Text>
            <Text style={styles.assetValue}>{asset.type}</Text>
          </View>
          <View style={styles.assetInfo}>
            <Text style={styles.assetLabel}>ID:</Text>
            <Text style={styles.assetValue}>{asset.assetId}</Text>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {checkedItems.size} of {checklistItems.length} completed
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Operator:</Text>
            <Text style={styles.infoValue}>{user?.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        {Object.entries(groupedItems).map(([category, items]) => (
          <View key={category} style={styles.categoryCard}>
            <Text style={styles.categoryTitle}>{category}</Text>
            
            {items.map((item) => {
              const isChecked = checkedItems.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.checklistItem,
                    isChecked && styles.checklistItemChecked
                  ]}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  {isChecked ? (
                    <CheckSquare size={24} color="#10b981" strokeWidth={2.5} />
                  ) : (
                    <Square size={24} color="#94a3b8" strokeWidth={2} />
                  )}
                  <Text style={[
                    styles.checklistLabel,
                    isChecked && styles.checklistLabelChecked
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={styles.notesCard}>
          <Text style={styles.notesTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any observations or issues..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isSaving}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (checkedItems.size === 0 || isSaving) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={checkedItems.size === 0 || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Send size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Checklist</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <AlertCircle size={16} color="#3b82f6" />
          <Text style={styles.infoText}>
            This checklist must be completed daily before operating any plant equipment. Report any issues immediately to your supervisor.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.push('/operator-home')}
        >
          <Home size={24} color="#64748b" strokeWidth={2} />
          <Text style={styles.navButtonText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.push('/operator-home')}
        >
          <Settings size={24} color="#64748b" strokeWidth={2} />
          <Text style={styles.navButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#f1f5f9',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
    padding: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyContact: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  submittedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  submittedTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#10b981',
    marginTop: 16,
  },
  submittedSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  submittedDate: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#0f172a',
    marginTop: 8,
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  assetInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  assetLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  assetValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600' as const,
  },
  progressContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 14,
    color: '#0f172a',
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
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  checklistItemChecked: {
    backgroundColor: '#f0fdf4',
  },
  checklistLabel: {
    fontSize: 15,
    color: '#0f172a',
    flex: 1,
  },
  checklistLabelChecked: {
    color: '#15803d',
    fontWeight: '500' as const,
  },
  notesCard: {
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
  notesTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#0f172a',
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 100,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1e40af',
    flex: 1,
    lineHeight: 18,
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
  navButtonText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500' as const,
  },
});
