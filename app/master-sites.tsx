import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { Plus, Building2, MapPin, ChevronDown, ChevronUp, Edit, Archive, ExternalLink, RefreshCw, Trash2 } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Site } from '@/types';

export default function MasterSitesScreen() {
  const { user, masterAccount, createSite, updateSite, archiveSite, openSite } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [archivingSite, setArchivingSite] = useState<Site | null>(null);
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);
  const [confirmText, setConfirmText] = useState('');



  const normalizedSiteName = useMemo(() => {
    if (!archivingSite?.name) return '';
    return archivingSite.name.trim();
  }, [archivingSite]);

  const normalizedDeleteSiteName = useMemo(() => {
    if (!deletingSite?.name) return '';
    return deletingSite.name.trim();
  }, [deletingSite]);

  const isArchiveConfirmValid = useMemo(() => {
    if (!normalizedSiteName) {
      console.log('[Archive Validation] No normalized site name');
      return false;
    }
    const trimmedInput = confirmText.trim();
    const result = trimmedInput === normalizedSiteName;
    console.log('[Archive Validation]', {
      input: trimmedInput,
      inputRaw: confirmText,
      expected: normalizedSiteName,
      match: result,
      inputLength: trimmedInput.length,
      expectedLength: normalizedSiteName.length,
      inputChars: trimmedInput.split('').map(c => c.charCodeAt(0)),
      expectedChars: normalizedSiteName.split('').map(c => c.charCodeAt(0)),
    });
    return result;
  }, [confirmText, normalizedSiteName]);

  const isDeleteConfirmValid = useMemo(() => {
    if (!normalizedDeleteSiteName) return false;
    const trimmedInput = confirmText.trim();
    return trimmedInput === normalizedDeleteSiteName;
  }, [confirmText, normalizedDeleteSiteName]);
  
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteDescription, setNewSiteDescription] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');

  const masterDataMemo = useMemo(() => (user?.role === 'master' ? user : masterAccount), [user, masterAccount]);

  const derivedMaster = useMemo(() => {
    if (!masterDataMemo) {
      return null;
    }
    return {
      id: masterDataMemo.id,
      name: masterDataMemo.name,
      companyIds: masterDataMemo.companyIds || [],
      currentCompanyId: masterDataMemo.currentCompanyId,
      masterIdentifier: 'masterId' in masterDataMemo ? masterDataMemo.masterId : masterDataMemo.userId,
    };
  }, [masterDataMemo]);

  // Load current company info
  const companyQuery = useQuery({
    queryKey: ['current-company', derivedMaster?.currentCompanyId],
    queryFn: async () => {
      if (!derivedMaster?.currentCompanyId) return null;
      
      const companyRef = doc(db, 'companies', derivedMaster.currentCompanyId);
      const companyDoc = await getDoc(companyRef);
      
      if (!companyDoc.exists()) return null;
      
      const data = companyDoc.data();
      return {
        id: companyDoc.id,
        name: data.alias || data.legalEntityName || 'Unknown Company'
      };
    },
    enabled: !!derivedMaster?.currentCompanyId,
  });

  const sitesQuery = useQuery({
    queryKey: ['master-sites', derivedMaster?.currentCompanyId, derivedMaster?.masterIdentifier],
    queryFn: async () => {
      if (!derivedMaster) {
        console.log('[MasterSites] No master account/user logged in');
        return [];
      }

      const companyIds = derivedMaster.companyIds || [];
      const currentCompanyId = derivedMaster.currentCompanyId;
      
      console.log('[MasterSites] =====================================');
      console.log('[MasterSites] Fetching sites for Master:');
      console.log('  - Master Name:', derivedMaster.name);
      console.log('  - Master ID:', derivedMaster.masterIdentifier);
      console.log('  - Company IDs:', companyIds);
      console.log('  - Current Company ID:', currentCompanyId);
      
      const sitesRef = collection(db, 'sites');
      const allSites: Site[] = [];
      
      // If no companyIds and no currentCompanyId, query by masterAccountId
      if (companyIds.length === 0 && !currentCompanyId) {
        console.log('[MasterSites] No company IDs found, querying by masterAccountId:', derivedMaster.id);
        const sitesQuery = query(
          sitesRef,
          where('masterAccountId', '==', derivedMaster.id)
        );
        const sitesSnapshot = await getDocs(sitesQuery);
        console.log('[MasterSites] Found', sitesSnapshot.size, 'sites for masterAccountId');
        
        sitesSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('[MasterSites] Site data:', {
            id: doc.id,
            name: data.name,
            companyId: data.companyId,
            masterAccountId: data.masterAccountId
          });
          allSites.push({
            id: doc.id,
            name: data.name,
            companyId: data.companyId || '',
            masterAccountId: data.masterAccountId || derivedMaster.id,
            description: data.description,
            location: data.location,
            status: data.status || 'Active',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        
        console.log('[MasterSites] =====================================');
        console.log('[MasterSites] Total sites returned:', allSites.length);
        return allSites;
      }
      
      const targetCompanyIds = currentCompanyId ? [currentCompanyId] : companyIds;
      
      console.log('[MasterSites] Target company IDs to query:', targetCompanyIds);
      
      if (targetCompanyIds.length === 0) {
        console.log('[MasterSites] No target company IDs, returning empty list');
        return [];
      }
      
      // Fetch sites for the selected company or all companies
      for (const companyId of targetCompanyIds) {
        console.log('[MasterSites] Querying sites for company:', companyId);
        const sitesQuery = query(
          sitesRef,
          where('companyId', '==', companyId)
        );
        const sitesSnapshot = await getDocs(sitesQuery);
        console.log('[MasterSites] Found', sitesSnapshot.size, 'sites for company:', companyId);
        
        sitesSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('[MasterSites] Site data:', {
            id: doc.id,
            name: data.name,
            companyId: data.companyId
          });
          allSites.push({
            id: doc.id,
            name: data.name,
            companyId: data.companyId || companyId,
            masterAccountId: data.masterAccountId || derivedMaster.id,
            description: data.description,
            location: data.location,
            status: data.status || 'Active',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
      }
      
      console.log('[MasterSites] =====================================');
      console.log('[MasterSites] Total sites returned:', allSites.length);
      return allSites;
    },
    enabled: !!derivedMaster,
  });

  const createSiteMutation = useMutation({
    mutationFn: async () => {
      const result = await createSite(newSiteName, newSiteDescription, newSiteLocation);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-sites'] });
      setShowAddModal(false);
      setNewSiteName('');
      setNewSiteDescription('');
      setNewSiteLocation('');
      Alert.alert('Success', 'Site created successfully');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const updateSiteMutation = useMutation({
    mutationFn: async (updates: { siteId: string; updates: Partial<Pick<Site, 'name' | 'description' | 'location' | 'status'>> }) => {
      const result = await updateSite(updates.siteId, updates.updates);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-sites'] });
      setShowEditModal(false);
      setEditingSite(null);
      Alert.alert('Success', 'Site updated successfully');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const archiveSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const result = await archiveSite(siteId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-sites'] });
      setShowArchiveModal(false);
      setArchivingSite(null);
      setConfirmText('');
      Alert.alert('Success', 'Site archived successfully');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const unarchiveSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const result = await updateSite(siteId, { status: 'Active' });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-sites'] });
      Alert.alert('Success', 'Site recovered successfully');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      console.log('[Delete] Permanently deleting site from Firebase:', siteId);
      try {
        const siteRef = doc(db, 'sites', siteId);
        
        const siteDoc = await getDoc(siteRef);
        if (!siteDoc.exists()) {
          console.log('[Delete] Site does not exist in Firebase');
          throw new Error('Site not found');
        }
        
        console.log('[Delete] Site found, deleting...', siteDoc.data());
        await deleteDoc(siteRef);
        console.log('[Delete] Site permanently removed from Firebase');
        
        const verifyDoc = await getDoc(siteRef);
        if (verifyDoc.exists()) {
          console.log('[Delete] ERROR: Site still exists after deletion!');
          throw new Error('Failed to delete site');
        }
        
        console.log('[Delete] Verified: Site successfully deleted');
        return { success: true };
      } catch (error) {
        console.error('[Delete] Error during deletion:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('[Delete] Mutation success, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['master-sites'] });
      queryClient.refetchQueries({ queryKey: ['master-sites'] });
      setShowDeleteModal(false);
      setDeletingSite(null);
      setConfirmText('');
      Alert.alert('Success', 'Site permanently deleted from Firebase');
    },
    onError: (error: Error) => {
      console.error('[Delete] Mutation error:', error);
      Alert.alert('Delete Failed', error.message || 'Failed to delete site from Firebase');
    },
  });

  const handleAddSite = () => {
    if (!newSiteName.trim()) {
      Alert.alert('Error', 'Please enter site name');
      return;
    }
    
    createSiteMutation.mutate();
  };

  const handleEditSite = (site: Site) => {
    setEditingSite(site);
    setNewSiteName(site.name);
    setNewSiteDescription(site.description || '');
    setNewSiteLocation(site.location || '');
    setShowEditModal(true);
  };

  const handleUpdateSite = () => {
    if (!editingSite) return;
    if (!newSiteName.trim()) {
      Alert.alert('Error', 'Please enter site name');
      return;
    }
    updateSiteMutation.mutate({
      siteId: editingSite.id,
      updates: {
        name: newSiteName,
        description: newSiteDescription,
        location: newSiteLocation,
      },
    });
  };

  const handleArchiveSite = (site: Site) => {
    console.log('[Archive] Opening modal for site:', site.name);
    setConfirmText('');
    setArchivingSite(site);
    setShowArchiveModal(true);
  };

  const handleConfirmArchive = () => {
    console.log('[Archive] Archive button pressed');
    
    if (!archivingSite) {
      console.log('[Archive] ERROR: No archivingSite');
      return;
    }
    if (!isArchiveConfirmValid) {
      console.log('[Archive] ERROR: Validation failed');
      Alert.alert('Error', 'Site name does not match. Please type the exact site name to confirm.');
      return;
    }
    console.log('[Archive] Archiving site:', archivingSite.id);
    archiveSiteMutation.mutate(archivingSite.id);
  };

  const handleRecoverSite = (site: Site) => {
    Alert.alert(
      'Recover Site',
      `Are you sure you want to recover "${site.name}" and make it active again?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Recover', style: 'default', onPress: () => unarchiveSiteMutation.mutate(site.id) },
      ]
    );
  };

  const handleDeleteSite = (site: Site) => {
    setDeletingSite(site);
    setConfirmText('');
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    console.log('[Delete] Delete button pressed');
    
    if (!deletingSite) {
      console.log('[Delete] ERROR: No deletingSite');
      return;
    }
    if (!isDeleteConfirmValid) {
      console.log('[Delete] ERROR: Validation failed');
      Alert.alert('Error', 'Site name does not match. Please type the exact site name to confirm.');
      return;
    }
    console.log('[Delete] Permanently deleting site:', deletingSite.id);
    deleteSiteMutation.mutate(deletingSite.id);
  };

  const handleOpenSite = async (site: Site) => {
    try {
      console.log('[MasterSites] Opening site:', site.name, 'siteId:', site.id);
      
      const result = await openSite(site.id, site.name, site.companyId);
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to open site');
        return;
      }

      console.log('[MasterSites] Site opened successfully, navigating to home');
      router.push('/(tabs)');
    } catch (error) {
      console.error('[MasterSites] Error opening site:', error);
      Alert.alert('Error', 'Failed to open site');
    }
  };

  // Check for master role using the derived master data
  if (!derivedMaster) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Site Management', headerShown: true }} />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Not logged in as master account</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Site Management',
          headerShown: true,
        }} 
      />
      
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>Manage your sites and projects</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Site</Text>
        </TouchableOpacity>
      </View>

      {sitesQuery.isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading sites...</Text>
        </View>
      ) : sitesQuery.error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error loading sites</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'active' && styles.tabActive]}
              onPress={() => setActiveTab('active')}
            >
              <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
                Active Sites
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'archived' && styles.tabActive]}
              onPress={() => setActiveTab('archived')}
            >
              <Text style={[styles.tabText, activeTab === 'archived' && styles.tabTextActive]}>
                Archived Sites
              </Text>
            </TouchableOpacity>
          </View>

        <ScrollView style={styles.scrollView}>
          {(() => {
            const filteredSites = sitesQuery.data?.filter(site => {
              const isArchived = site.status === 'Archived' || site.status === 'Deleted';
              return activeTab === 'active' ? !isArchived : isArchived;
            }) || [];

            if (filteredSites.length === 0) {
              return (
                <View style={styles.centerContainer}>
                  <Building2 size={64} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>
                    {activeTab === 'active' ? 'No Active Sites' : 'No Archived Sites'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {activeTab === 'active' 
                      ? 'Create your first site to get started' 
                      : 'Archived sites will appear here'}
                  </Text>
                  {activeTab === 'active' && (
                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={() => setShowAddModal(true)}
                    >
                      <Plus size={20} color="#fff" />
                      <Text style={styles.emptyButtonText}>Create First Site</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }

            return filteredSites.map((site) => {
            const isExpanded = expandedSiteId === site.id;
            return (
              <View key={site.id} style={styles.siteCard}>
                <TouchableOpacity
                  style={styles.siteHeader}
                  onPress={() => setExpandedSiteId(isExpanded ? null : site.id)}
                >
                  <View style={styles.siteHeaderContent}>
                    <Building2 size={24} color="#3b82f6" />
                    <View style={styles.siteHeaderText}>
                      <Text style={styles.siteName}>{site.name}</Text>
                      <View style={styles.siteMetaRow}>
                        {site.location ? (
                          <View style={styles.siteMetaItem}>
                            <MapPin size={14} color="#64748b" />
                            <Text style={styles.siteMetaText}>{site.location}</Text>
                          </View>
                        ) : null}
                        <View style={[
                          styles.statusBadge,
                          site.status === 'Active' ? styles.statusActive :
                          site.status === 'Inactive' ? styles.statusInactive :
                          styles.statusArchived
                        ]}>
                          <Text style={styles.statusText}>{site.status || 'Active'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={24} color="#64748b" />
                  ) : (
                    <ChevronDown size={24} color="#64748b" />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.siteDetails}>
                    {site.description ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Description:</Text>
                        <Text style={styles.detailValue}>{site.description}</Text>
                      </View>
                    ) : null}
                    
                    <View style={styles.siteActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleOpenSite(site)}
                      >
                        <ExternalLink size={18} color="#3b82f6" />
                        <Text style={styles.actionButtonText}>Open Site</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditSite(site)}
                      >
                        <Edit size={18} color="#059669" />
                        <Text style={[styles.actionButtonText, { color: '#059669' }]}>Edit</Text>
                      </TouchableOpacity>
                      
                      {site.status !== 'Archived' && site.status !== 'Deleted' ? (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleArchiveSite(site)}
                        >
                          <Archive size={18} color="#f59e0b" />
                          <Text style={[styles.actionButtonText, { color: '#f59e0b' }]}>Archive</Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleRecoverSite(site)}
                            disabled={unarchiveSiteMutation.isPending}
                          >
                            <RefreshCw size={18} color="#059669" />
                            <Text style={[styles.actionButtonText, { color: '#059669' }]}>Recover</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDeleteSite(site)}
                            disabled={deleteSiteMutation.isPending}
                          >
                            <Trash2 size={18} color="#dc2626" />
                            <Text style={[styles.actionButtonText, { color: '#dc2626' }]}>Delete</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          });
          })()}
        </ScrollView>
        </View>
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Site</Text>
            
            {derivedMaster?.currentCompanyId && companyQuery.data && (
              <View style={styles.companyInfoBanner}>
                <Building2 size={16} color="#3b82f6" />
                <Text style={styles.companyInfoText}>
                  This site will be created for: <Text style={styles.companyInfoName}>{companyQuery.data.name}</Text>
                </Text>
              </View>
            )}
            
            <View style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Site Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter site name"
                  value={newSiteName}
                  onChangeText={setNewSiteName}
                  editable={!createSiteMutation.isPending}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Location</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter location (optional)"
                  value={newSiteLocation}
                  onChangeText={setNewSiteLocation}
                  editable={!createSiteMutation.isPending}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter description (optional)"
                  value={newSiteDescription}
                  onChangeText={setNewSiteDescription}
                  multiline
                  numberOfLines={3}
                  editable={!createSiteMutation.isPending}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowAddModal(false);
                  setNewSiteName('');
                  setNewSiteDescription('');
                  setNewSiteLocation('');
                }}
                disabled={createSiteMutation.isPending}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleAddSite}
                disabled={createSiteMutation.isPending}
              >
                {createSiteMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Create Site</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Site</Text>
            
            <View style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Site Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter site name"
                  value={newSiteName}
                  onChangeText={setNewSiteName}
                  editable={!updateSiteMutation.isPending}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Location</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter location (optional)"
                  value={newSiteLocation}
                  onChangeText={setNewSiteLocation}
                  editable={!updateSiteMutation.isPending}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter description (optional)"
                  value={newSiteDescription}
                  onChangeText={setNewSiteDescription}
                  multiline
                  numberOfLines={3}
                  editable={!updateSiteMutation.isPending}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingSite(null);
                  setNewSiteName('');
                  setNewSiteDescription('');
                  setNewSiteLocation('');
                }}
                disabled={updateSiteMutation.isPending}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleUpdateSite}
                disabled={updateSiteMutation.isPending}
              >
                {updateSiteMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Update Site</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showArchiveModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowArchiveModal(false);
          setArchivingSite(null);
          setConfirmText('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.warningHeader}>
              <Archive size={32} color="#f59e0b" />
              <Text style={styles.warningTitle}>Archive Site</Text>
            </View>
            
            <View style={styles.warningContent}>
              <Text style={styles.warningText}>
                You are about to archive <Text style={styles.warningBold}>&quot;{archivingSite?.name}&quot;</Text>
              </Text>
              <Text style={styles.warningSubtext}>
                This will mark the site as archived and it will no longer be active.
              </Text>
              <Text style={styles.warningSubtext}>
                To confirm, please type the exact site name below:
              </Text>
              
              <View style={styles.confirmInputContainer}>
                <Text style={styles.confirmLabel}>Type: {normalizedSiteName}</Text>
                <TextInput
                  style={styles.confirmInput}
                  placeholder={normalizedSiteName}
                  value={confirmText}
                  onChangeText={(text) => {
                    console.log('[Archive Input] Text changed:', text);
                    setConfirmText(text);
                  }}
                  editable={!archiveSiteMutation.isPending}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowArchiveModal(false);
                  setArchivingSite(null);
                  setConfirmText('');
                }}
                disabled={archiveSiteMutation.isPending}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonWarning, 
                  !isArchiveConfirmValid && styles.modalButtonDisabled]}
                onPress={handleConfirmArchive}
                disabled={archiveSiteMutation.isPending || !isArchiveConfirmValid}
              >
                {archiveSiteMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonWarningText}>Archive Site</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.warningHeader}>
              <Trash2 size={32} color="#dc2626" />
              <Text style={styles.warningTitle}>Permanently Delete Site</Text>
            </View>
            
            <View style={styles.warningContent}>
              <Text style={styles.warningText}>
                You are about to permanently delete <Text style={styles.deleteBold}>&quot;{deletingSite?.name}&quot;</Text>
              </Text>
              <Text style={styles.warningSubtext}>
                This action cannot be undone. All data associated with this site will be permanently deleted.
              </Text>
              <Text style={styles.warningSubtext}>
                To confirm, please type the exact site name below:
              </Text>
              
              <View style={styles.confirmInputContainer}>
                <Text style={styles.confirmLabelDelete}>Type: {normalizedDeleteSiteName}</Text>
                <TextInput
                  style={styles.confirmInputDelete}
                  placeholder={normalizedDeleteSiteName}
                  value={confirmText}
                  onChangeText={(text) => {
                    console.log('[Delete Input] Text changed:', text);
                    setConfirmText(text);
                  }}
                  editable={!deleteSiteMutation.isPending}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeletingSite(null);
                  setConfirmText('');
                }}
                disabled={deleteSiteMutation.isPending}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger, 
                  !isDeleteConfirmValid && styles.modalButtonDisabled]}
                onPress={handleConfirmDelete}
                disabled={deleteSiteMutation.isPending || !isDeleteConfirmValid}
              >
                {deleteSiteMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonDangerText}>Delete Permanently</Text>
                )}
              </TouchableOpacity>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#5f6368',
    fontWeight: '400' as const,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  masterName: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#202124',
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    fontSize: 14,
    color: '#5f6368',
    fontWeight: '400' as const,
    letterSpacing: 0.1,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#5f6368',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  siteCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  siteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  siteHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  siteHeaderText: {
    flex: 1,
  },
  siteName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  siteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  siteMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  siteMetaText: {
    fontSize: 13,
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusInactive: {
    backgroundColor: '#fef3c7',
  },
  statusArchived: {
    backgroundColor: '#e2e8f0',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  siteDetails: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  siteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 20,
  },
  modalForm: {
    gap: 16,
    marginBottom: 24,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1e293b',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#4285F4',
  },
  modalButtonSecondary: {
    backgroundColor: '#f1f5f9',
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  modalButtonSecondaryText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  warningContent: {
    gap: 12,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 22,
  },
  warningBold: {
    fontWeight: '700' as const,
    color: '#f59e0b',
  },
  warningSubtext: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  confirmInputContainer: {
    marginTop: 8,
    gap: 8,
  },
  confirmLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1e293b',
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  confirmInput: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1e293b',
  },
  modalButtonWarning: {
    backgroundColor: '#f59e0b',
  },
  modalButtonWarningText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },

  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4285F4',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  tabTextActive: {
    color: '#4285F4',
    fontWeight: '600' as const,
  },
  deleteBold: {
    fontWeight: '700' as const,
    color: '#dc2626',
  },
  confirmLabelDelete: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1e293b',
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  confirmInputDelete: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1e293b',
  },
  modalButtonDanger: {
    backgroundColor: '#dc2626',
  },
  modalButtonDangerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  companyInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  companyInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
  },
  companyInfoName: {
    fontWeight: '700' as const,
    color: '#1e40af',
  },
  companyWarningBanner: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  companyWarningText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
});
