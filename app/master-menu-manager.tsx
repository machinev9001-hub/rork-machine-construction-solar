import { Stack, router } from 'expo-router';
import { useState, useMemo, useRef } from 'react';
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
  Platform,
  PanResponder,
  Animated,
} from 'react-native';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Menu, List, Activity, Database, X, Settings, GripVertical } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, setDoc, Timestamp, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ActivityModuleConfig } from '@/types';
import ActivityModuleConfigForm from '@/components/ActivityModuleConfigForm';

type MenuLevel = 'main' | 'sub' | 'activity';

type MenuItem = {
  id: string;
  siteId: string;
  masterAccountId: string;
  level: MenuLevel;
  name: string;
  parentMainMenuId?: string;
  parentSubMenuId?: string;
  sortOrder: number;
  createdAt: any;
  moduleConfig?: ActivityModuleConfig;
};

type ExpandedState = {
  [mainMenuId: string]: {
    expanded: boolean;
    subMenus: {
      [subMenuId: string]: boolean;
    };
  };
};

type CleanupParams = {
  siteId: string;
  deletedMainMenuIds: string[];
  deletedSubMenuIds: string[];
  deletedActivityIds: string[];
};

async function cleanupOrphanedData(params: CleanupParams) {
  const { siteId, deletedActivityIds } = params;
  
  console.log('🧹 Starting orphaned data cleanup...');
  
  if (deletedActivityIds.length === 0) {
    console.log('✅ No activities deleted, cleanup complete');
    return;
  }
  
  try {
    const activitiesRef = collection(db, 'activities');
    const activitiesQuery = query(
      activitiesRef,
      where('siteId', '==', siteId),
      where('activityId', 'in', deletedActivityIds.slice(0, 10))
    );
    const activitiesSnapshot = await getDocs(activitiesQuery);
    
    const deletePromises: Promise<void>[] = [];
    
    activitiesSnapshot.forEach((activityDoc) => {
      console.log('🗑️ Deleting orphaned activity:', activityDoc.id);
      deletePromises.push(deleteDoc(doc(db, 'activities', activityDoc.id)));
    });
    
    const requestsRef = collection(db, 'requests');
    const requestsQuery = query(
      requestsRef,
      where('siteId', '==', siteId),
      where('activityId', 'in', deletedActivityIds.slice(0, 10))
    );
    const requestsSnapshot = await getDocs(requestsQuery);
    
    requestsSnapshot.forEach((requestDoc) => {
      console.log('🗑️ Deleting orphaned request:', requestDoc.id);
      deletePromises.push(deleteDoc(doc(db, 'requests', requestDoc.id)));
    });
    
    await Promise.all(deletePromises);
    
    console.log('✅ Orphaned data cleanup complete:', {
      deletedActivities: activitiesSnapshot.size,
      deletedRequests: requestsSnapshot.size,
    });
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    Alert.alert(
      'Warning',
      'Menu items deleted but some related data may remain. Please contact support if you see orphaned data.'
    );
  }
}

