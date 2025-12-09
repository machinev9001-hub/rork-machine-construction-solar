import { Stack } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Plus, Trash2, Edit2, MapPin, Grid, AlertTriangle } from 'lucide-react-native';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';


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

export default function MasterPvBlocksScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [pvAreaInput, setPvAreaInput] = useState('');
  const [blockAreaInput, setBlockAreaInput] = useState('');
  const [selectedPvAreaId, setSelectedPvAreaId] = useState<string | null>(null);
  const [editingPvArea, setEditingPvArea] = useState<PvArea | null>(null);
  const [editingBlock, setEditingBlock] = useState<BlockArea | null>(null);


  const { data: pvAreas = [], isLoading: loadingPvAreas } = useQuery({
    queryKey: ['pvAreas', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) {
        console.log('[PV Areas] No siteId found in user');
        return [];
      }
      console.log('[PV Areas] Fetching for siteId:', user.siteId);
      const q = query(
        collection(db, 'pvAreas'),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);
      console.log('[PV Areas] Found', snapshot.docs.length, 'areas for site', user.siteId);
      
      const areas = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('[PV Area]', doc.id, 'Name:', data.name, 'SiteId:', data.siteId);
        return {
          id: doc.id,
          ...data,
        };
      }) as PvArea[];
      
      const uniqueNames = new Set(areas.map(a => a.name));
      if (uniqueNames.size !== areas.length) {
        console.error('[PV Areas] WARNING: Found duplicate names!', areas.map(a => ({ id: a.id, name: a.name })));
      }
      
      return areas.sort((a, b) => {
        const numA = parseInt(a.name.replace(/[^0-9]/g, ''), 10) || 0;
        const numB = parseInt(b.name.replace(/[^0-9]/g, ''), 10) || 0;
        return numA - numB;
      });
    },
    enabled: !!user?.siteId,
  });

  const { data: blockAreas = [], isLoading: loadingBlocks } = useQuery({
    queryKey: ['blockAreas', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) {
        console.log('[Block Areas] No siteId found in user');
        return [];
      }
      console.log('[Block Areas] Fetching for siteId:', user.siteId);
      const q = query(
        collection(db, 'blockAreas'),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);
      console.log('[Block Areas] Found', snapshot.docs.length, 'blocks for site', user.siteId);
      
      const blocks = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('[Block Area]', doc.id, 'Name:', data.name, 'PV Area:', data.pvAreaName, 'SiteId:', data.siteId);
        return {
          id: doc.id,
          ...data,
        };
      }) as BlockArea[];
      
      const duplicateCheck = blocks.reduce((acc, block) => {
        const key = `${block.pvAreaId}-${block.name}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(duplicateCheck).forEach(([key, count]) => {
        if (count > 1) {
          console.error('[Block Areas] WARNING: Duplicate blocks found for key:', key, 'count:', count);
        }
      });
      
      return blocks.sort((a, b) => {
        const numA = parseInt(a.name.replace(/[^0-9]/g, ''), 10) || 0;
        const numB = parseInt(b.name.replace(/[^0-9]/g, ''), 10) || 0;
        return numA - numB;
      });
    },
    enabled: !!user?.siteId,
  });

  const addPvAreaMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user?.siteId) throw new Error('No site ID');
      
      const trimmedName = name.trim();
      console.log('[PV Area] Checking for duplicates before adding:', trimmedName, 'for siteId:', user.siteId);
      
      const q = query(
        collection(db, 'pvAreas'),
        where('siteId', '==', user.siteId),
        where('name', '==', trimmedName)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        console.error('[PV Area] Duplicate found in DB:', snapshot.docs.length, 'docs');
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          console.error('[PV Area] Duplicate detail:', doc.id, 'Name:', data.name, 'SiteId:', data.siteId, 'Expected:', user.siteId);
        });
        throw new Error(`PV Area "${trimmedName}" already exists for this site`);
      }
      
      console.log('[PV Area] Adding new area:', trimmedName, 'for siteId:', user.siteId);
      const docRef = await addDoc(collection(db, 'pvAreas'), {
        name: trimmedName,
        siteId: user.siteId,
        createdAt: new Date(),
      });
      console.log('[PV Area] Successfully added:', trimmedName, 'with ID:', docRef.id);
      return docRef;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pvAreas', user?.siteId] });
      setPvAreaInput('');
      Alert.alert('Success', 'PV Area added successfully');
    },
    onError: (error) => {
      console.error('[PV Area] Add error:', error);
      Alert.alert('Error', `Failed to add PV Area: ${error.message}`);
    },
  });

  const updatePvAreaMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await updateDoc(doc(db, 'pvAreas', id), {
        name: name.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pvAreas', user?.siteId] });
      queryClient.invalidateQueries({ queryKey: ['blockAreas', user?.siteId] });
      setEditingPvArea(null);
      setPvAreaInput('');
      Alert.alert('Success', 'PV Area updated successfully');
    },
    onError: (error) => {
      Alert.alert('Error', `Failed to update PV Area: ${error.message}`);
    },
  });

  const deletePvAreaMutation = useMutation({
    mutationFn: async (id: string) => {
      const blocksInArea = blockAreas.filter(b => b.pvAreaId === id);
      for (const block of blocksInArea) {
        await deleteDoc(doc(db, 'blockAreas', block.id));
      }
      await deleteDoc(doc(db, 'pvAreas', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pvAreas', user?.siteId] });
      queryClient.invalidateQueries({ queryKey: ['blockAreas', user?.siteId] });
      Alert.alert('Success', 'PV Area and related blocks deleted successfully');
    },
    onError: (error) => {
      Alert.alert('Error', `Failed to delete PV Area: ${error.message}`);
    },
  });

  const addBlockAreaMutation = useMutation({
    mutationFn: async ({ name, pvAreaId, pvAreaName }: { name: string; pvAreaId: string; pvAreaName: string }) => {
      if (!user?.siteId) throw new Error('No site ID');
      
      const trimmedName = name.trim();
      console.log('[Block Area] Checking for duplicates before adding:', trimmedName, 'in PV Area:', pvAreaId, 'for siteId:', user.siteId);
      
      const q = query(
        collection(db, 'blockAreas'),
        where('siteId', '==', user.siteId),
        where('pvAreaId', '==', pvAreaId),
        where('name', '==', trimmedName)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        console.error('[Block Area] Duplicate found in DB:', snapshot.docs.length, 'docs');
        throw new Error(`Block "${trimmedName}" already exists in PV Area "${pvAreaName}"`);
      }
      
      const docData = {
        name: trimmedName,
        pvAreaId,
        pvAreaName,
        siteId: user.siteId,
        createdAt: new Date(),
      };
      
      console.log('[Block Area] Adding:', docData);
      const docRef = await addDoc(collection(db, 'blockAreas'), docData);
      console.log('[Block Area] Successfully added with ID:', docRef.id);
      return docRef;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockAreas', user?.siteId] });
      queryClient.invalidateQueries({ queryKey: ['pvAreas', user?.siteId] });
      setBlockAreaInput('');
      Alert.alert('Success', 'Block Area added successfully');
    },
    onError: (error) => {
      console.error('[Block Area] Add error:', error);
      Alert.alert('Error', `Failed to add Block Area: ${error.message}`);
    },
  });

  const updateBlockAreaMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await updateDoc(doc(db, 'blockAreas', id), {
        name: name.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockAreas', user?.siteId] });
      setEditingBlock(null);
      setBlockAreaInput('');
      Alert.alert('Success', 'Block Area updated successfully');
    },
    onError: (error) => {
      Alert.alert('Error', `Failed to update Block Area: ${error.message}`);
    },
  });

  const deleteBlockAreaMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'blockAreas', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockAreas', user?.siteId] });
      Alert.alert('Success', 'Block Area deleted successfully');
    },
    onError: (error) => {
      Alert.alert('Error', `Failed to delete Block Area: ${error.message}`);
    },
  });

  const handleAddPvArea = () => {
    if (!pvAreaInput.trim()) {
      Alert.alert('Error', 'Please enter a PV Area name');
      return;
    }
    if (addPvAreaMutation.isPending || updatePvAreaMutation.isPending) {
      console.log('[PV Area] Mutation already in progress, ignoring click');
      return;
    }
    if (editingPvArea) {
      updatePvAreaMutation.mutate({ id: editingPvArea.id, name: pvAreaInput });
    } else {
      addPvAreaMutation.mutate(pvAreaInput);
    }
  };

  const handleEditPvArea = (pvArea: PvArea) => {
    setEditingPvArea(pvArea);
    setPvAreaInput(pvArea.name);
  };

  const handleCancelEditPvArea = () => {
    setEditingPvArea(null);
    setPvAreaInput('');
  };

  const handleDeletePvArea = (id: string) => {
    const blocksCount = blockAreas.filter(b => b.pvAreaId === id).length;
    const message = blocksCount > 0 
      ? `This will delete ${blocksCount} block(s) in this PV Area. Continue?`
      : 'Are you sure you want to delete this PV Area?';
    
    Alert.alert('Confirm Delete', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePvAreaMutation.mutate(id) },
    ]);
  };

  const handleAddBlockArea = () => {
    if (!blockAreaInput.trim()) {
      Alert.alert('Error', 'Please enter a Block Area name');
      return;
    }
    if (!selectedPvAreaId && !editingBlock) {
      Alert.alert('Error', 'Please select a PV Area first');
      return;
    }
    if (addBlockAreaMutation.isPending || updateBlockAreaMutation.isPending) {
      console.log('[Block Area] Mutation already in progress, ignoring click');
      return;
    }

    if (editingBlock) {
      updateBlockAreaMutation.mutate({ 
        id: editingBlock.id, 
        name: blockAreaInput
      });
    } else {
      const pvArea = pvAreas.find(p => p.id === selectedPvAreaId);
      if (!pvArea) return;
      
      addBlockAreaMutation.mutate({ 
        name: blockAreaInput, 
        pvAreaId: selectedPvAreaId!, 
        pvAreaName: pvArea.name
      });
    }
  };

  const handleEditBlock = (block: BlockArea) => {
    setEditingBlock(block);
    setBlockAreaInput(block.name);
  };

  const handleCancelEditBlock = () => {
    setEditingBlock(null);
    setBlockAreaInput('');
  };



  const handleDeleteBlockArea = (id: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this Block Area?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBlockAreaMutation.mutate(id) },
    ]);
  };

  const filteredBlocks = selectedPvAreaId 
    ? blockAreas.filter(b => b.pvAreaId === selectedPvAreaId)
    : blockAreas;

  const isLoading = loadingPvAreas || loadingBlocks;

  const cleanupOrphanedPvAreas = useMutation({
    mutationFn: async () => {
      if (!user?.siteId) throw new Error('No site ID');
      
      console.log('[Diagnostic] Starting diagnostic for site:', user.siteId);
      console.log('[Diagnostic] =====================================');
      
      const allPvAreasSnapshot = await getDocs(collection(db, 'pvAreas'));
      const allBlockAreasSnapshot = await getDocs(collection(db, 'blockAreas'));
      
      const ghostPvAreas: any[] = [];
      const validPvAreas: any[] = [];
      const otherSitePvAreas: any[] = [];
      
      const ghostBlocks: any[] = [];
      const validBlocks: any[] = [];
      const otherSiteBlocks: any[] = [];
      
      console.log('[Diagnostic] Total PV Areas in DB:', allPvAreasSnapshot.docs.length);
      console.log('[Diagnostic] Total Blocks in DB:', allBlockAreasSnapshot.docs.length);
      console.log('');
      
      allPvAreasSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const pvArea = { id: doc.id, name: data.name, siteId: data.siteId || 'MISSING' };
        
        if (!data.siteId || data.siteId === '') {
          ghostPvAreas.push(pvArea);
          console.log('[Diagnostic] 👻 GHOST PV Area:', pvArea.name, '(ID:', doc.id, ') - NO SITE ID');
        } else if (data.siteId === user.siteId) {
          validPvAreas.push(pvArea);
          console.log('[Diagnostic] ✅ Valid PV Area:', pvArea.name, '(ID:', doc.id, ') - Belongs to current site');
        } else {
          otherSitePvAreas.push(pvArea);
          console.log('[Diagnostic] 🔵 Other Site PV Area:', pvArea.name, '(ID:', doc.id, ') - SiteId:', data.siteId);
        }
      });
      
      console.log('');
      
      allBlockAreasSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const block = { id: doc.id, name: data.name, pvAreaName: data.pvAreaName, siteId: data.siteId || 'MISSING' };
        
        if (!data.siteId || data.siteId === '') {
          ghostBlocks.push(block);
          console.log('[Diagnostic] 👻 GHOST Block:', block.name, 'in PV:', block.pvAreaName, '(ID:', doc.id, ') - NO SITE ID');
        } else if (data.siteId === user.siteId) {
          validBlocks.push(block);
          console.log('[Diagnostic] ✅ Valid Block:', block.name, 'in PV:', block.pvAreaName, '(ID:', doc.id, ') - Belongs to current site');
        } else {
          otherSiteBlocks.push(block);
          console.log('[Diagnostic] 🔵 Other Site Block:', block.name, 'in PV:', block.pvAreaName, '(ID:', doc.id, ') - SiteId:', data.siteId);
        }
      });
      
      console.log('');
      console.log('[Diagnostic] ===== SUMMARY =====');
      console.log('[Diagnostic] Current Site ID:', user.siteId);
      console.log('[Diagnostic] Valid PV Areas (current site):', validPvAreas.length);
      console.log('[Diagnostic] Ghost PV Areas (no siteId):', ghostPvAreas.length);
      console.log('[Diagnostic] Other Site PV Areas:', otherSitePvAreas.length);
      console.log('[Diagnostic] Valid Blocks (current site):', validBlocks.length);
      console.log('[Diagnostic] Ghost Blocks (no siteId):', ghostBlocks.length);
      console.log('[Diagnostic] Other Site Blocks:', otherSiteBlocks.length);
      console.log('[Diagnostic] =====================================');
      
      const totalIssues = ghostPvAreas.length + ghostBlocks.length;
      
      if (totalIssues === 0) {
        return {
          cleaned: 0,
          hasIssues: false,
          message: `✅ All Clear!\n\nCurrent site: ${validPvAreas.length} PV Areas, ${validBlocks.length} Blocks\nOther sites: ${otherSitePvAreas.length} PV Areas, ${otherSiteBlocks.length} Blocks\n\nNo ghost data found. Data is properly isolated!`,
          ghostPvAreas,
          ghostBlocks,
        };
      }
      
      return {
        cleaned: 0,
        hasIssues: true,
        message: `⚠️ Found ${totalIssues} Issues\n\nGhost PV Areas (no siteId): ${ghostPvAreas.length}\nGhost Blocks (no siteId): ${ghostBlocks.length}\n\nThese ghost records are blocking you from adding new data.\n\nWould you like to:\n1. Delete them (recommended if data is old)\n2. Assign them to current site\n\nCheck console for details.`,
        ghostPvAreas,
        ghostBlocks,
      };
    },
    onSuccess: (data) => {
      if (data.hasIssues) {
        Alert.alert(
          'Diagnostic Results',
          data.message,
          [
            {
              text: 'Delete Ghosts',
              style: 'destructive',
              onPress: () => deleteGhostRecords.mutate({ ghostPvAreas: data.ghostPvAreas, ghostBlocks: data.ghostBlocks }),
            },
            {
              text: 'Assign to Current Site',
              onPress: () => assignGhostsToSite.mutate({ ghostPvAreas: data.ghostPvAreas, ghostBlocks: data.ghostBlocks }),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Diagnostic Results', data.message);
      }
      queryClient.invalidateQueries({ queryKey: ['pvAreas', user?.siteId] });
      queryClient.invalidateQueries({ queryKey: ['blockAreas', user?.siteId] });
    },
    onError: (error) => {
      Alert.alert('Error', `Diagnostic failed: ${error.message}`);
    },
  });

  const deleteGhostRecords = useMutation({
    mutationFn: async ({ ghostPvAreas, ghostBlocks }: { ghostPvAreas: any[]; ghostBlocks: any[] }) => {
      console.log('[Delete Ghosts] Starting deletion...');
      
      for (const pvArea of ghostPvAreas) {
        console.log('[Delete Ghosts] Deleting PV Area:', pvArea.name, pvArea.id);
        await deleteDoc(doc(db, 'pvAreas', pvArea.id));
      }
      
      for (const block of ghostBlocks) {
        console.log('[Delete Ghosts] Deleting Block:', block.name, block.id);
        await deleteDoc(doc(db, 'blockAreas', block.id));
      }
      
      console.log('[Delete Ghosts] Deletion complete');
      return { deletedPvAreas: ghostPvAreas.length, deletedBlocks: ghostBlocks.length };
    },
    onSuccess: (data) => {
      Alert.alert(
        'Success',
        `Deleted ${data.deletedPvAreas} ghost PV Areas and ${data.deletedBlocks} ghost Blocks.\n\nYou can now add new PV Areas!`
      );
      queryClient.invalidateQueries({ queryKey: ['pvAreas', user?.siteId] });
      queryClient.invalidateQueries({ queryKey: ['blockAreas', user?.siteId] });
    },
    onError: (error) => {
      Alert.alert('Error', `Failed to delete ghost records: ${error.message}`);
    },
  });

  const assignGhostsToSite = useMutation({
    mutationFn: async ({ ghostPvAreas, ghostBlocks }: { ghostPvAreas: any[]; ghostBlocks: any[] }) => {
      if (!user?.siteId) throw new Error('No site ID');
      
      console.log('[Assign Ghosts] Assigning ghosts to site:', user.siteId);
      
      for (const pvArea of ghostPvAreas) {
        console.log('[Assign Ghosts] Assigning PV Area:', pvArea.name, 'to site:', user.siteId);
        await updateDoc(doc(db, 'pvAreas', pvArea.id), {
          siteId: user.siteId,
        });
      }
      
      for (const block of ghostBlocks) {
        console.log('[Assign Ghosts] Assigning Block:', block.name, 'to site:', user.siteId);
        await updateDoc(doc(db, 'blockAreas', block.id), {
          siteId: user.siteId,
        });
      }
      
      console.log('[Assign Ghosts] Assignment complete');
      return { assignedPvAreas: ghostPvAreas.length, assignedBlocks: ghostBlocks.length };
    },
    onSuccess: (data) => {
      Alert.alert(
        'Success',
        `Assigned ${data.assignedPvAreas} PV Areas and ${data.assignedBlocks} Blocks to current site.\n\nThey should now appear in your lists!`
      );
      queryClient.invalidateQueries({ queryKey: ['pvAreas', user?.siteId] });
      queryClient.invalidateQueries({ queryKey: ['blockAreas', user?.siteId] });
    },
    onError: (error) => {
      Alert.alert('Error', `Failed to assign ghost records: ${error.message}`);
    },
  });

  const handleDiagnostic = () => {
    Alert.alert(
      'Run Diagnostic',
      'This will check for data issues and ghost records. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Run Diagnostic', onPress: () => cleanupOrphanedPvAreas.mutate() },
      ]
    );
  };



  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'PV Areas & Blocks',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#202124',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
          headerRight: () => (
            <TouchableOpacity
              style={styles.diagnosticButton}
              onPress={handleDiagnostic}
              activeOpacity={0.7}
            >
              <AlertTriangle size={20} color="#EA4335" strokeWidth={2} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {pvAreas.length === 0 && !loadingPvAreas && (
          <View style={styles.diagnosticCard}>
            <View style={styles.diagnosticHeader}>
              <AlertTriangle size={20} color="#EA4335" strokeWidth={2} />
              <Text style={styles.diagnosticTitle}>Having issues adding PV Areas?</Text>
            </View>
            <Text style={styles.diagnosticText}>
              If you&apos;re seeing errors like &quot;already exists&quot; but don&apos;t see any PV Areas above, 
              tap the diagnostic icon (⚠️) in the header to check for ghost data.
            </Text>
            <Text style={styles.diagnosticSubtext}>
              This can happen if data wasn&apos;t properly isolated by site.
            </Text>
          </View>
        )}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={24} color="#4285F4" strokeWidth={2.5} />
            <Text style={styles.sectionTitle}>PV Areas</Text>
          </View>

          <View style={styles.addCard}>
            <TextInput
              style={styles.input}
              placeholder="Enter PV Area name (e.g., PV01, North, etc.)"
              placeholderTextColor="#9ca3af"
              value={pvAreaInput}
              onChangeText={setPvAreaInput}
            />
            <View style={styles.addButtonsRow}>
              {editingPvArea && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelEditPvArea}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.addButton, (addPvAreaMutation.isPending || updatePvAreaMutation.isPending) && styles.addButtonDisabled]}
                onPress={handleAddPvArea}
                disabled={addPvAreaMutation.isPending || updatePvAreaMutation.isPending}
                activeOpacity={0.7}
              >
                {(addPvAreaMutation.isPending || updatePvAreaMutation.isPending) ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Plus size={20} color="#ffffff" strokeWidth={2.5} />
                    <Text style={styles.addButtonText}>{editingPvArea ? 'Update' : 'Add'} PV Area</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
              <Text style={styles.loadingText}>Loading PV Areas...</Text>
            </View>
          ) : pvAreas.length === 0 ? (
            <View style={styles.emptyState}>
              <MapPin size={48} color="#d1d5db" strokeWidth={1.5} />
              <Text style={styles.emptyStateText}>No PV Areas yet</Text>
              <Text style={styles.emptyStateSubtext}>Add your first PV Area above</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {pvAreas.map(pvArea => (
                <View key={pvArea.id} style={styles.listItem}>
                  <View style={styles.listItemContent}>
                    <MapPin size={20} color="#4285F4" strokeWidth={2} />
                    <Text style={styles.listItemText}>{pvArea.name}</Text>
                    <View style={styles.blockCount}>
                      <Text style={styles.blockCountText}>
                        {blockAreas.filter(b => b.pvAreaId === pvArea.id).length} blocks
                      </Text>
                    </View>
                  </View>
                  <View style={styles.listItemActions}>
                    <TouchableOpacity
                      style={styles.editIconButton}
                      onPress={() => handleEditPvArea(pvArea)}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={18} color="#4285F4" strokeWidth={2} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteIconButton}
                      onPress={() => handleDeletePvArea(pvArea.id)}
                      disabled={deletePvAreaMutation.isPending}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={18} color="#EA4335" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Grid size={24} color="#34A853" strokeWidth={2.5} />
            <Text style={styles.sectionTitle}>Block Areas</Text>
          </View>

          {pvAreas.length === 0 ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>Add PV Areas first before adding blocks</Text>
            </View>
          ) : (
            <>


              <View style={styles.addCard}>
                {!editingBlock && (
                  <View style={styles.pvAreaSelector}>
                    <Text style={styles.inputLabel}>Select PV Area:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pvAreaChipsContainer}
                    >
                      {pvAreas.map(pvArea => (
                        <TouchableOpacity
                          key={pvArea.id}
                          style={[styles.pvAreaChip, selectedPvAreaId === pvArea.id && styles.pvAreaChipActive]}
                          onPress={() => setSelectedPvAreaId(pvArea.id)}
                          activeOpacity={0.7}
                        >
                          <MapPin size={16} color={selectedPvAreaId === pvArea.id ? '#4285F4' : '#5f6368'} strokeWidth={2} />
                          <Text style={[styles.pvAreaChipText, selectedPvAreaId === pvArea.id && styles.pvAreaChipTextActive]}>
                            {pvArea.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Enter Block Number name (e.g., B01, Block-A, etc.)"
                  placeholderTextColor="#9ca3af"
                  value={blockAreaInput}
                  onChangeText={setBlockAreaInput}
                />

                <View style={styles.addButtonsRow}>
                  {editingBlock && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancelEditBlock}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.addButton, (addBlockAreaMutation.isPending || updateBlockAreaMutation.isPending) && styles.addButtonDisabled]}
                    onPress={handleAddBlockArea}
                    disabled={addBlockAreaMutation.isPending || updateBlockAreaMutation.isPending}
                    activeOpacity={0.7}
                  >
                    {(addBlockAreaMutation.isPending || updateBlockAreaMutation.isPending) ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Plus size={20} color="#ffffff" strokeWidth={2.5} />
                        <Text style={styles.addButtonText}>{editingBlock ? 'Update' : 'Add'} Block Number</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {filteredBlocks.length === 0 ? (
                <View style={styles.emptyState}>
                  <Grid size={48} color="#d1d5db" strokeWidth={1.5} />
                  <Text style={styles.emptyStateText}>No Block Areas yet</Text>
                  <Text style={styles.emptyStateSubtext}>
                    {selectedPvAreaId 
                      ? 'No blocks in this PV Area'
                      : 'Add your first Block Area above'}
                  </Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {filteredBlocks.map(block => (
                    <View key={block.id} style={styles.blockListItemContainer}>
                      <View style={styles.listItem}>
                        <View style={styles.listItemContent}>
                          <Grid size={20} color="#34A853" strokeWidth={2} />
                          <View style={styles.blockInfo}>
                            <Text style={styles.listItemText}>{block.name}</Text>
                            <Text style={styles.blockSubtext}>{block.pvAreaName}</Text>
                          </View>
                        </View>
                        <View style={styles.listItemActions}>
                          <TouchableOpacity
                            style={styles.editIconButton}
                            onPress={() => handleEditBlock(block)}
                            activeOpacity={0.7}
                          >
                            <Edit2 size={18} color="#34A853" strokeWidth={2} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteIconButton}
                            onPress={() => handleDeleteBlockArea(block.id)}
                            disabled={deleteBlockAreaMutation.isPending}
                            activeOpacity={0.7}
                          >
                            <Trash2 size={18} color="#EA4335" strokeWidth={2} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#202124',
  },
  addCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#202124',
    borderWidth: 1,
    borderColor: '#e8eaed',
    marginBottom: 12,
  },
  addButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#4285F4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  cancelButton: {
    backgroundColor: '#f1f3f4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#5f6368',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  listContainer: {
    gap: 8,
  },
  listItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  listItemText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#202124',
  },
  listItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e8f0fe',
  },
  deleteIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fef1f0',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#5f6368',
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#5f6368',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  blockCount: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  blockCountText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  blockInfo: {
    flex: 1,
  },
  blockSubtext: {
    fontSize: 13,
    color: '#5f6368',
    marginTop: 2,
  },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#5f6368',
    marginBottom: 12,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  filterChipActive: {
    backgroundColor: '#e8f0fe',
    borderColor: '#4285F4',
    borderWidth: 2,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#5f6368',
  },
  filterChipTextActive: {
    color: '#4285F4',
    fontWeight: '600' as const,
  },
  infoCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffd54f',
  },
  infoText: {
    fontSize: 14,
    color: '#f57c00',
    textAlign: 'center',
  },
  configSection: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
  },
  configSectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 4,
  },
  configDescription: {
    backgroundColor: '#fff8e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffd966',
  },
  configDescriptionText: {
    fontSize: 12,
    color: '#5f6368',
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallInput: {
    flex: 1,
    marginBottom: 0,
  },
  addSmallButton: {
    backgroundColor: '#34A853',
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  blockConfig: {
    marginTop: 4,
  },
  blockConfigText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#5f6368',
    marginTop: 2,
  },
  blockConfigDetailText: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 1,
  },
  rowConfigInput: {
    gap: 12,
    marginBottom: 12,
  },
  rowInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  columnInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#5f6368',
    minWidth: 70,
  },
  rowNumberInput: {
    flex: 1,
    marginBottom: 0,
  },
  columnsInput: {
    flex: 1,
    marginBottom: 0,
  },
  addRowButton: {
    backgroundColor: '#34A853',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
  },
  addRowButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  rowConfigsList: {
    gap: 8,
  },
  rowConfigsHeader: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 8,
  },
  rowConfigCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  rowConfigContent: {
    flex: 1,
    gap: 4,
  },
  rowConfigLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#202124',
  },
  rowConfigColumns: {
    fontSize: 13,
    color: '#4285F4',
    fontWeight: '600' as const,
  },
  removeRowButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fef1f0',
  },
  stepIndicator: {
    marginBottom: 16,
  },
  stepBadge: {
    backgroundColor: '#4285F4',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  stepBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  stepDescription: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#202124',
  },
  pvAreaSelector: {
    marginBottom: 16,
  },
  pvAreaChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  pvAreaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f3f4',
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  pvAreaChipActive: {
    backgroundColor: '#e8f0fe',
    borderColor: '#4285F4',
    borderWidth: 2,
  },
  pvAreaChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#5f6368',
  },
  pvAreaChipTextActive: {
    color: '#4285F4',
    fontWeight: '700' as const,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#e8eaed',
    marginVertical: 20,
  },
  addBlockButton: {
    flex: 1,
    backgroundColor: '#4285F4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  gridExplanation: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c2e0ff',
  },
  gridExplanationText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1967d2',
    marginBottom: 6,
  },
  gridExplanationSubtext: {
    fontSize: 12,
    color: '#5f6368',
    marginTop: 2,
    lineHeight: 18,
  },
  rowConfigLabelContainer: {
    marginBottom: 8,
  },
  rowBadge: {
    backgroundColor: '#34A853',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  rowBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  columnsChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  columnChip: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  columnChipText: {
    color: '#4285F4',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  blockListItemContainer: {
    marginBottom: 8,
  },
  blockConfigBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  blockConfigBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#34A853',
  },
  expandedGridView: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  gridHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#34A853',
  },
  gridHeaderText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#202124',
  },
  gridHeaderSubtext: {
    fontSize: 12,
    color: '#5f6368',
    marginTop: 2,
  },
  gridRow: {
    marginBottom: 12,
  },
  gridRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#e8eaed',
    gap: 12,
  },
  gridRowLabel: {
    backgroundColor: '#34A853',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gridRowLabelText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  gridColumnsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridCell: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#4285F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  gridCellRow: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#34A853',
  },
  gridCellDivider: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: '#9ca3af',
  },
  gridCellColumn: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#4285F4',
  },
  scopeExplanation: {
    backgroundColor: '#fff8e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffd966',
  },
  scopeExplanationText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#b8860b',
    marginBottom: 6,
  },
  scopeExplanationSubtext: {
    fontSize: 12,
    color: '#5f6368',
    marginTop: 2,
    lineHeight: 18,
  },
  addActivityScopeButton: {
    backgroundColor: '#FBBC04',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
  },
  addActivityScopeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  scopesList: {
    gap: 8,
    marginTop: 8,
  },
  scopesHeader: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 8,
  },
  scopeCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  scopeCardContent: {
    flex: 1,
    gap: 6,
  },
  scopeCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  scopeCardActivity: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#202124',
    flex: 1,
  },
  scopeCardBadge: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scopeCardBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  scopeCardDetails: {
    gap: 2,
  },
  scopeCardDetailText: {
    fontSize: 12,
    color: '#5f6368',
  },
  removeScopeButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fef1f0',
  },
  columnCountBadge: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  columnCountText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  expandIndicator: {
    fontSize: 14,
    color: '#5f6368',
    marginLeft: 'auto',
  },
  headerSaveButton: {
    backgroundColor: '#4285F4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    marginRight: 8,
  },
  headerSaveButtonDisabled: {
    opacity: 0.4,
  },
  headerSaveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  saveHintCard: {
    backgroundColor: '#e8f0fe',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#4285F4',
    marginTop: 8,
  },
  saveHintText: {
    flex: 1,
    fontSize: 13,
    color: '#1967d2',
    lineHeight: 18,
  },
  saveHintBold: {
    fontWeight: '700' as const,
  },
  gridHeaderTitleRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  configureActivityButton: {
    backgroundColor: '#FBBC04' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  configureActivityButtonText: {
    color: '#ffffff' as const,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  modalOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#202124',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#5f6368',
    marginTop: 4,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#5f6368',
    marginBottom: 8,
  },
  modalPickerContainer: {
    marginBottom: 4,
  },
  modalChipsContainer: {
    flexDirection: 'row' as const,
    gap: 8,
    paddingVertical: 4,
  },
  modalChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  modalChipActive: {
    backgroundColor: '#e8f0fe',
    borderColor: '#4285F4',
    borderWidth: 2,
  },
  modalChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#5f6368',
  },
  modalChipTextActive: {
    color: '#4285F4',
    fontWeight: '600' as const,
  },
  modalActivitiesContainer: {
    gap: 8,
  },
  modalActivityCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  modalActivityCardActive: {
    backgroundColor: '#e8f0fe',
    borderColor: '#4285F4',
    borderWidth: 2,
  },
  modalActivityCardContent: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  modalActivityCardText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#202124',
  },
  modalActivityCardTextActive: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#e8eaed',
    marginVertical: 20,
  },
  modalInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#202124',
    borderWidth: 1,
    borderColor: '#e8eaed',
    marginBottom: 4,
  },
  modalOptionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e8eaed',
    marginBottom: 12,
  },
  modalOptionCardActive: {
    backgroundColor: '#e8f0fe',
    borderColor: '#4285F4',
    borderWidth: 2,
  },
  modalOptionContent: {
    gap: 8,
  },
  modalOptionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#202124',
  },
  modalOptionTitleActive: {
    color: '#4285F4',
    fontWeight: '700' as const,
  },
  modalOptionDescription: {
    fontSize: 13,
    color: '#5f6368',
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row' as const,
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f1f3f4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalCancelButtonText: {
    color: '#5f6368',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  modalSaveButton: {
    flex: 2,
    backgroundColor: '#4285F4',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  modalSaveButtonDisabled: {
    opacity: 0.4,
  },
  modalSaveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  diagnosticButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#fef1f0',
  },
  diagnosticCard: {
    backgroundColor: '#fff4e5',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  diagnosticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  diagnosticTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#e65100',
  },
  diagnosticText: {
    fontSize: 14,
    color: '#5f6368',
    lineHeight: 20,
    marginBottom: 8,
  },
  diagnosticSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
  },
});
