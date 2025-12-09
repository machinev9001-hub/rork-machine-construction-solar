import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, MapPin, Lock, Unlock, ChevronRight } from 'lucide-react-native';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/colors';

interface PlantAssetGroup {
  id: string;
  name: string;
  masterAccountId: string;
}

interface PlantAssetType {
  id: string;
  name: string;
  groupId: string;
  masterAccountId: string;
}

interface PlantAsset {
  id: string;
  assetId: string;
  typeId: string;
  groupId: string;
  typeName?: string;
  groupName?: string;
  ownerProvince?: string;
  ownerAddress?: string;
  ownerId: string;
  ownerType: 'company' | 'subcontractor';
  allocationStatus?: 'UNALLOCATED' | 'ALLOCATED' | 'IN_TRANSIT';
  siteId?: string;
  createdAt: any;
}

interface GroupedAssets {
  [groupId: string]: {
    group: PlantAssetGroup;
    types: {
      [typeId: string]: {
        type: PlantAssetType;
        assets: PlantAsset[];
      };
    };
  };
}

export default function PlantAssetMarketplaceScreen() {
  const [loading, setLoading] = useState(true);
  const [vasAssets, setVasAssets] = useState<PlantAsset[]>([]);
  const [groupedAssets, setGroupedAssets] = useState<GroupedAssets>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [hasVasAccess] = useState(false);

  useEffect(() => {
    loadMarketplaceData();
  }, []);

  const loadMarketplaceData = async () => {
    try {
      setLoading(true);

      const groupsQuery = query(collection(db, 'plantAssetGroups'));
      const groupsSnapshot = await getDocs(groupsQuery);
      const allGroups = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlantAssetGroup[];
      console.log('Loaded groups:', allGroups.length);

      const typesQuery = query(collection(db, 'plantAssetTypes'));
      const typesSnapshot = await getDocs(typesQuery);
      const allTypes = typesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlantAssetType[];
      console.log('Loaded types:', allTypes.length);

      const assetsQuery = query(collection(db, 'plantAssets'));
      const assetsSnapshot = await getDocs(assetsQuery);
      const assets = assetsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlantAsset[];
      console.log('Loaded assets:', assets.length);
      console.log('First asset sample:', assets[0]);

      const assetsWithDetails = assets.map(asset => {
        const type = allTypes.find(t => t.id === asset.typeId);
        const group = allGroups.find(g => g.id === asset.groupId);
        console.log('Asset:', asset.assetId, 'has typeId:', asset.typeId, 'groupId:', asset.groupId);
        return {
          ...asset,
          typeName: type?.name,
          groupName: group?.name,
        };
      });

      console.log('Assets with details:', assetsWithDetails.length);
      setVasAssets(assetsWithDetails);

      const grouped: GroupedAssets = {};
      assetsWithDetails.forEach(asset => {
        if (!asset.groupId || !asset.typeId) {
          console.log('Skipping asset without groupId/typeId:', asset.assetId);
          return;
        }

        if (!grouped[asset.groupId]) {
          const group = allGroups.find(g => g.id === asset.groupId);
          if (!group) {
            console.log('Group not found for asset:', asset.assetId, 'groupId:', asset.groupId);
            return;
          }
          grouped[asset.groupId] = {
            group,
            types: {}
          };
        }

        if (!grouped[asset.groupId].types[asset.typeId]) {
          const type = allTypes.find(t => t.id === asset.typeId);
          if (!type) {
            console.log('Type not found for asset:', asset.assetId, 'typeId:', asset.typeId);
            return;
          }
          grouped[asset.groupId].types[asset.typeId] = {
            type,
            assets: []
          };
        }

        grouped[asset.groupId].types[asset.typeId].assets.push(asset);
      });

      console.log('Grouped assets:', Object.keys(grouped).length, 'groups');
      setGroupedAssets(grouped);

      if (Object.keys(grouped).length > 0) {
        const firstGroupId = Object.keys(grouped)[0];
        setExpandedGroups(new Set([firstGroupId]));
        const firstTypeId = Object.keys(grouped[firstGroupId].types)[0];
        if (firstTypeId) {
          setExpandedTypes(new Set([firstTypeId]));
        }
      }

    } catch (error) {
      console.error('Error loading marketplace data:', error);
      Alert.alert('Error', 'Failed to load marketplace data');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const toggleType = (typeId: string) => {
    setExpandedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(typeId)) {
        newSet.delete(typeId);
      } else {
        newSet.add(typeId);
      }
      return newSet;
    });
  };

  const handleAssetPress = (asset: PlantAsset) => {
    if (hasVasAccess) {
      Alert.alert('Asset Details', 'Full asset details would be shown here with subcontractor information.');
    } else {
      Alert.alert(
        'VAS Activation Required',
        'To view full asset details including subcontractor information, please activate the VAS (Value Added Service) feature.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Activate VAS',
            onPress: () => {
              Alert.alert('Activation', 'VAS activation flow would be implemented here.');
            },
          },
        ]
      );
    }
  };

  const getLocationDisplay = (asset: PlantAsset): string => {
    if (asset.ownerProvince) {
      return asset.ownerProvince;
    }
    if (asset.ownerAddress) {
      const parts = asset.ownerAddress.split(',');
      return parts[parts.length - 1]?.trim() || 'Unknown';
    }
    return 'Unknown Location';
  };

  const getAvailabilityColor = (allocationStatus?: string): string => {
    if (allocationStatus === 'ALLOCATED') {
      return '#EF4444';
    }
    return '#10B981';
  };

  const getAvailabilityText = (allocationStatus?: string): string => {
    if (allocationStatus === 'ALLOCATED') {
      return '🔴 Currently Allocated';
    }
    return '🟢 Available';
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Plant Asset Marketplace',
          headerStyle: {
            backgroundColor: Colors.headerBg,
          },
          headerTintColor: Colors.text,
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading marketplace...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              {hasVasAccess ? (
                <Unlock size={32} color="#10B981" />
              ) : (
                <Lock size={32} color="#F59E0B" />
              )}
            </View>
            <Text style={styles.headerTitle}>
              {hasVasAccess ? 'VAS Activated' : 'VAS Not Activated'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {hasVasAccess
                ? 'You have full access to all asset details'
                : 'Activate VAS to view subcontractor details'}
            </Text>
            {!hasVasAccess && (
              <TouchableOpacity
                style={styles.activateButton}
                onPress={() => Alert.alert('VAS Activation', 'VAS activation flow would be implemented here.')}
              >
                <Text style={styles.activateButtonText}>Activate VAS</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{vasAssets.length}</Text>
              <Text style={styles.statLabel}>Total Assets</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#10B981' }]}>
                {vasAssets.filter(a => a.allocationStatus !== 'ALLOCATED').length}
              </Text>
              <Text style={styles.statLabel}>🟢 Available</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>
                {vasAssets.filter(a => a.allocationStatus === 'ALLOCATED').length}
              </Text>
              <Text style={styles.statLabel}>🔴 Allocated</Text>
            </View>
          </View>

          {Object.keys(groupedAssets).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Package size={64} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No assets available</Text>
              <Text style={styles.emptySubtext}>
                Plant assets from all subcontractors will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Assets by Group & Type</Text>
              {Object.entries(groupedAssets).map(([groupId, groupData]) => {
                const isGroupExpanded = expandedGroups.has(groupId);
                const assetCount = Object.values(groupData.types).reduce(
                  (acc, typeData) => acc + typeData.assets.length,
                  0
                );

                return (
                  <View key={groupId} style={styles.groupContainer}>
                    <TouchableOpacity
                      style={styles.groupHeader}
                      onPress={() => toggleGroup(groupId)}
                    >
                      <View style={styles.groupHeaderLeft}>
                        <View style={styles.groupIconContainer}>
                          <Package size={20} color="#3b82f6" />
                        </View>
                        <View>
                          <Text style={styles.groupName}>{groupData.group.name}</Text>
                          <Text style={styles.groupCount}>
                            {assetCount} asset{assetCount !== 1 ? 's' : ''} in {Object.keys(groupData.types).length} type{Object.keys(groupData.types).length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight
                        size={20}
                        color="#64748b"
                        style={[
                          styles.chevron,
                          isGroupExpanded && styles.chevronExpanded
                        ]}
                      />
                    </TouchableOpacity>

                    {isGroupExpanded && (
                      <View style={styles.typesContainer}>
                        {Object.entries(groupData.types).map(([typeId, typeData]) => {
                          const isTypeExpanded = expandedTypes.has(typeId);

                          return (
                            <View key={typeId} style={styles.typeContainer}>
                              <TouchableOpacity
                                style={styles.typeHeader}
                                onPress={() => toggleType(typeId)}
                              >
                                <View style={styles.typeHeaderLeft}>
                                  <View style={styles.typeIconContainer}>
                                    <Package size={16} color="#10B981" />
                                  </View>
                                  <Text style={styles.typeName}>{typeData.type.name}</Text>
                                </View>
                                <View style={styles.typeHeaderRight}>
                                  <View style={styles.countBadge}>
                                    <Text style={styles.countBadgeText}>
                                      {typeData.assets.length}
                                    </Text>
                                  </View>
                                  <ChevronRight
                                    size={16}
                                    color="#64748b"
                                    style={[
                                      styles.chevronSmall,
                                      isTypeExpanded && styles.chevronExpanded
                                    ]}
                                  />
                                </View>
                              </TouchableOpacity>

                              {isTypeExpanded && (
                                <View style={styles.assetsContainer}>
                                  {typeData.assets.map((asset) => (
                                    <TouchableOpacity
                                      key={asset.id}
                                      style={styles.assetCard}
                                      onPress={() => handleAssetPress(asset)}
                                    >
                                      <View style={styles.assetCardHeader}>
                                        <View style={styles.assetIdContainer}>
                                          <Text style={styles.assetId}>
                                            {hasVasAccess ? asset.assetId : `***${asset.assetId.slice(-4)}`}
                                          </Text>
                                        </View>
                                        <View
                                          style={[
                                            styles.availabilityBadge,
                                            {
                                              backgroundColor: getAvailabilityColor(asset.allocationStatus) + '20',
                                            }
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.availabilityText,
                                              {
                                                color: getAvailabilityColor(asset.allocationStatus),
                                              }
                                            ]}
                                          >
                                            {getAvailabilityText(asset.allocationStatus)}
                                          </Text>
                                        </View>
                                      </View>

                                      <View style={styles.assetLocation}>
                                        <MapPin size={14} color={Colors.textSecondary} />
                                        <Text style={styles.assetLocationText}>
                                          {hasVasAccess
                                            ? (asset.ownerAddress || asset.ownerProvince || 'No location specified')
                                            : getLocationDisplay(asset)}
                                        </Text>
                                      </View>

                                      {!hasVasAccess && (
                                        <View style={styles.lockedBadge}>
                                          <Lock size={12} color="#F59E0B" />
                                          <Text style={styles.lockedText}>
                                            Tap to unlock details
                                          </Text>
                                        </View>
                                      )}
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>About VAS Marketplace</Text>
            <Text style={styles.infoText}>
              Browse all plant assets from subcontractors in our database.
            </Text>
            <Text style={styles.infoText}>
              🟢 Green: Available for hire
            </Text>
            <Text style={styles.infoText}>
              🔴 Red: Currently allocated/unavailable
            </Text>
            <Text style={styles.infoText}>
              Activate VAS to view full subcontractor details and contact information.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.background,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  activateButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  activateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
  },
  groupContainer: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
    marginBottom: 2,
  },
  groupCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  chevronSmall: {
    transform: [{ rotate: '0deg' }],
    marginLeft: 8,
  },
  typesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  typeContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  typeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  typeName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  countBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  assetsContainer: {
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  assetCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  assetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assetIdContainer: {
    flex: 1,
  },
  assetId: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  availabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  availabilityText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  assetLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  assetLocationText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  lockedText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500' as const,
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  infoSection: {
    margin: 16,
    marginTop: 32,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.background,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
});
