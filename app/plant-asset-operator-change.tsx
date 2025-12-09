import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { ArrowLeft, UserCheck, Clock, User, History, Plus } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset, OperatorHistory } from '@/types';

export default function PlantAssetOperatorChangeScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const { user } = useAuth();
  const [asset, setAsset] = useState<PlantAsset | null>(null);
  const [operators, setOperators] = useState<{ id: string; name: string; contact: string; }[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<{ id: string; name: string; contact: string; } | null>(null);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showOperatorDropdown, setShowOperatorDropdown] = useState(false);
  const [operatorSearch, setOperatorSearch] = useState('');

  useEffect(() => {
    loadAssetData();
    loadOperators();
  }, [assetId]);

  const loadAssetData = async () => {
    if (!assetId) return;

    try {
      const assetRef = doc(db, 'plantAssets', assetId);
      const assetDoc = await getDoc(assetRef);
      
      if (assetDoc.exists()) {
        setAsset({ id: assetDoc.id, ...assetDoc.data() } as PlantAsset);
      }
    } catch (error) {
      console.error('[OperatorChange] Error loading asset:', error);
      Alert.alert('Error', 'Failed to load asset data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOperators = async () => {
    if (!user?.masterAccountId) return;
    
    try {
      const employeesRef = collection(db, 'employees');
      const employeesQuery = query(
        employeesRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('role', '==', 'Operator'),
        orderBy('name')
      );
      const employeesSnapshot = await getDocs(employeesQuery);
      
      const operatorsList: { id: string; name: string; contact: string; }[] = [];
      employeesSnapshot.forEach((doc) => {
        const data = doc.data();
        operatorsList.push({
          id: doc.id,
          name: data.name || '',
          contact: data.contact || ''
        });
      });
      
      setOperators(operatorsList);
    } catch (error) {
      console.error('[OperatorChange] Error loading operators:', error);
    }
  };

  const handleChangeOperator = async () => {
    if (!selectedOperator) {
      Alert.alert('Required', 'Please select a new operator');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Required', 'Please provide a reason for changing the operator');
      return;
    }

    if (!asset || !assetId || !user) return;

    setIsSaving(true);
    
    try {
      const assetRef = doc(db, 'plantAssets', assetId);
      
      // Prepare operator history entry for current operator
      const currentOperatorHistory = asset.operatorHistory || [];
      
      // If there's a current operator, mark them as removed
      if (asset.currentOperatorId) {
        const lastEntry = currentOperatorHistory[currentOperatorHistory.length - 1];
        if (lastEntry && !lastEntry.removedAt) {
          lastEntry.removedAt = serverTimestamp();
          lastEntry.removedBy = user.userId;
        }
      }

      // Add new operator to history
      const newOperatorEntry: OperatorHistory = {
        operatorId: selectedOperator.id,
        operatorName: selectedOperator.name,
        operatorContact: selectedOperator.contact,
        assignedAt: serverTimestamp(),
        assignedBy: user.userId,
        reason,
      };

      const updatedHistory = [...currentOperatorHistory, newOperatorEntry];

      // Update the asset with new operator
      await updateDoc(assetRef, {
        currentOperator: `${selectedOperator.name} (${selectedOperator.contact})`,
        currentOperatorId: selectedOperator.id,
        operatorHistory: updatedHistory,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: user.userId,
      });

      Alert.alert(
        'Success',
        `Operator has been changed to ${selectedOperator.name}. Previous operator data and timesheets have been preserved.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('[OperatorChange] Error changing operator:', error);
      Alert.alert('Error', 'Failed to change operator');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredOperators = operators.filter((op) =>
    op.name.toLowerCase().includes(operatorSearch.toLowerCase()) ||
    op.contact.toLowerCase().includes(operatorSearch.toLowerCase())
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading asset data...</Text>
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Asset not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Change Operator',
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          disabled={isSaving}
        >
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Operator</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.assetInfo}>
          <Text style={styles.assetId}>Asset: {asset.assetId}</Text>
          <Text style={styles.assetType}>{asset.type}</Text>
          {asset.currentOperator && (
            <View style={styles.currentOperatorBadge}>
              <User size={16} color="#3b82f6" />
              <Text style={styles.currentOperatorText}>Current: {asset.currentOperator}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select New Operator</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowOperatorDropdown(!showOperatorDropdown)}
            disabled={isSaving}
          >
            <Text style={selectedOperator ? styles.dropdownText : styles.dropdownPlaceholder}>
              {selectedOperator ? `${selectedOperator.name} (${selectedOperator.contact})` : 'Select operator'}
            </Text>
          </TouchableOpacity>
          
          {showOperatorDropdown && (
            <View style={styles.dropdownContainer}>
              <TextInput
                style={styles.dropdownSearch}
                placeholder="Search operators..."
                value={operatorSearch}
                onChangeText={setOperatorSearch}
                autoFocus
              />
              <ScrollView style={styles.dropdownList} keyboardShouldPersistTaps="handled">
                {filteredOperators.map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedOperator(op);
                      setShowOperatorDropdown(false);
                      setOperatorSearch('');
                    }}
                  >
                    <View>
                      <Text style={styles.dropdownItemText}>{op.name}</Text>
                      <Text style={styles.dropdownItemSubtext}>{op.contact}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Change</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Enter reason for operator change..."
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!isSaving}
          />
        </View>

        {asset.operatorHistory && asset.operatorHistory.length > 0 && (
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <History size={20} color="#64748b" />
              <Text style={styles.sectionTitle}>Operator History</Text>
            </View>
            <View style={styles.historyList}>
              {asset.operatorHistory.map((entry, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyDot} />
                  <View style={styles.historyContent}>
                    <Text style={styles.historyOperator}>{entry.operatorName}</Text>
                    <Text style={styles.historyContact}>{entry.operatorContact}</Text>
                    <View style={styles.historyDates}>
                      <Text style={styles.historyDate}>
                        <Clock size={12} color="#64748b" /> Assigned: {formatDate(entry.assignedAt)}
                      </Text>
                      {entry.removedAt && (
                        <Text style={styles.historyDate}>
                          Removed: {formatDate(entry.removedAt)}
                        </Text>
                      )}
                    </View>
                    {entry.reason && (
                      <Text style={styles.historyReason}>Reason: {entry.reason}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.noteSection}>
          <Text style={styles.noteTitle}>Important Note</Text>
          <Text style={styles.noteText}>
            Changing the operator will NOT delete previous operator timesheets or data. 
            All historical data is preserved for reporting and auditing purposes.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
          onPress={handleChangeOperator}
          disabled={isSaving || !selectedOperator || !reason.trim()}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <UserCheck size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Change Operator</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
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
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  assetInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  assetId: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  assetType: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  currentOperatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  currentOperatorText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '500' as const,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 12,
  },
  dropdownButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dropdownText: {
    fontSize: 15,
    color: '#1e293b',
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    maxHeight: 250,
  },
  dropdownSearch: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#1e293b',
  },
  dropdownItemSubtext: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  reasonInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 80,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  historyList: {
    gap: 16,
  },
  historyItem: {
    flexDirection: 'row',
    gap: 12,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginTop: 6,
  },
  historyContent: {
    flex: 1,
    gap: 4,
  },
  historyOperator: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  historyContact: {
    fontSize: 13,
    color: '#64748b',
  },
  historyDates: {
    marginTop: 4,
    gap: 2,
  },
  historyDate: {
    fontSize: 12,
    color: '#64748b',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyReason: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  noteSection: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400e',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});