import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trash2, Package, FolderOpen, ChevronRight } from 'lucide-react-native';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';

interface PlantAssetGroup {
  id: string;
  name: string;
  masterAccountId: string;
  createdAt: any;
}

interface PlantAssetType {
  id: string;
  name: string;
  groupId: string;
  masterAccountId: string;
  createdAt: any;
}

export default function PlantAssetTypesScreen() {
  const { user } = useAuth();
  const [assetGroups, setAssetGroups] = useState<PlantAssetGroup[]>([]);
  const [assetTypes, setAssetTypes] = useState<PlantAssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [addingType, setAddingType] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    if (!user?.masterAccountId) return;

    try {
      setLoading(true);
      
      const groupsQuery = query(
        collection(db, 'plantAssetGroups'),
        where('masterAccountId', '==', user.masterAccountId)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      const groups = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlantAssetGroup[];
      setAssetGroups(groups.sort((a, b) => a.name.localeCompare(b.name)));

      const typesQuery = query(
        collection(db, 'plantAssetTypes'),
        where('masterAccountId', '==', user.masterAccountId)
      );
      const typesSnapshot = await getDocs(typesQuery);
      const types = typesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlantAssetType[];
      setAssetTypes(types.sort((a, b) => a.name.localeCompare(b.name)));

      if (groups.length > 0) {
        setExpandedGroups(new Set([groups[0].id]));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load plant asset types');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (!user?.masterAccountId) {
      Alert.alert('Error', 'Master account not found');
      return;
    }

    const existingGroup = assetGroups.find(
      group => group.name.toLowerCase() === newGroupName.trim().toLowerCase()
    );
    if (existingGroup) {
      Alert.alert('Error', 'This group already exists');
      return;
    }

    try {
      setAddingGroup(true);
      const newGroup = {
        name: newGroupName.trim(),
        masterAccountId: user.masterAccountId,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'plantAssetGroups'), newGroup);
      
      setAssetGroups(prev => [...prev, { id: docRef.id, ...newGroup }].sort((a, b) => 
        a.name.localeCompare(b.name)
      ));
      setNewGroupName('');
      Alert.alert('Success', 'Group added successfully');
    } catch (error) {
      console.error('Error adding group:', error);
      Alert.alert('Error', 'Failed to add group');
    } finally {
      setAddingGroup(false);
    }
  };

  const handleAddType = async () => {
    if (!newTypeName.trim()) {
      Alert.alert('Error', 'Please enter a type name');
      return;
    }

    if (!selectedGroupId) {
      Alert.alert('Error', 'Please select a group first');
      return;
    }

    if (!user?.masterAccountId) {
      Alert.alert('Error', 'Master account not found');
      return;
    }

    const existingType = assetTypes.find(
      type => type.name.toLowerCase() === newTypeName.trim().toLowerCase() && type.groupId === selectedGroupId
    );
    if (existingType) {
      Alert.alert('Error', 'This asset type already exists in this group');
      return;
    }

    try {
      setAddingType(true);
      const newType = {
        name: newTypeName.trim(),
        groupId: selectedGroupId,
        masterAccountId: user.masterAccountId,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'plantAssetTypes'), newType);
      
      setAssetTypes(prev => [...prev, { id: docRef.id, ...newType }].sort((a, b) => 
        a.name.localeCompare(b.name)
      ));
      setNewTypeName('');
      setExpandedGroups(prev => new Set([...prev, selectedGroupId]));
      Alert.alert('Success', 'Plant asset type added successfully');
    } catch (error) {
      console.error('Error adding asset type:', error);
      Alert.alert('Error', 'Failed to add plant asset type');
    } finally {
      setAddingType(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const typesInGroup = assetTypes.filter(t => t.groupId === groupId);
    if (typesInGroup.length > 0) {
      Alert.alert(
        'Cannot Delete',
        `This group contains ${typesInGroup.length} type(s). Please delete all types in this group first.`
      );
      return;
    }

    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${groupName}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'plantAssetGroups', groupId));
              setAssetGroups(prev => prev.filter(group => group.id !== groupId));
              Alert.alert('Success', 'Group deleted');
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group');
            }
          },
        },
      ]
    );
  };

  const handleDeleteType = async (typeId: string, typeName: string) => {
    Alert.alert(
      'Delete Asset Type',
      `Are you sure you want to delete "${typeName}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'plantAssetTypes', typeId));
              setAssetTypes(prev => prev.filter(type => type.id !== typeId));
              Alert.alert('Success', 'Plant asset type deleted');
            } catch (error) {
              console.error('Error deleting asset type:', error);
              Alert.alert('Error', 'Failed to delete plant asset type');
            }
          },
        },
      ]
    );
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Plant Asset Types',
          headerStyle: {
            backgroundColor: Colors.headerBg,
          },
          headerTintColor: Colors.text,
        }}
      />

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add New Group</Text>
          <View style={styles.addContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter group name (e.g., Compactors, Trucks)"
              placeholderTextColor={Colors.textSecondary}
              value={newGroupName}
              onChangeText={setNewGroupName}
              editable={!addingGroup}
            />
            <TouchableOpacity
              style={[styles.addButton, addingGroup && styles.addButtonDisabled]}
              onPress={handleAddGroup}
              disabled={addingGroup}
            >
              {addingGroup ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Plus size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add New Type</Text>
          {assetGroups.length === 0 ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>Please create a group first</Text>
            </View>
          ) : (
            <>
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Select Group:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupPills}>
                  {assetGroups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.groupPill,
                        selectedGroupId === group.id && styles.groupPillSelected
                      ]}
                      onPress={() => setSelectedGroupId(group.id)}
                    >
                      <Text style={[
                        styles.groupPillText,
                        selectedGroupId === group.id && styles.groupPillTextSelected
                      ]}>
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.addContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter asset type name (e.g., Excavator)"
                  placeholderTextColor={Colors.textSecondary}
                  value={newTypeName}
                  onChangeText={setNewTypeName}
                  editable={!addingType}
                />
                <TouchableOpacity
                  style={[styles.addButton, addingType && styles.addButtonDisabled]}
                  onPress={handleAddType}
                  disabled={addingType || !selectedGroupId}
                >
                  {addingType ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Plus size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Groups & Types ({assetGroups.length} groups, {assetTypes.length} types)
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : assetGroups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <FolderOpen size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No groups yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first group above
              </Text>
            </View>
          ) : (
            <View style={styles.groupsList}>
              {assetGroups.map((group) => {
                const groupTypes = assetTypes.filter(t => t.groupId === group.id);
                const isExpanded = expandedGroups.has(group.id);
                
                return (
                  <View key={group.id} style={styles.groupContainer}>
                    <TouchableOpacity
                      style={styles.groupHeader}
                      onPress={() => toggleGroup(group.id)}
                    >
                      <View style={styles.groupHeaderLeft}>
                        <View style={styles.groupIcon}>
                          <FolderOpen size={20} color="#3b82f6" />
                        </View>
                        <View style={styles.groupHeaderContent}>
                          <Text style={styles.groupName}>{group.name}</Text>
                          <Text style={styles.groupCount}>
                            {groupTypes.length} type{groupTypes.length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.groupHeaderRight}>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteGroup(group.id, group.name)}
                        >
                          <Trash2 size={18} color="#ef4444" />
                        </TouchableOpacity>
                        <ChevronRight
                          size={20}
                          color="#64748b"
                          style={[
                            styles.chevron,
                            isExpanded && styles.chevronExpanded
                          ]}
                        />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.typesInGroup}>
                        {groupTypes.length === 0 ? (
                          <View style={styles.emptyGroupTypes}>
                            <Package size={24} color={Colors.textSecondary} />
                            <Text style={styles.emptyGroupTypesText}>
                              No types in this group yet
                            </Text>
                          </View>
                        ) : (
                          groupTypes.map((type) => (
                            <View key={type.id} style={styles.typeCard}>
                              <View style={styles.typeIcon}>
                                <Package size={18} color="#10B981" />
                              </View>
                              <View style={styles.typeContent}>
                                <Text style={styles.typeName}>{type.name}</Text>
                              </View>
                              <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => handleDeleteType(type.id, type.name)}
                              >
                                <Trash2 size={18} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Plant Asset Groups & Types</Text>
          <Text style={styles.infoText}>
            Organize your plant assets into groups (categories) and types for better filtering and management.
          </Text>
          <Text style={styles.infoText}>
            Example: Group "Excavation" can contain types like "Excavator", "Backhoe", "Trencher"
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
  },
  addContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: 48,
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
  },
  groupsList: {
    gap: 12,
  },
  groupContainer: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
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
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupHeaderContent: {
    flex: 1,
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
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  typesInGroup: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  emptyGroupTypes: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyGroupTypesText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  dropdownContainer: {
    marginBottom: 12,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupPills: {
    flexDirection: 'row',
  },
  groupPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  groupPillSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  groupPillText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  groupPillTextSelected: {
    color: '#fff',
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  warningText: {
    fontSize: 14,
    color: '#854d0e',
    textAlign: 'center',
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  typeContent: {
    flex: 1,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
    marginBottom: 2,
  },
  typeDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    margin: 16,
    marginTop: 32,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
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
