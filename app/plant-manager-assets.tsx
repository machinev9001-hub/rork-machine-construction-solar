import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { ArrowLeft, Search, X, Package, MapPin, AlertCircle, QrCode, UserCheck } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset, Employee } from '@/types';

type PvArea = {
  id: string;
  name: string;
  siteId: string;
  createdAt: any;
};

type BlockArea = {
  id: string;
  name: string;
  pvAreaId: string;
  pvAreaName: string;
  siteId: string;
  createdAt: any;
};

export default function PlantManagerAssetsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<PlantAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<PlantAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<PlantAsset | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [pvAreas, setPvAreas] = useState<PvArea[]>([]);
  const [blockAreas, setBlockAreas] = useState<BlockArea[]>([]);
  const [selectedPvArea, setSelectedPvArea] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [operators, setOperators] = useState<Employee[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [isAssigningOperator, setIsAssigningOperator] = useState(false);

  const loadAssets = useCallback(async () => {
    console.log('[PlantManagerAssets] Loading assets...');
    if (!user?.masterAccountId || !user?.siteId) {
      console.log('[PlantManagerAssets] No masterAccountId or siteId');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('[PlantManagerAssets] Querying with masterAccountId:', user.masterAccountId, 'siteId:', user.siteId);
      console.log('[PlantManagerAssets] Current user siteName:', user.siteName);
      
      const assetsRef = collection(db, 'plantAssets');
      const q = query(
        assetsRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId)
      );
      
      const querySnapshot = await getDocs(q);
      const loadedAssets: PlantAsset[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as PlantAsset;
        loadedAssets.push({
          id: doc.id,
          ...data,
        });
      });

      const activeAssets = loadedAssets.filter((a) => !a.archived);
      console.log('[PlantManagerAssets] Loaded assets for site', user.siteId, ':', activeAssets.length);
      
      activeAssets.forEach((asset, index) => {
        console.log(`[PlantManagerAssets] Asset ${index + 1}: ${asset.type} (${asset.assetId}), siteId: ${asset.siteId}, masterAccountId: ${asset.masterAccountId}`);
      });
      
      setAssets(activeAssets);
      setFilteredAssets(activeAssets);
    } catch (error) {
      console.error('[PlantManagerAssets] Error loading assets:', error);
      Alert.alert('Error', 'Failed to load plant assets.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.masterAccountId, user?.siteId]);

  const loadPvBlocks = useCallback(async () => {
    if (!user?.masterAccountId || !user?.siteId) return;

    try {
      const pvAreasRef = collection(db, 'pvAreas');
      const pvAreasQuery = query(
        pvAreasRef,
        where('siteId', '==', user.siteId)
      );
      
      const pvAreasSnapshot = await getDocs(pvAreasQuery);
      const loadedPvAreas: PvArea[] = [];
      
      pvAreasSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedPvAreas.push({
          id: docSnap.id,
          name: data.name || '',
          siteId: data.siteId || '',
          createdAt: data.createdAt,
        });
      });

      const blockAreasRef = collection(db, 'blockAreas');
      const blockAreasQuery = query(
        blockAreasRef,
        where('siteId', '==', user.siteId)
      );
      
      const blockAreasSnapshot = await getDocs(blockAreasQuery);
      const loadedBlockAreas: BlockArea[] = [];
      
      blockAreasSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedBlockAreas.push({
          id: docSnap.id,
          name: data.name || '',
          pvAreaId: data.pvAreaId || '',
          pvAreaName: data.pvAreaName || '',
          siteId: data.siteId || '',
          createdAt: data.createdAt,
        });
      });

      console.log('[PlantManagerAssets] Loaded PV Areas:', loadedPvAreas.length, 'Block Areas:', loadedBlockAreas.length);
      setPvAreas(loadedPvAreas);
      setBlockAreas(loadedBlockAreas);
    } catch (error) {
      console.error('[PlantManagerAssets] Error loading PV blocks:', error);
    }
  }, [user?.masterAccountId, user?.siteId]);

  const loadOperators = useCallback(async () => {
    if (!user?.masterAccountId || !user?.siteId) return;

    try {
      const operatorsQuery = query(
        collection(db, 'employees'),
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId),
        where('role', '==', 'Operator'),
        where('archived', '!=', true)
      );
      
      const snapshot = await getDocs(operatorsQuery);
      const operatorsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Employee));
      
      console.log('[PlantManagerAssets] Loaded operators:', operatorsList.length);
      setOperators(operatorsList);
    } catch (error) {
      console.error('[PlantManagerAssets] Error loading operators:', error);
    }
  }, [user?.masterAccountId, user?.siteId]);

  useFocusEffect(
    useCallback(() => {
      loadAssets();
      loadPvBlocks();
      loadOperators();
    }, [loadAssets, loadPvBlocks, loadOperators])
  );

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setFilteredAssets(assets);
    } else {
      const query = text.toLowerCase();
      const filtered = assets.filter((asset) => {
        return (
          asset.assetId.toLowerCase().includes(query) ||
          asset.type.toLowerCase().includes(query) ||
          asset.location?.toLowerCase().includes(query) ||
          asset.subcontractor?.toLowerCase().includes(query)
        );
      });
      setFilteredAssets(filtered);
    }
  }, [assets]);

  const handleAssetPress = (asset: PlantAsset) => {
    setSelectedAsset(asset);
    setShowOptionsModal(true);
  };

  const handleAllocateOption = () => {
    setShowOptionsModal(false);
    setShowAllocateModal(true);
  };

  const handleVASToggleOption = async () => {
    if (!selectedAsset || !selectedAsset.id) return;
    
    setShowOptionsModal(false);
    
    const isCurrentlyListed = selectedAsset.isAvailableForVAS || false;
    
    try {
      const assetRef = doc(db, 'plantAssets', selectedAsset.id);
      await updateDoc(assetRef, {
        isAvailableForVAS: !isCurrentlyListed,
        updatedAt: serverTimestamp(),
      });
      
      Alert.alert(
        'Success',
        isCurrentlyListed
          ? `${selectedAsset.assetId} removed from VAS marketplace.`
          : `${selectedAsset.assetId} is now listed on VAS marketplace.`
      );
      loadAssets();
    } catch (error) {
      console.error('[PlantManagerAssets] Error toggling VAS:', error);
      Alert.alert('Error', 'Failed to update VAS listing.');
    }
  };

  const handleBreakdownOption = async () => {
    if (!selectedAsset || !selectedAsset.id) return;
    
    setShowOptionsModal(false);
    
    try {
      const assetRef = doc(db, 'plantAssets', selectedAsset.id);
      await updateDoc(assetRef, {
        breakdownStatus: true,
        breakdownTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      Alert.alert('Success', `${selectedAsset.assetId} marked as on breakdown.`);
      loadAssets();
    } catch (error) {
      console.error('[PlantManagerAssets] Error marking breakdown:', error);
      Alert.alert('Error', 'Failed to mark asset as breakdown.');
    }
  };

  const handleQROption = () => {
    if (!selectedAsset) return;
    setShowOptionsModal(false);
    router.push({
      pathname: '/generate-plant-qr',
      params: {
        assetId: selectedAsset.assetId,
        assetType: selectedAsset.type,
        location: selectedAsset.location || '',
      },
    });
  };

  const handleAssignOperatorOption = () => {
    setShowOptionsModal(false);
    setShowOperatorModal(true);
    if (selectedAsset?.currentOperatorId) {
      setSelectedOperatorId(selectedAsset.currentOperatorId);
    } else {
      setSelectedOperatorId('');
    }
  };

  const handleOperatorAssignment = async () => {
    if (!selectedAsset || !selectedAsset.id) {
      Alert.alert('Error', 'No asset selected');
      return;
    }

    if (!selectedOperatorId) {
      Alert.alert('Error', 'Please select an operator');
      return;
    }

    setIsAssigningOperator(true);
    try {
      const selectedOperator = operators.find(op => op.id === selectedOperatorId);
      
      const assetRef = doc(db, 'plantAssets', selectedAsset.id);
      await updateDoc(assetRef, {
        currentOperatorId: selectedOperatorId,
        currentOperator: selectedOperator?.name || '',
        updatedAt: serverTimestamp(),
      });
      
      Alert.alert('Success', `Operator ${selectedOperator?.name} assigned to ${selectedAsset.assetId}`);
      setShowOperatorModal(false);
      setSelectedOperatorId('');
      setSelectedAsset(null);
      loadAssets();
    } catch (error) {
      console.error('[PlantManagerAssets] Error assigning operator:', error);
      Alert.alert('Error', 'Failed to assign operator');
    } finally {
      setIsAssigningOperator(false);
    }
  };

  const handleRemoveOperator = async () => {
    if (!selectedAsset || !selectedAsset.id) return;

    Alert.alert(
      'Remove Operator',
      `Remove ${selectedAsset.currentOperator} from ${selectedAsset.assetId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const assetRef = doc(db, 'plantAssets', selectedAsset.id!);
              await updateDoc(assetRef, {
                currentOperatorId: null,
                currentOperator: null,
                updatedAt: serverTimestamp(),
              });
              
              Alert.alert('Success', 'Operator removed');
              setShowOperatorModal(false);
              setSelectedOperatorId('');
              setSelectedAsset(null);
              loadAssets();
            } catch (error) {
              console.error('[PlantManagerAssets] Error removing operator:', error);
              Alert.alert('Error', 'Failed to remove operator');
            }
          }
        }
      ]
    );
  };

  const handleAllocateSubmit = async () => {
    if (!selectedAsset || !selectedAsset.id || !selectedPvArea || !selectedBlock) {
      Alert.alert('Missing Information', 'Please select both PV Area and Block Number.');
      return;
    }

    setIsAllocating(true);
    try {
      const assetRef = doc(db, 'plantAssets', selectedAsset.id);
      await updateDoc(assetRef, {
        allocationStatus: 'ALLOCATED',
        allocatedPvArea: selectedPvArea,
        allocatedBlockNumber: selectedBlock,
        allocationDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      Alert.alert('Success', `${selectedAsset.assetId} allocated to ${selectedPvArea} - Block ${selectedBlock}`);
      setShowAllocateModal(false);
      setSelectedPvArea('');
      setSelectedBlock('');
      setSelectedAsset(null);
      loadAssets();
    } catch (error) {
      console.error('[PlantManagerAssets] Error allocating asset:', error);
      Alert.alert('Error', 'Failed to allocate asset.');
    } finally {
      setIsAllocating(false);
    }
  };

  const sortedPvAreas = [...pvAreas].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    return numA - numB;
  });

  const selectedPvAreaData = pvAreas.find((pv) => pv.name === selectedPvArea);
  const blocksForSelectedPv = blockAreas
    .filter((b) => b.pvAreaId === selectedPvAreaData?.id)
    .sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ''), 10);
      const numB = parseInt(b.name.replace(/\D/g, ''), 10);
      return numA - numB;
    });

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plant Assets</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statsCard}>
        <Package size={32} color="#f59e0b" />
        <Text style={styles.statsValue}>{assets.length}</Text>
        <Text style={styles.statsLabel}>Total Plant Assets</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search assets..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <X size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {filteredAssets.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={48} color="#cbd5e1" />
            <Text style={styles.emptyStateTitle}>No Assets Found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'Try adjusting your search' : 'No plant assets available'}
            </Text>
          </View>
        ) : (
          filteredAssets.map((asset) => (
            <TouchableOpacity
              key={asset.id}
              style={styles.assetCard}
              onPress={() => handleAssetPress(asset)}
              activeOpacity={0.7}
            >
              <View style={styles.assetCardHeader}>
                <Text style={styles.assetId}>{asset.assetId}</Text>
                {asset.allocationStatus === 'ALLOCATED' && (
                  <View style={styles.allocatedBadge}>
                    <MapPin size={12} color="#10b981" />
                    <Text style={styles.allocatedText}>Allocated</Text>
                  </View>
                )}
                {asset.breakdownStatus && (
                  <View style={styles.breakdownBadge}>
                    <AlertCircle size={12} color="#ef4444" />
                    <Text style={styles.breakdownText}>Breakdown</Text>
                  </View>
                )}
              </View>
              <Text style={styles.assetType}>{asset.type}</Text>
              {asset.subcontractor && (
                <View style={styles.subcontractorBadge}>
                  <Text style={styles.subcontractorText}>{asset.subcontractor}</Text>
                </View>
              )}
              {asset.allocationStatus === 'ALLOCATED' && asset.allocatedPvArea && (
                <Text style={styles.allocationInfo}>
                  📍 {asset.allocatedPvArea} - Block {asset.allocatedBlockNumber}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedAsset?.assetId}</Text>
            <Text style={styles.modalSubtitle}>{selectedAsset?.type}</Text>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleAllocateOption}
              activeOpacity={0.7}
            >
              <MapPin size={22} color="#16a34a" />
              <Text style={styles.optionText}>Allocate to PV + Block</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleBreakdownOption}
              activeOpacity={0.7}
            >
              <AlertCircle size={22} color="#ef4444" />
              <Text style={styles.optionText}>Book on Breakdown</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleQROption}
              activeOpacity={0.7}
            >
              <QrCode size={22} color="#f59e0b" />
              <Text style={styles.optionText}>View QR Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleVASToggleOption}
              activeOpacity={0.7}
            >
              <Package size={22} color="#3b82f6" />
              <Text style={styles.optionText}>
                {selectedAsset?.isAvailableForVAS ? 'Remove from VAS' : 'List on VAS Marketplace'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleAssignOperatorOption}
              activeOpacity={0.7}
            >
              <UserCheck size={22} color="#8b5cf6" />
              <Text style={styles.optionText}>
                {selectedAsset?.currentOperator ? `Change Operator (${selectedAsset.currentOperator})` : 'Assign Operator'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowOptionsModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showAllocateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllocateModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowAllocateModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Allocate Asset</Text>
            <Text style={styles.modalSubtitle}>{selectedAsset?.assetId}</Text>

            <Text style={styles.label}>Select PV Area</Text>
            {sortedPvAreas.length === 0 ? (
              <View style={styles.emptyPickerState}>
                <Text style={styles.emptyPickerText}>No PV Areas available. Please add PV Areas first.</Text>
              </View>
            ) : (
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                {sortedPvAreas.map((pvArea) => (
                  <TouchableOpacity
                    key={pvArea.id}
                    style={[
                      styles.pickerOption,
                      selectedPvArea === pvArea.name && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedPvArea(pvArea.name);
                      setSelectedBlock('');
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        selectedPvArea === pvArea.name && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {pvArea.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {selectedPvArea && (
              <>
                <Text style={styles.label}>Select Block Number</Text>
                {blocksForSelectedPv.length === 0 ? (
                  <View style={styles.emptyPickerState}>
                    <Text style={styles.emptyPickerText}>No blocks available for {selectedPvArea}. Please add blocks first.</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {blocksForSelectedPv.map((block) => (
                      <TouchableOpacity
                        key={block.id}
                        style={[
                          styles.pickerOption,
                          selectedBlock === block.name && styles.pickerOptionSelected,
                        ]}
                        onPress={() => setSelectedBlock(block.name)}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            selectedBlock === block.name && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {block.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedPvArea || !selectedBlock || isAllocating) && styles.submitButtonDisabled,
              ]}
              onPress={handleAllocateSubmit}
              disabled={!selectedPvArea || !selectedBlock || isAllocating}
              activeOpacity={0.7}
            >
              {isAllocating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Allocate</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAllocateModal(false);
                setSelectedPvArea('');
                setSelectedBlock('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Operator Assignment Modal */}
      <Modal
        visible={showOperatorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOperatorModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowOperatorModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Assign Operator</Text>
            <Text style={styles.modalSubtitle}>{selectedAsset?.assetId} - {selectedAsset?.type}</Text>

            {selectedAsset?.currentOperator && (
              <View style={styles.currentOperatorBadge}>
                <Text style={styles.currentOperatorLabel}>Current Operator:</Text>
                <Text style={styles.currentOperatorName}>{selectedAsset.currentOperator}</Text>
              </View>
            )}

            <Text style={styles.label}>Select Operator</Text>
            {operators.length === 0 ? (
              <View style={styles.emptyPickerState}>
                <Text style={styles.emptyPickerText}>No operators available at this site.</Text>
              </View>
            ) : (
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                {operators.map((operator) => (
                  <TouchableOpacity
                    key={operator.id}
                    style={[
                      styles.pickerOption,
                      selectedOperatorId === operator.id && styles.pickerOptionSelected,
                    ]}
                    onPress={() => setSelectedOperatorId(operator.id!)}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        selectedOperatorId === operator.id && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {operator.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedOperatorId || isAssigningOperator) && styles.submitButtonDisabled,
              ]}
              onPress={handleOperatorAssignment}
              disabled={!selectedOperatorId || isAssigningOperator}
              activeOpacity={0.7}
            >
              {isAssigningOperator ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Assign Operator</Text>
              )}
            </TouchableOpacity>

            {selectedAsset?.currentOperator && (
              <TouchableOpacity
                style={styles.removeOperatorButton}
                onPress={handleRemoveOperator}
                activeOpacity={0.7}
              >
                <Text style={styles.removeOperatorButtonText}>Remove Current Operator</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowOperatorModal(false);
                setSelectedOperatorId('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
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
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statsValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 12,
  },
  statsLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  assetCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  assetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  assetId: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  allocatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  allocatedText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#10b981',
  },
  breakdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  breakdownText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#ef4444',
  },
  assetType: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  subcontractorBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  subcontractorText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#0369a1',
  },
  allocationInfo: {
    fontSize: 13,
    color: '#16a34a',
    marginTop: 8,
    fontWeight: '500' as const,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#a0a0a0',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 8,
    marginTop: 12,
  },
  pickerScroll: {
    maxHeight: 150,
    marginBottom: 12,
  },
  pickerOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerOptionSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#475569',
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  submitButton: {
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  emptyPickerState: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffd54f',
    marginBottom: 12,
  },
  emptyPickerText: {
    fontSize: 13,
    color: '#f57c00',
    textAlign: 'center',
  },
  currentOperatorBadge: {
    backgroundColor: '#ede9fe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  currentOperatorLabel: {
    fontSize: 12,
    color: '#6b21a8',
    marginBottom: 4,
    fontWeight: '600' as const,
  },
  currentOperatorName: {
    fontSize: 15,
    color: '#6b21a8',
    fontWeight: '700' as const,
  },
  removeOperatorButton: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  removeOperatorButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#dc2626',
  },
});