export default function MasterMenuManagerScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const menuItemsQueryKey = useMemo(() => ['menu-items', user?.siteId] as const, [user?.siteId]);

  
  const [showAddMainMenuModal, setShowAddMainMenuModal] = useState(false);
  const [showAddSubMenuModal, setShowAddSubMenuModal] = useState(false);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedMainMenuId, setSelectedMainMenuId] = useState('');
  const [selectedSubMenuId, setSelectedSubMenuId] = useState('');
  
  const [mainMenuName, setMainMenuName] = useState('');
  const [subMenuName, setSubMenuName] = useState('');
  const [activityName, setActivityName] = useState('');
  const [editName, setEditName] = useState('');
  const [activityModuleConfig, setActivityModuleConfig] = useState<ActivityModuleConfig | undefined>();
  const [editModuleConfig, setEditModuleConfig] = useState<ActivityModuleConfig | undefined>();
  
  const [expandedState, setExpandedState] = useState<ExpandedState>({});
  const [draggedItem, setDraggedItem] = useState<MenuItem | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below'>('below');
  const dragY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const itemLayouts = useRef<Map<string, { y: number; height: number }>>(new Map());
  const dragStartY = useRef<number>(0);
  const scrollOffset = useRef<number>(0);

  const menusQuery = useQuery({
    queryKey: menuItemsQueryKey,
    queryFn: async () => {
      if (!user?.siteId) return [];
      
      const menusRef = collection(db, 'menuItems');
      const menusQueryRef = query(menusRef, where('siteId', '==', user.siteId));
      const menusSnapshot = await getDocs(menusQueryRef);
      
      const items: MenuItem[] = [];
      menusSnapshot.forEach((doc) => {
        items.push({
          id: doc.id,
          ...doc.data(),
        } as MenuItem);
      });
      
      return items.sort((a, b) => a.sortOrder - b.sortOrder);
    },
    enabled: !!user?.siteId,
  });

  const mainMenus = useMemo(() => {
    return (menusQuery.data || []).filter(m => m.level === 'main');
  }, [menusQuery.data]);

  const getSubMenus = (mainMenuId: string) => {
    return (menusQuery.data || []).filter(m => m.level === 'sub' && m.parentMainMenuId === mainMenuId);
  };

  const getActivities = (subMenuId: string) => {
    return (menusQuery.data || []).filter(m => m.level === 'activity' && m.parentSubMenuId === subMenuId);
  };

  const addMainMenuMutation = useMutation({
    mutationFn: async () => {
      const isMaster = user?.role === 'master';
      const effectiveMasterAccountId = isMaster ? (user?.masterAccountId || user?.id) : user?.masterAccountId;
      const effectiveSiteId = user?.siteId;
      
      if (!effectiveSiteId) throw new Error('No site selected');
      if (!effectiveMasterAccountId) throw new Error('Master account information missing');
      if (!mainMenuName.trim()) throw new Error('Main menu name is required');
      
      const menusRef = doc(collection(db, 'menuItems'));
      const sortOrder = ((menusQuery.data || []).filter(m => m.level === 'main').length || 0) + 1;
      
      const newItem: MenuItem = {
        id: menusRef.id,
        siteId: effectiveSiteId,
        masterAccountId: effectiveMasterAccountId,
        level: 'main',
        name: mainMenuName.trim().toUpperCase(),
        sortOrder,
        createdAt: Timestamp.now(),
      };
      
      await setDoc(menusRef, newItem);
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuItemsQueryKey });
      setShowAddMainMenuModal(false);
      setMainMenuName('');
      Alert.alert('Success', 'Main menu added successfully');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const addSubMenuMutation = useMutation({
    mutationFn: async () => {
      const isMaster = user?.role === 'master';
      const effectiveMasterAccountId = isMaster ? (user?.masterAccountId || user?.id) : user?.masterAccountId;
      const effectiveSiteId = user?.siteId;
      
      if (!effectiveSiteId) throw new Error('No site selected');
      if (!effectiveMasterAccountId) throw new Error('Master account information missing');
      if (!subMenuName.trim()) throw new Error('Sub menu name is required');
      if (!selectedMainMenuId) throw new Error('Please select a main menu first');
      
      const menusRef = doc(collection(db, 'menuItems'));
      const sortOrder = ((menusQuery.data || []).filter(m => 
        m.level === 'sub' && m.parentMainMenuId === selectedMainMenuId
      ).length || 0) + 1;
      
      const newItem: MenuItem = {
        id: menusRef.id,
        siteId: effectiveSiteId,
        masterAccountId: effectiveMasterAccountId,
        level: 'sub',
        name: subMenuName.trim().toUpperCase(),
        parentMainMenuId: selectedMainMenuId,
        sortOrder,
        createdAt: Timestamp.now(),
      };
      
      await setDoc(menusRef, newItem);
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuItemsQueryKey });
      setShowAddSubMenuModal(false);
      setSubMenuName('');
      Alert.alert('Success', 'Sub menu added successfully');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: async () => {
      console.log('🚀 Starting addActivityMutation...');
      const isMaster = user?.role === 'master';
      const effectiveMasterAccountId = isMaster ? (user?.masterAccountId || user?.id) : user?.masterAccountId;
      const effectiveSiteId = user?.siteId;
      
      console.log('📊 Activity mutation data:', {
        effectiveMasterAccountId,
        effectiveSiteId,
        activityName,
        selectedMainMenuId,
        selectedSubMenuId,
        moduleConfig: activityModuleConfig,
      });
      
      if (!effectiveSiteId) {
        console.error('❌ Missing siteId');
        throw new Error('No site selected');
      }
      if (!effectiveMasterAccountId) {
        console.error('❌ Missing masterAccountId');
        throw new Error('Master account information missing');
      }
      if (!activityName.trim()) {
        console.error('❌ Missing activity name');
        throw new Error('Activity name is required');
      }
      if (!selectedMainMenuId) {
        console.error('❌ Missing selectedMainMenuId');
        throw new Error('Please select a main menu first');
      }
      if (!selectedSubMenuId) {
        console.error('❌ Missing selectedSubMenuId');
        throw new Error('Please select a sub menu first');
      }
      
      const menusRef = doc(collection(db, 'menuItems'));
      const sortOrder = ((menusQuery.data || []).filter(m => 
        m.level === 'activity' && m.parentSubMenuId === selectedSubMenuId
      ).length || 0) + 1;
      
      const newItem: MenuItem = {
        id: menusRef.id,
        siteId: effectiveSiteId,
        masterAccountId: effectiveMasterAccountId,
        level: 'activity',
        name: activityName.trim().toUpperCase(),
        parentMainMenuId: selectedMainMenuId,
        parentSubMenuId: selectedSubMenuId,
        sortOrder,
        createdAt: Timestamp.now(),
        moduleConfig: activityModuleConfig,
      };
      
      console.log('📝 Creating activity in Firestore:', JSON.stringify(newItem, null, 2));
      
      try {
        await setDoc(menusRef, newItem);
        console.log('✅ Activity created successfully in Firestore with ID:', menusRef.id);
        return newItem;
      } catch (firestoreError: any) {
        console.error('❌ Firestore setDoc failed:', firestoreError);
        throw new Error(`Failed to save to database: ${firestoreError.message}`);
      }
    },
    onSuccess: (data) => {
      console.log('🎉 addActivityMutation onSuccess callback started');
      console.log('🎉 Created data:', data);
      
      try {
        queryClient.invalidateQueries({ queryKey: menuItemsQueryKey });
        queryClient.invalidateQueries({ queryKey: ['supervisor-main-menus-with-progress'] });
        console.log('✅ Queries invalidated');
        
        setShowAddActivityModal(false);
        console.log('✅ Modal closed');
        
        setActivityName('');
        setActivityModuleConfig(undefined);
        console.log('✅ Form reset');
        
        Alert.alert('Success', 'Activity added successfully');
        console.log('✅ Success alert shown');
      } catch (successError: any) {
        console.error('❌ Error in onSuccess callback:', successError);
      }
    },
    onError: (error: Error) => {
      console.error('❌ addActivityMutation error callback triggered');
      console.error('❌ Error object:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      Alert.alert('Error', error.message || 'Failed to add activity');
    },
  });

  const updateMenuMutation = useMutation({
    mutationFn: async () => {
      const isMaster = user?.role === 'master';
      const effectiveMasterAccountId = isMaster ? (user?.masterAccountId || user?.id) : user?.masterAccountId;
      const effectiveSiteId = user?.siteId;
      
      if (!editingItem) throw new Error('No item selected for editing');
      if (!effectiveSiteId) throw new Error('No site selected');
      if (!effectiveMasterAccountId) throw new Error('Master account information missing');
      if (!editName.trim()) throw new Error('Name is required');
      
      console.log('🔄 UPDATE MENU MUTATION STARTED');
      console.log('📝 editingItem:', JSON.stringify(editingItem, null, 2));
      console.log('📝 editModuleConfig:', JSON.stringify(editModuleConfig, null, 2));
      
      const menusRef = doc(db, 'menuItems', editingItem.id);
      
      const updatedItem: MenuItem = {
        ...editingItem,
        name: editName.trim().toUpperCase(),
        siteId: effectiveSiteId,
        masterAccountId: effectiveMasterAccountId,
        moduleConfig: editingItem.level === 'activity' ? editModuleConfig : editingItem.moduleConfig,
      };
      
      console.log('📝 About to save updatedItem:', JSON.stringify(updatedItem, null, 2));
      await setDoc(menusRef, updatedItem);
      console.log('✅ MenuItem saved to Firestore');
      
      console.log('📝 Updated menuItem:', editingItem.id);
      console.log('📝 New moduleConfig saved:', JSON.stringify(editModuleConfig, null, 2));
      
      if (editingItem.level === 'activity' && editModuleConfig) {
        console.log('✅ Menu item moduleConfig updated successfully');
        console.log('📋 moduleConfig saved to menuItem document:', editingItem.id);
        console.log('ℹ️ Changes will apply to:');
        console.log('  1. All NEW activity instances created from this menu item');
        console.log('  2. Existing activity instances will be synced now...');
        console.log('🔍 Querying activities with activityId:', editingItem.id, 'in site:', effectiveSiteId);
        
        const activitiesRef = collection(db, 'activities');
        const activitiesQuery = query(
          activitiesRef,
          where('activityId', '==', editingItem.id)
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);
        
        console.log(`📊 Found ${activitiesSnapshot.size} existing activity instances to sync`);
        
        if (activitiesSnapshot.size === 0) {
          console.log('ℹ️ No existing activity instances found for this menu item yet.');
          console.log('ℹ️ This is normal if no supervisor has started using this activity.');
          console.log('ℹ️ Changes will apply immediately when:');
          console.log('   - Supervisors open existing tasks (real-time listener will fetch updated config)');
          console.log('   - Supervisors create new tasks (will use updated config on creation)');
        } else {
          console.log('📊 Activity instances found:');
          activitiesSnapshot.docs.forEach((doc, idx) => {
            const data = doc.data();
            console.log(`   ${idx + 1}. Activity doc ID: ${doc.id}`);
            console.log(`      - Task ID: ${data.taskId}`);
            console.log(`      - Site ID: ${data.siteId || 'NOT SET'}`);
            console.log(`      - Activity ID: ${data.activityId}`);
            console.log(`      - Name: ${data.name}`);
          });
        }
        
        const updatePromises: Promise<void>[] = [];
        const isGridType = editModuleConfig.baseBlockType === 'GRID_TYPE_ROW_PROGRESS';
        const gridConfig = editModuleConfig.gridConfig;
        
        activitiesSnapshot.forEach((activityDoc) => {
          console.log('🔄 Updating activity instance:', activityDoc.id);
          
          const updatePayload: any = {
            moduleConfig: editModuleConfig,
            updatedAt: Timestamp.now(),
          };
          
          if (isGridType && gridConfig) {
            const totalCells = gridConfig.flexibleColumns && gridConfig.flexibleColumns.length > 0
              ? gridConfig.flexibleColumns.reduce((sum, col) => sum + col.rows, 0)
              : gridConfig.totalRows * gridConfig.totalColumns;
            const scopeValuePerCell = gridConfig.scopeValue || 1;
            const totalScopeValue = totalCells * scopeValuePerCell;
            const unit = gridConfig.scopeUnit || 'm';
            
            updatePayload.scopeValue = totalScopeValue;
            updatePayload.scope = {
              value: totalScopeValue,
              unit,
              setBy: user?.id || 'system',
              setAt: Timestamp.now(),
              autoApproved: true,
              source: 'GRID_CONFIG_UPDATE'
            };
            updatePayload.unit = {
              canonical: unit,
              setBy: user?.id || 'system',
              setAt: Timestamp.now(),
            };
            
            console.log(`  📊 Recalculated scope: ${totalScopeValue} ${unit} (${totalCells} cells × ${scopeValuePerCell})`);
          }
          
          updatePromises.push(
            updateDoc(doc(db, 'activities', activityDoc.id), updatePayload)
          );
        });
        
        await Promise.all(updatePromises);
        console.log(`✅ Synced ${activitiesSnapshot.size} existing activity instances${isGridType ? ' (with recalculated scope)' : ''}`);
        console.log('✅ Menu item changes saved and will be used for all future activity creations');
        
        console.log('🔄 [CRITICAL] Activity documents updated in Firestore');
        console.log('🔄 [CRITICAL] Real-time listeners should now pick up these changes');
        console.log('🔄 [CRITICAL] If supervisors have the screen open, changes should appear immediately');
        console.log('🔄 [CRITICAL] If they refresh or reopen, they will definitely see the changes');
      }
      
      return updatedItem;
    },
    onSuccess: () => {
      console.log('🎯 Update success - invalidating all relevant caches');
      queryClient.invalidateQueries({ queryKey: menuItemsQueryKey });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-main-menus-with-progress'] });
      
      console.log('✅ All queries invalidated');
      setShowEditModal(false);
      setEditingItem(null);
      setEditName('');
      setEditModuleConfig(undefined);
      Alert.alert(
        'Success',
        'Menu item updated successfully! Changes will be visible immediately when supervisors open or refresh their tasks.'
      );
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const reorderMenuMutation = useMutation({
    mutationFn: async ({ items, parentId }: { items: MenuItem[], parentId?: string }) => {
      console.log('🔄 Reordering items:', items.map(i => i.name));
      
      const batch = writeBatch(db);
      
      items.forEach((item, index) => {
        const itemRef = doc(db, 'menuItems', item.id);
        batch.update(itemRef, { sortOrder: index + 1 });
      });
      
      await batch.commit();
      console.log('✅ Reorder complete');
    },
    onMutate: async ({ items }) => {
      await queryClient.cancelQueries({ queryKey: menuItemsQueryKey });
      
      const previousMenus = queryClient.getQueryData<MenuItem[]>(menuItemsQueryKey);
      
      queryClient.setQueryData<MenuItem[]>(menuItemsQueryKey, (old: MenuItem[] | undefined) => {
        if (!old) return items;
        
        const itemIds = new Set(items.map(i => i.id));
        const otherItems = old.filter(i => !itemIds.has(i.id));
        
        const updatedItems = items.map((item, index) => ({
          ...item,
          sortOrder: index + 1,
        }));
        
        return [...otherItems, ...updatedItems].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      
      return { previousMenus };
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousMenus) {
        queryClient.setQueryData<MenuItem[] | undefined>(menuItemsQueryKey, context.previousMenus);
      }
      Alert.alert('Error', 'Failed to reorder items: ' + error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: menuItemsQueryKey });
    },
  });

  const deleteMenuMutation = useMutation({
    mutationFn: async (item: MenuItem) => {
      if (!user?.siteId) throw new Error('Missing site');
      
      const batch = writeBatch(db);
      const deletedActivityIds: string[] = [];
      const deletedSubMenuIds: string[] = [];
      const deletedMainMenuIds: string[] = [];
      
      if (item.level === 'main') {
        deletedMainMenuIds.push(item.id);
        const subMenus = getSubMenus(item.id);
        subMenus.forEach(subMenu => {
          deletedSubMenuIds.push(subMenu.id);
          const activities = getActivities(subMenu.id);
          activities.forEach(activity => {
            deletedActivityIds.push(activity.id);
            batch.delete(doc(db, 'menuItems', activity.id));
          });
          batch.delete(doc(db, 'menuItems', subMenu.id));
        });
      }
      
      if (item.level === 'sub') {
        deletedSubMenuIds.push(item.id);
        const activities = getActivities(item.id);
        activities.forEach(activity => {
          deletedActivityIds.push(activity.id);
          batch.delete(doc(db, 'menuItems', activity.id));
        });
      }
      
      if (item.level === 'activity') {
        deletedActivityIds.push(item.id);
      }
      
      batch.delete(doc(db, 'menuItems', item.id));
      
      await batch.commit();
      
      console.log('🗑️ Menu deletion completed:', {
        deletedMainMenuIds,
        deletedSubMenuIds,
        deletedActivityIds,
      });
      
      await cleanupOrphanedData({
        siteId: user.siteId,
        deletedMainMenuIds,
        deletedSubMenuIds,
        deletedActivityIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuItemsQueryKey });
      Alert.alert('Success', 'Menu item and its children deleted successfully');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleAddMainMenu = () => {
    setMainMenuName('');
    setShowAddMainMenuModal(true);
  };

  const handleAddSubMenu = (mainMenuId: string) => {
    setSelectedMainMenuId(mainMenuId);
    setSubMenuName('');
    setShowAddSubMenuModal(true);
  };

  const handleAddActivity = (mainMenuId: string, subMenuId: string) => {
    setSelectedMainMenuId(mainMenuId);
    setSelectedSubMenuId(subMenuId);
    setActivityName('');
    setActivityModuleConfig(undefined);
    setShowAddActivityModal(true);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditModuleConfig(item.level === 'activity' ? item.moduleConfig : undefined);
    setShowEditModal(true);
  };

  const handleDelete = (item: MenuItem) => {
    const childCount = item.level === 'main' 
      ? getSubMenus(item.id).length 
      : item.level === 'sub' 
      ? getActivities(item.id).length 
      : 0;
    
    const message = childCount > 0 
      ? `This will delete "${item.name}" and its ${childCount} child item(s). Continue?`
      : `Delete "${item.name}"?`;
    
    Alert.alert('Confirm Delete', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMenuMutation.mutate(item) },
    ]);
  };

  const toggleMainMenu = (mainMenuId: string) => {
    setExpandedState(prev => ({
      ...prev,
      [mainMenuId]: {
        expanded: !prev[mainMenuId]?.expanded,
        subMenus: prev[mainMenuId]?.subMenus || {},
      },
    }));
  };

  const toggleSubMenu = (mainMenuId: string, subMenuId: string) => {
    setExpandedState(prev => ({
      ...prev,
      [mainMenuId]: {
        ...prev[mainMenuId],
        subMenus: {
          ...(prev[mainMenuId]?.subMenus || {}),
          [subMenuId]: !(prev[mainMenuId]?.subMenus?.[subMenuId] || false),
        },
      },
    }));
  };

  const getLevelIcon = (level: MenuLevel) => {
    switch (level) {
      case 'main': return Menu;
      case 'sub': return List;
      case 'activity': return Activity;
    }
  };

  const getLevelLabel = (level: MenuLevel) => {
    switch (level) {
      case 'main': return 'Main Menu';
      case 'sub': return 'Sub Menu';
      case 'activity': return 'Activity';
    }
  };



  const handleDragStart = (item: MenuItem, pageY: number) => {
    console.log('🎯 Drag started:', item.name);
    setDraggedItem(item);
    dragStartY.current = pageY;
  };

  const handleDragEnd = () => {
    console.log('🎯 Drag ended');
    if (draggedItem && dropTargetId && dropTargetId !== draggedItem.id) {
      const draggedList = getDraggedItemList(draggedItem);
      const targetIndex = draggedList.findIndex(i => i.id === dropTargetId);
      const currentIndex = draggedList.findIndex(i => i.id === draggedItem.id);
      
      if (targetIndex !== -1) {
        let newIndex = targetIndex;
        
        if (dropPosition === 'below') {
          newIndex = targetIndex;
          if (currentIndex < targetIndex) {
            newIndex = targetIndex;
          } else {
            newIndex = targetIndex + 1;
          }
        } else {
          newIndex = targetIndex;
          if (currentIndex < targetIndex) {
            newIndex = targetIndex - 1;
          }
        }
        
        newIndex = Math.max(0, Math.min(newIndex, draggedList.length - 1));
        
        const targetItem = draggedList[targetIndex];
        console.log(`🔄 Reordering from ${currentIndex} to ${newIndex} (${dropPosition} ${targetItem?.name || 'unknown'})`);
        handleReorder(draggedItem, newIndex);
      }
    }
    setDraggedItem(null);
    setDropTargetId(null);
    setDropPosition('below');
    dragY.setValue(0);
  };

  const getDraggedItemList = (item: MenuItem): MenuItem[] => {
    if (item.level === 'main') {
      return mainMenus;
    } else if (item.level === 'sub' && item.parentMainMenuId) {
      return getSubMenus(item.parentMainMenuId);
    } else if (item.level === 'activity' && item.parentSubMenuId) {
      return getActivities(item.parentSubMenuId);
    }
    return [];
  };

  const handleReorder = (item: MenuItem, newIndex: number) => {
    console.log(`🔄 Reordering ${item.name} to index ${newIndex}`);
    
    let items: MenuItem[] = [];
    
    if (item.level === 'main') {
      items = [...mainMenus];
    } else if (item.level === 'sub' && item.parentMainMenuId) {
      items = [...getSubMenus(item.parentMainMenuId)];
    } else if (item.level === 'activity' && item.parentSubMenuId) {
      items = [...getActivities(item.parentSubMenuId)];
    }
    
    const oldIndex = items.findIndex(i => i.id === item.id);
    console.log(`  Current position: ${oldIndex}, Target position: ${newIndex}`);
    
    if (oldIndex === -1) {
      console.log('  ❌ Item not found in list');
      return;
    }
    
    if (oldIndex === newIndex) {
      console.log('  ⏭️ Already at target position');
      return;
    }
    
    const reordered = [...items];
    const [removed] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, removed);
    
    console.log('  📋 New order:', reordered.map(i => i.name));
    reorderMenuMutation.mutate({ items: reordered });
  };

  const renderMenuItem = (item: MenuItem, indent: number = 0, indexInLevel: number = 0) => {
    const Icon = getLevelIcon(item.level);
    const isMainMenu = item.level === 'main';
    const isSubMenu = item.level === 'sub';
    const isExpanded = isMainMenu && expandedState[item.id]?.expanded;
    const subMenus = isMainMenu ? getSubMenus(item.id) : [];
    const activities = isSubMenu ? getActivities(item.id) : [];
    const hasChildren = subMenus.length > 0 || activities.length > 0;
    const isDragging = draggedItem?.id === item.id;
    const isDropTargetAbove = dropTargetId === item.id && dropPosition === 'above' && draggedItem?.level === item.level && !isDragging;
    const isDropTargetBelow = dropTargetId === item.id && dropPosition === 'below' && draggedItem?.level === item.level && !isDragging;
    const enabledMicroModules = Object.values(item.moduleConfig?.microModules ?? {}).some((module) => module?.enabled);
    const hasGridBaseBlock = item.moduleConfig?.baseBlockType === 'GRID_TYPE_ROW_PROGRESS';
    const hasBoqConfigured = typeof item.moduleConfig?.boqQuantity === 'number' && item.moduleConfig.boqQuantity > 0;
    const showConfigIndicator = enabledMicroModules || hasGridBaseBlock || hasBoqConfigured;

    const pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        handleDragStart(item, evt.nativeEvent.pageY);
      },
      onPanResponderMove: (evt, gestureState) => {
        dragY.setValue(gestureState.dy);
        
        const currentY = evt.nativeEvent.pageY - scrollOffset.current;
        const draggedList: MenuItem[] = getDraggedItemList(item);
        
        let closestItemId: string | null = null;
        let minDistance = Infinity;
        let bestPosition: 'above' | 'below' = 'below';
        
        for (const listItem of draggedList) {
          if (listItem.id === item.id) continue;
          
          const layout = itemLayouts.current.get(listItem.id);
          if (!layout) continue;
          
          const itemCenterY = layout.y + layout.height / 2;
          const distance = Math.abs(currentY - itemCenterY);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestItemId = listItem.id;
            bestPosition = currentY < itemCenterY ? 'above' : 'below';
          }
        }
        
        if (closestItemId) {
          if (dropTargetId !== closestItemId || dropPosition !== bestPosition) {
            setDropTargetId(closestItemId);
            setDropPosition(bestPosition);
          }
        } else if (dropTargetId !== null) {
          setDropTargetId(null);
        }
      },
      onPanResponderRelease: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: false,
        }).start(() => {
          handleDragEnd();
        });
      },
    });

    return (
      <View key={item.id}>
        {isDropTargetAbove && (
          <View style={[styles.dropIndicator, { marginLeft: indent * 20 }]}>
            <View style={styles.dropIndicatorLine} />
            <Text style={styles.dropIndicatorText}>Drop here</Text>
          </View>
        )}
        <Animated.View
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            itemLayouts.current.set(item.id, { y, height });
          }}
          style={[
            styles.menuCard,
            { marginLeft: indent * 20 },
            isDragging && {
              transform: [{ translateY: dragY }],
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              opacity: 0.8,
            },
          ]}
        >
          <View {...pan.panHandlers} style={styles.dragHandle}>
            <GripVertical size={20} color="#9aa0a6" />
          </View>
          <View style={styles.menuContent}>
            <TouchableOpacity
              style={styles.menuCardContent}
              onPress={() => {
                if (isMainMenu) {
                  toggleMainMenu(item.id);
                } else if (isSubMenu && item.parentMainMenuId) {
                  toggleSubMenu(item.parentMainMenuId, item.id);
                }
              }}
              disabled={!hasChildren}
            >
              {hasChildren ? (
                isExpanded || (isSubMenu && expandedState[item.parentMainMenuId!]?.subMenus?.[item.id]) ? (
                  <ChevronDown size={20} color="#5f6368" />
                ) : (
                  <ChevronRight size={20} color="#5f6368" />
                )
              ) : (
                <View style={{ width: 20 }} />
              )}
              <View style={[styles.iconContainer, { backgroundColor: getIconColor(item.level) }]}>
                <Icon size={18} color="#fff" />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuName}>{item.name}</Text>
                <Text style={styles.menuLevel}>{getLevelLabel(item.level)}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.menuActions}>
              {isMainMenu && (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => handleAddSubMenu(item.id)}
                >
                  <Plus size={18} color="#34a853" />
                </TouchableOpacity>
              )}
              {isSubMenu && (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => handleAddActivity(item.parentMainMenuId!, item.id)}
                >
                  <Plus size={18} color="#fbbc04" />
                </TouchableOpacity>
              )}
              {item.level === 'activity' && item.moduleConfig?.boqQuantity && (
                <View style={styles.boqBadgeCompact}>
                  <Database size={10} color="#1967d2" />
                  <Text style={styles.boqBadgeCompactText}>
                    BOQ: {item.moduleConfig.boqQuantity.toLocaleString()} {item.moduleConfig.boqUnit}
                  </Text>
                </View>
              )}
              {item.level === 'activity' && showConfigIndicator && (
                <View style={styles.configIndicator}>
                  <Settings size={14} color="#34a853" />
                </View>
              )}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleEdit(item)}
              >
                <Edit2 size={18} color="#4285F4" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleDelete(item)}
              >
                <Trash2 size={18} color="#ea4335" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
        {isDropTargetBelow && (
          <View style={[styles.dropIndicator, { marginLeft: indent * 20 }]}>
            <View style={styles.dropIndicatorLine} />
            <Text style={styles.dropIndicatorText}>Drop here</Text>
          </View>
        )}

        {isMainMenu && isExpanded && subMenus.map((subMenu, subIndex) => (
          <View key={subMenu.id}>
            {renderMenuItem(subMenu, 1, subIndex)}
            {expandedState[item.id]?.subMenus?.[subMenu.id] && (
              getActivities(subMenu.id).map((activity, actIndex) => renderMenuItem(activity, 2, actIndex))
            )}
          </View>
        ))}
      </View>
    );
  };

  const getIconColor = (level: MenuLevel) => {
    switch (level) {
      case 'main': return '#4285F4';
      case 'sub': return '#34a853';
      case 'activity': return '#fbbc04';
    }
  };

  if (menusQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Menu Manager',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#202124',
          headerTitleStyle: { fontWeight: '600' as const, fontSize: 20 },
        }}
      />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Menu Structure</Text>
          <Text style={styles.headerSubtitle}>
            {mainMenus.length} main menu{mainMenus.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.seedButton} 
            onPress={() => router.push('/seed-menus')}
          >
            <Database size={18} color="#4285F4" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddMainMenu}>
            <Plus size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add Main Menu</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {mainMenus.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Menu size={48} color="#dadce0" />
            <Text style={styles.emptyText}>No menu items yet</Text>
            <Text style={styles.emptySubtext}>Add your first main menu item to get started</Text>
          </View>
        ) : (
          <View style={styles.menuList}>
            {mainMenus.map((mainMenu, index) => renderMenuItem(mainMenu, 0, index))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showAddMainMenuModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddMainMenuModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Main Menu</Text>
              <TouchableOpacity onPress={() => setShowAddMainMenuModal(false)}>
                <X size={24} color="#5f6368" />
              </TouchableOpacity>
            </View>
            <View style={styles.form}>
              <Text style={styles.formLabel}>Main Menu Name</Text>
              <TextInput
                style={[styles.input, styles.textInput]}
                value={mainMenuName}
                onChangeText={setMainMenuName}
                placeholder="Enter main menu name"
                placeholderTextColor="#9aa0a6"
                autoCapitalize="words"
              />
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowAddMainMenuModal(false);
                    setMainMenuName('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={() => addMainMenuMutation.mutate()}
                  disabled={addMainMenuMutation.isPending}
                >
                  {addMainMenuMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddSubMenuModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddSubMenuModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Sub Menu</Text>
              <TouchableOpacity onPress={() => setShowAddSubMenuModal(false)}>
                <X size={24} color="#5f6368" />
              </TouchableOpacity>
            </View>
            <View style={styles.form}>
              <Text style={styles.formLabel}>Parent Main Menu</Text>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  {mainMenus.find(m => m.id === selectedMainMenuId)?.name || 'N/A'}
                </Text>
              </View>
              <Text style={styles.formLabel}>Sub Menu Name</Text>
              <TextInput
                style={[styles.input, styles.textInput]}
                value={subMenuName}
                onChangeText={setSubMenuName}
                placeholder="Enter sub menu name"
                placeholderTextColor="#9aa0a6"
                autoCapitalize="words"
              />
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowAddSubMenuModal(false);
                    setSubMenuName('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={() => addSubMenuMutation.mutate()}
                  disabled={addSubMenuMutation.isPending}
                >
                  {addSubMenuMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddActivityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddActivityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Activity</Text>
              <TouchableOpacity onPress={() => setShowAddActivityModal(false)}>
                <X size={24} color="#5f6368" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollContainer} showsVerticalScrollIndicator={true}>
              <View style={styles.form}>
                <Text style={styles.formLabel}>Parent Main Menu</Text>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    {mainMenus.find(m => m.id === selectedMainMenuId)?.name || 'N/A'}
                  </Text>
                </View>
                <Text style={styles.formLabel}>Parent Sub Menu</Text>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    {getSubMenus(selectedMainMenuId).find(s => s.id === selectedSubMenuId)?.name || 'N/A'}
                  </Text>
                </View>
                <Text style={styles.formLabel}>Activity Name</Text>
                <TextInput
                  style={[styles.input, styles.textInput]}
                  value={activityName}
                  onChangeText={(text) => {
                    console.log('📝 Activity name changed:', text);
                    setActivityName(text);
                  }}
                  placeholder="Enter activity name"
                  placeholderTextColor="#9aa0a6"
                  autoCapitalize="words"
                  autoFocus
                />
                
                <View style={styles.divider} />
                
                <Text style={styles.sectionTitle}>Module Configuration</Text>
                <Text style={styles.sectionSubtitle}>Configure the base block type and micro-modules for this activity</Text>
                
                <ActivityModuleConfigForm
                  initialConfig={activityModuleConfig}
                  onChange={setActivityModuleConfig}
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowAddActivityModal(false);
                    setActivityName('');
                    setActivityModuleConfig(undefined);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={() => {
                    console.log('🔘 Add button pressed');
                    console.log('📝 Current activityName state:', activityName);
                    console.log('📝 Activity name trimmed:', activityName.trim());
                    console.log('📝 Activity name length:', activityName.length);
                    
                    if (!activityName.trim()) {
                      Alert.alert('Validation Error', 'Please enter an activity name');
                      return;
                    }
                    
                    addActivityMutation.mutate();
                  }}
                  disabled={addActivityMutation.isPending}
                >
                  {addActivityMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editingItem ? getLevelLabel(editingItem.level) : ''}</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <X size={24} color="#5f6368" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollContainer} showsVerticalScrollIndicator={true}>
              <View style={styles.form}>
                {editingItem && (editingItem.level === 'sub' || editingItem.level === 'activity') && (
                  <>
                    <Text style={styles.formLabel}>Parent Main Menu</Text>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}>
                        {mainMenus.find(m => m.id === editingItem.parentMainMenuId)?.name || 'N/A'}
                      </Text>
                    </View>
                  </>
                )}
                {editingItem && editingItem.level === 'activity' && (
                  <>
                    <Text style={styles.formLabel}>Parent Sub Menu</Text>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}>
                        {getSubMenus(editingItem.parentMainMenuId || '').find(s => s.id === editingItem.parentSubMenuId)?.name || 'N/A'}
                      </Text>
                    </View>
                  </>
                )}
                <Text style={styles.formLabel}>Name</Text>
                <TextInput
                  style={[styles.input, styles.textInput]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter name"
                  placeholderTextColor="#9aa0a6"
                  autoCapitalize="words"
                />
                
                {editingItem && editingItem.level === 'activity' && (
                  <>
                    <View style={styles.divider} />
                    
                    <Text style={styles.sectionTitle}>Module Configuration</Text>
                    <Text style={styles.sectionSubtitle}>Configure the base block type and micro-modules for this activity</Text>
                    
                    <ActivityModuleConfigForm
                      initialConfig={editModuleConfig}
                      onChange={setEditModuleConfig}
                    />
                  </>
                )}
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                    setEditName('');
                    setEditModuleConfig(undefined);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={() => updateMenuMutation.mutate()}
                  disabled={updateMenuMutation.isPending}
                >
                  {updateMenuMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Update</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#5f6368',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500' as const,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  seedButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  scrollView: {
    flex: 1,
  },
  menuList: {
    padding: 16,
    paddingBottom: 100,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  menuContent: {
    flex: 1,
    flexDirection: 'column',
    gap: 12,
  },
  menuCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuInfo: {
    flex: 1,
    minWidth: 0,
  },

  menuName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#202124',
    flexWrap: 'wrap' as const,
  },
  menuLevel: {
    fontSize: 13,
    color: '#5f6368',
    marginTop: 2,
  },
  menuActions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: '#5f6368',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9aa0a6',
    marginTop: 8,
    textAlign: 'center',
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
    maxWidth: 500,
    ...Platform.select({
      web: {
        maxHeight: '90%',
      },
      default: {
        maxHeight: '85%',
        height: '85%',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#202124',
  },
  modalScroll: {
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#202124',
    fontWeight: '500' as const,
  },
  form: {
    gap: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#5f6368',
    marginBottom: -8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  textInput: {
    fontSize: 16,
    color: '#202124',
  },
  inputText: {
    fontSize: 16,
    color: '#202124',
  },
  placeholderText: {
    color: '#9aa0a6',
  },
  disabledText: {
    color: '#9aa0a6',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#5f6368',
  },
  saveButton: {
    backgroundColor: '#4285F4',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#fff',
  },
  infoBox: {
    backgroundColor: '#e8f0fe',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#d2e3fc',
  },
  infoText: {
    fontSize: 16,
    color: '#1967d2',
    fontWeight: '500' as const,
  },
  divider: {
    height: 1,
    backgroundColor: '#e8eaed',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#5f6368',
    marginBottom: 12,
  },
  configFormScroll: {
    maxHeight: 350,
    marginBottom: 16,
  },
  modalScrollContainer: {
    ...Platform.select({
      web: {
        flex: 1,
      },
      default: {
        maxHeight: Platform.OS === 'ios' ? 500 : 450,
      },
    }),
    marginBottom: 16,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
    paddingTop: 16,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  configIndicator: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boqBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e8f0fe',
    borderWidth: 1,
    borderColor: '#d2e3fc',
    height: 28,
    width: '100%',
    marginTop: 4,
  },
  boqBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#1967d2',
  },
  boqBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e8f0fe',
    borderWidth: 1,
    borderColor: '#d2e3fc',
    height: 36,
  },
  boqBadgeCompactText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#1967d2',
  },
  dragHandle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    cursor: 'grab' as any,
  },

  dropIndicator: {
    height: 40,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropIndicatorLine: {
    width: '100%',
    height: 3,
    backgroundColor: '#4285F4',
    borderRadius: 2,
    marginBottom: 4,
  },
  dropIndicatorText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4285F4',
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
