import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { ArrowLeft, Save, Package, MapPin, Briefcase, FileDigit, CreditCard, Users, Building2, Calendar, ImageIcon, FileText, X, ChevronDown, ChevronUp, Paperclip, DollarSign, Filter } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, serverTimestamp, Timestamp, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { queueFirestoreOperation } from '@/utils/offlineQueue';
import { db } from '@/config/firebase';
import { generateChecklistFromTemplate } from '@/constants/assetChecklistTemplate';
import { Attachment, ChecklistItem, Subcontractor } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { AssetChecklistCard } from '@/components/AssetChecklistCard';
import { getSubcontractorsByMasterAccount } from '@/utils/subcontractorManager';
import { Colors } from '@/constants/colors';

import { useEffect } from 'react';

export default function AddAssetScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [type, setType] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [plantTypes, setPlantTypes] = useState<Array<{ id: string; name: string; groupId: string; groupName: string }>>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [plantGroups, setPlantGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [location, setLocation] = useState(''); // This will be auto-generated
  const [assignedJob, setAssignedJob] = useState('');
  const [plantNumber, setPlantNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [ownerType, setOwnerType] = useState<'company' | 'subcontractor'>('company');
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [currentOperator, setCurrentOperator] = useState('');
  const [currentOperatorId, setCurrentOperatorId] = useState('');
  const [selectedOperatorData, setSelectedOperatorData] = useState<{ id: string; name: string; contact: string; } | null>(null);
  const [onboardingDate, setOnboardingDate] = useState<Date | undefined>(undefined);
  const [offHireDate, setOffHireDate] = useState<Date | undefined>(undefined);
  const [inductionStatus, setInductionStatus] = useState(false);
  const [inductionNotes, setInductionNotes] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(generateChecklistFromTemplate());
  const [showOffHirePicker, setShowOffHirePicker] = useState(false);
  
  // Dropdown data
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [operators, setOperators] = useState<{ id: string; name: string; contact: string; }[]>([]);
  const [showOperatorDropdown, setShowOperatorDropdown] = useState(false);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingOwnerOptions, setIsLoadingOwnerOptions] = useState(false);
  const [isCrossHire, setIsCrossHire] = useState(false);
  const [crossHireName, setCrossHireName] = useState('');
  
  const [isBasicInfoExpanded, setIsBasicInfoExpanded] = useState(false);
  const [isAdditionalInfoExpanded, setIsAdditionalInfoExpanded] = useState(false);
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
  const [isChecklistExpanded, setIsChecklistExpanded] = useState(false);
  const [isOnboardingExpanded, setIsOnboardingExpanded] = useState(false);
  const [isPlantRatesExpanded, setIsPlantRatesExpanded] = useState(false);

  const [dryRate, setDryRate] = useState('');
  const [wetRate, setWetRate] = useState('');
  const [dailyRate, setDailyRate] = useState('');

  // Load subcontractors, operators, plant types, and generate next Site ID on mount
  useEffect(() => {
    loadDropdownData();
    generateNextSiteId();
    loadOwnerOptions();
    loadPlantTypes();
  }, [user?.masterAccountId, user?.siteId]);

  const loadPlantTypes = async () => {
    if (!user?.masterAccountId) return;
    
    try {
      const groupsQuery = query(
        collection(db, 'plantAssetGroups'),
        where('masterAccountId', '==', user.masterAccountId)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      const groups = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setPlantGroups(groups);

      const typesQuery = query(
        collection(db, 'plantAssetTypes'),
        where('masterAccountId', '==', user.masterAccountId)
      );
      const typesSnapshot = await getDocs(typesQuery);
      const types = typesSnapshot.docs.map(doc => {
        const data = doc.data();
        const group = groups.find(g => g.id === data.groupId);
        return {
          id: doc.id,
          name: data.name,
          groupId: data.groupId,
          groupName: group?.name || 'Unknown'
        };
      });
      
      setPlantTypes(types.sort((a, b) => {
        if (a.groupName === b.groupName) {
          return a.name.localeCompare(b.name);
        }
        return a.groupName.localeCompare(b.groupName);
      }));
    } catch (error) {
      console.error('[AddAsset] Error loading plant types:', error);
    }
  };

  // Generate next available Site ID
  const generateNextSiteId = async () => {
    if (!user?.masterAccountId || !user?.siteId) return;
    
    try {
      // Query all plant assets for this site to find the highest Site ID number
      const assetsRef = collection(db, 'plantAssets');
      const assetsQuery = query(
        assetsRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId),
        orderBy('location', 'desc')
      );
      
      const assetsSnapshot = await getDocs(assetsQuery);
      
      let highestNumber = 0;
      
      // Parse existing Site IDs to find the highest number
      assetsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.location) {
          // Convert location to string and parse as number
          const locationStr = String(data.location);
          const num = parseInt(locationStr, 10);
          if (!isNaN(num) && num > highestNumber) {
            highestNumber = num;
          }
        }
      });
      
      // Generate the next Site ID as a simple number
      const nextSiteId = String(highestNumber + 1);
      
      console.log('[AddAsset] Generated next Site ID for site', user.siteId, ':', nextSiteId);
      setLocation(nextSiteId);
    } catch (error) {
      console.error('[AddAsset] Error generating Site ID:', error);
      // Fallback to 1 if query fails
      setLocation('1');
    }
  };

  const loadOwnerOptions = async () => {
    if (!user?.masterAccountId || !user?.siteId) return;
    
    setIsLoadingOwnerOptions(true);
    try {
      const activeSubcontractors = await getSubcontractorsByMasterAccount(user.masterAccountId, 'Active', user.siteId);
      setSubcontractors(activeSubcontractors);
      
      if (user?.companyName && !ownerName) {
        setOwnerName(user.companyName);
        setOwnerType('company');
        setOwnerId(user.currentCompanyId || '');
      }
    } catch (error) {
      console.error('[AddAsset] Error loading owner options:', error);
    } finally {
      setIsLoadingOwnerOptions(false);
    }
  };

  const loadDropdownData = async () => {
    if (!user?.masterAccountId || !user?.siteId) return;
    
    setIsLoadingData(true);
    try {
      // Load operators from employees collection for this site only
      const employeesRef = collection(db, 'employees');
      const employeesQuery = query(
        employeesRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId),
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
      
      console.log('[AddAsset] Loaded operators for site', user.siteId, ':', operatorsList.length);
      setOperators(operatorsList);
    } catch (error) {
      console.error('[AddAsset] Error loading dropdown data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const filteredOperators = operators.filter((op) =>
    op.name.toLowerCase().includes(operatorSearch.toLowerCase()) ||
    op.contact.toLowerCase().includes(operatorSearch.toLowerCase())
  );

  const handleImagePick = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please grant permission to access photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const file = result.assets[0];
      if (file.base64) {
        const newAttachment: Attachment = {
          id: Date.now().toString(),
          fileName: file.uri.split('/').pop() || 'image.jpg',
          fileType: 'image',
          mimeType: 'image/jpeg',
          downloadUrl: `data:image/jpeg;base64,${file.base64}`,
          storagePath: '',
          uploadedAt: new Date().toISOString(),
          uploadedBy: user?.userId || '',
          size: file.base64.length,
        };

        setAttachments([...attachments, newAttachment]);
      }
    }
  };

  const handleDocumentPick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
      copyToCacheDirectory: true,
    });

    if (result.assets && result.assets[0]) {
      const file = result.assets[0];
      
      if (file.size && file.size > 5 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please select a document under 5MB');
        return;
      }

      const newAttachment: Attachment = {
        id: Date.now().toString(),
        fileName: file.name,
        fileType: 'document',
        mimeType: file.mimeType || 'application/octet-stream',
        downloadUrl: file.uri,
        storagePath: '',
        uploadedAt: new Date().toISOString(),
        uploadedBy: user?.userId || '',
        size: file.size,
      };

      setAttachments([...attachments, newAttachment]);
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    console.log('[AddAsset] Removing attachment:', attachmentId);
    Alert.alert(
      'Remove Attachment',
      'Are you sure you want to remove this attachment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            console.log('[AddAsset] Confirmed removal, filtering attachments');
            setAttachments(prevAttachments => {
              const filtered = prevAttachments.filter((a) => a.id !== attachmentId);
              console.log('[AddAsset] Attachments after removal:', filtered.length);
              return filtered;
            });
          },
        },
      ]
    );
  };

  const handleOpenAttachment = async (attachment: Attachment) => {
    console.log('[AddAsset] Opening attachment:', attachment.fileName);
    try {
      if (attachment.fileType === 'image') {
        if (attachment.downloadUrl.startsWith('data:')) {
          Alert.alert('View Image', 'Image is displayed in the preview');
        } else {
          const canOpen = await Linking.canOpenURL(attachment.downloadUrl);
          if (canOpen) {
            await Linking.openURL(attachment.downloadUrl);
          } else {
            Alert.alert('Error', 'Cannot open this image');
          }
        }
      } else {
        const canOpen = await Linking.canOpenURL(attachment.downloadUrl);
        if (canOpen) {
          await Linking.openURL(attachment.downloadUrl);
        } else {
          Alert.alert('Error', 'Cannot open this document. The file may not be accessible.');
        }
      }
    } catch (error) {
      console.error('[AddAsset] Error opening attachment:', error);
      Alert.alert('Error', 'Failed to open attachment');
    }
  };

  const handleToggleChecklistItem = (itemId: string) => {
    if (!user) return;

    setChecklist((prevChecklist) =>
      prevChecklist.map((item) => {
        if (item.id === itemId) {
          const newCompleted = !item.completed;
          return {
            ...item,
            completed: newCompleted,
            completedAt: newCompleted ? new Date() : undefined,
            completedBy: newCompleted ? user.userId : undefined,
          };
        }
        return item;
      })
    );
  };

  const handleAddChecklistItem = (label: string) => {
    const maxOrder = checklist.length > 0 ? Math.max(...checklist.map((item) => item.order)) : 0;
    const newItem: ChecklistItem = {
      id: `custom-${Date.now()}`,
      label,
      completed: false,
      order: maxOrder + 1,
    };
    setChecklist([...checklist, newItem]);
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    setChecklist((prevChecklist) => prevChecklist.filter((item) => item.id !== itemId));
  };

  const handleOffHireDateSubmit = () => {
    if (!offHireDate) return;

    Alert.alert(
      'Set Off-Hire Date',
      `Set off-hire date as ${offHireDate.toLocaleDateString()}? This will be used for final billing calculations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: () => {
            setShowOffHirePicker(false);
            Alert.alert('Success', 'Off-hire date has been set. It will be saved with the asset.');
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (isSaving) {
      console.log('[AddAsset] Save already in progress, ignoring tap');
      return;
    }

    if (!user?.siteId || !user?.masterAccountId) {
      Alert.alert('Error', 'Missing site or account information');
      return;
    }

    if (!type.trim()) {
      Alert.alert('Validation Error', 'Please enter asset type');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Validation Error', 'Please enter site ID');
      return;
    }

    setIsSaving(true);
    console.log('[AddAsset] Starting save operation');

    try {
      const assetData: any = {
        assetId: assetId.trim() || `asset-${Date.now()}`,
        type: type.trim(),
        location: location.trim(),
        assignedJob: assignedJob.trim() || null,
        plantNumber: plantNumber.trim() || null,
        registrationNumber: registrationNumber.trim() || null,
        ownerName: ownerName.trim() || null,
        ownerId: ownerId || null,
        ownerType,
        isCrossHire,
        crossHireName: isCrossHire ? crossHireName.trim() : null,
        currentOperator: currentOperator.trim() || null,
        currentOperatorId: currentOperatorId || null,
        siteId: user.siteId,
        masterAccountId: user.masterAccountId,
        companyId: user.currentCompanyId || null,
        allocationStatus: 'UNALLOCATED',
        inductionStatus,
        inductionNotes: inductionNotes.trim(),
        attachments,
        checklist,
        dryRate: dryRate ? parseFloat(dryRate) : null,
        wetRate: wetRate ? parseFloat(wetRate) : null,
        dailyRate: dailyRate ? parseFloat(dailyRate) : null,
        ratesSetAt: (dryRate || wetRate || dailyRate) ? Date.now() : null,
        ratesSetBy: (dryRate || wetRate || dailyRate) ? user.userId : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        archived: false,
      };

      // Initialize operator history if an operator is assigned
      if (currentOperatorId && selectedOperatorData) {
        assetData.operatorHistory = [{
          operatorId: currentOperatorId,
          operatorName: selectedOperatorData.name,
          operatorContact: selectedOperatorData.contact,
          assignedAt: Date.now(),
          assignedBy: user.userId,
        }];
      }

      if (onboardingDate) {
        assetData.onboardingDate = Timestamp.fromDate(onboardingDate);
      }

      if (offHireDate) {
        assetData.offHireDate = Timestamp.fromDate(offHireDate);
        assetData.offHireTimestamp = Date.now();
        assetData.offHireSubmittedBy = user.userId;
      }

      if (inductionStatus) {
        assetData.inductionDate = Date.now();
      }

      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected;

      console.log('[AddAsset] Network status:', isOnline ? 'Online' : 'Offline');

      if (isOnline) {
        const assetsRef = collection(db, 'plantAssets');
        const docRef = await addDoc(assetsRef, assetData);
        console.log('[AddAsset] Asset saved to Firebase with ID:', docRef.id);
      } else {
        await queueFirestoreOperation(
          {
            type: 'add',
            collection: 'plantAssets',
            data: assetData,
          },
          {
            priority: 'P1',
            entityType: 'other',
          }
        );
        console.log('[AddAsset] Asset queued for offline sync');
      }

      const statusMessage = isOnline 
        ? 'Plant asset added successfully'
        : 'Asset saved offline. Will sync when connection is restored.';

      Alert.alert('Success', statusMessage);
      console.log('[AddAsset] Navigating back to dashboard');

      router.back();
    } catch (error) {
      console.error('[AddAsset] Error adding asset:', error);
      Alert.alert('Error', 'Failed to add plant asset');
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={isSaving}
        >
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Plant Asset</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Save size={24} color="#3b82f6" />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.expandableCard}
            onPress={() => setIsBasicInfoExpanded(!isBasicInfoExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.expandableHeader}>
              <Text style={styles.expandableTitle}>Basic Information *</Text>
              {isBasicInfoExpanded ? (
                <ChevronUp size={24} color="#64748b" />
              ) : (
                <ChevronDown size={24} color="#64748b" />
              )}
            </View>
          </TouchableOpacity>

          {isBasicInfoExpanded && (
            <View style={styles.expandableContent}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Package size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>TYPE *</Text>
                </View>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => {
                    setShowTypeDropdown(!showTypeDropdown);
                    setShowOwnerDropdown(false);
                    setShowOperatorDropdown(false);
                  }}
                  disabled={isSaving}
                >
                  <Text style={type ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {type || 'Select plant type'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
                </TouchableOpacity>
                {showTypeDropdown && (
                  <View style={styles.dropdownContainer}>
                    {plantGroups.length > 0 && (
                      <View style={styles.filterRow}>
                        <TouchableOpacity
                          style={[
                            styles.filterPill,
                            selectedGroupFilter === 'all' && styles.filterPillActive
                          ]}
                          onPress={() => setSelectedGroupFilter('all')}
                        >
                          <Text style={[
                            styles.filterPillText,
                            selectedGroupFilter === 'all' && styles.filterPillTextActive
                          ]}>All</Text>
                        </TouchableOpacity>
                        {plantGroups.map((group) => (
                          <TouchableOpacity
                            key={group.id}
                            style={[
                              styles.filterPill,
                              selectedGroupFilter === group.id && styles.filterPillActive
                            ]}
                            onPress={() => setSelectedGroupFilter(group.id)}
                          >
                            <Text style={[
                              styles.filterPillText,
                              selectedGroupFilter === group.id && styles.filterPillTextActive
                            ]}>{group.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <ScrollView style={styles.dropdownList} keyboardShouldPersistTaps="handled">
                      {plantTypes.length === 0 ? (
                        <View style={styles.dropdownEmpty}>
                          <Text style={styles.dropdownEmptyText}>No plant types defined</Text>
                          <Text style={[styles.dropdownEmptyText, { fontSize: 13, marginTop: 4 }]}>Add types in Plant Asset Types settings</Text>
                        </View>
                      ) : (
                        (() => {
                          const filteredTypes = selectedGroupFilter === 'all' 
                            ? plantTypes 
                            : plantTypes.filter(t => t.groupId === selectedGroupFilter);
                          
                          if (filteredTypes.length === 0) {
                            return (
                              <View style={styles.dropdownEmpty}>
                                <Text style={styles.dropdownEmptyText}>No types in this group</Text>
                              </View>
                            );
                          }

                          let currentGroup = '';
                          return filteredTypes.map((plantType) => {
                            const showGroupHeader = selectedGroupFilter === 'all' && plantType.groupName !== currentGroup;
                            if (showGroupHeader) {
                              currentGroup = plantType.groupName;
                            }

                            return (
                              <View key={plantType.id}>
                                {showGroupHeader && (
                                  <View style={styles.groupHeaderInDropdown}>
                                    <Text style={styles.groupHeaderText}>{plantType.groupName}</Text>
                                  </View>
                                )}
                                <TouchableOpacity
                                  style={styles.dropdownItem}
                                  onPress={() => {
                                    setType(plantType.name);
                                    setShowTypeDropdown(false);
                                  }}
                                >
                                  <Text style={type === plantType.name ? styles.dropdownItemTextSelected : styles.dropdownItemText}>
                                    {plantType.name}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            );
                          });
                        })()
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <MapPin size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>SITE ID * (Auto-generated)</Text>
                </View>
                <View style={[styles.input, styles.readOnlyInput]}>
                  <Text style={styles.readOnlyText}>
                    {location || 'Generating...'}
                  </Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <FileDigit size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>PLANT NR</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter plant number"
                  value={plantNumber}
                  onChangeText={setPlantNumber}
                  editable={!isSaving}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <CreditCard size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>REGISTRATION NR</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter registration number"
                  value={registrationNumber}
                  onChangeText={setRegistrationNumber}
                  editable={!isSaving}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Building2 size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Sub Contractor</Text>
                </View>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => {
                    setShowOwnerDropdown(!showOwnerDropdown);
                    setShowOperatorDropdown(false);
                  }}
                  disabled={isSaving}
                >
                  <Text style={ownerName ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {ownerName || 'Select sub contractor'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
                </TouchableOpacity>
                {showOwnerDropdown && (
                  <View style={styles.dropdownContainer}>
                    <ScrollView style={styles.dropdownList} keyboardShouldPersistTaps="handled">
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          if (user?.companyName) {
                            setOwnerName(user.companyName);
                            setOwnerType('company');
                            setOwnerId(user.currentCompanyId || '');
                            setShowOwnerDropdown(false);
                          }
                        }}
                      >
                        <View>
                          <Text style={ownerName === user?.companyName ? styles.dropdownItemTextSelected : styles.dropdownItemText}>
                            {user?.companyName || 'Your Company'}
                          </Text>
                          <Text style={styles.dropdownItemSubtext}>In-House</Text>
                        </View>
                      </TouchableOpacity>
                      {subcontractors.length > 0 && (
                        <View style={styles.dividerLine} />
                      )}
                      {subcontractors.map((subcontractor) => (
                        <TouchableOpacity
                          key={subcontractor.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setOwnerName(subcontractor.name);
                            setOwnerType('subcontractor');
                            setOwnerId(subcontractor.id || '');
                            setShowOwnerDropdown(false);
                          }}
                        >
                          <View>
                            <Text style={ownerName === subcontractor.name ? styles.dropdownItemTextSelected : styles.dropdownItemText}>
                              {subcontractor.name}
                            </Text>
                            <Text style={styles.dropdownItemSubtext}>Subcontractor</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                      {isLoadingOwnerOptions && (
                        <View style={styles.dropdownItem}>
                          <ActivityIndicator size="small" color="#3b82f6" />
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchLabelText}>Cross-Hire</Text>
                  <Text style={styles.switchLabelHint}>
                    Asset hired from another company
                  </Text>
                </View>
                <Switch
                  value={isCrossHire}
                  onValueChange={setIsCrossHire}
                  trackColor={{ false: '#e2e8f0', true: '#10b981' }}
                  thumbColor={isCrossHire ? '#fff' : '#f4f3f4'}
                  ios_backgroundColor="#e2e8f0"
                  disabled={isSaving}
                />
              </View>

              {isCrossHire && (
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabel}>
                    <Building2 size={18} color="#64748b" />
                    <Text style={styles.inputLabelText}>Cross-Hire From</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter company name (true owner)"
                    value={crossHireName}
                    onChangeText={setCrossHireName}
                    editable={!isSaving}
                  />
                  <Text style={styles.fieldHint}>
                    Specify the company that owns this asset
                  </Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.expandableCard}
            onPress={() => setIsAdditionalInfoExpanded(!isAdditionalInfoExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.expandableHeader}>
              <Text style={styles.expandableTitle}>Additional Details</Text>
              {isAdditionalInfoExpanded ? (
                <ChevronUp size={24} color="#64748b" />
              ) : (
                <ChevronDown size={24} color="#64748b" />
              )}
            </View>
          </TouchableOpacity>

          {isAdditionalInfoExpanded && (
            <View style={styles.expandableContent}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Users size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Current Operator</Text>
                </View>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => {
                    setShowOperatorDropdown(!showOperatorDropdown);
                    setShowOperatorDropdown(false);
                    setOperatorSearch('');
                  }}
                  disabled={isSaving}
                >
                  <Text style={currentOperator ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {currentOperator || 'Select operator'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
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
                      {/* Option to clear selection */}
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setCurrentOperator('');
                          setCurrentOperatorId('');
                          setSelectedOperatorData(null);
                          setShowOperatorDropdown(false);
                          setOperatorSearch('');
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: '#64748b' }]}>
                          Clear selection
                        </Text>
                      </TouchableOpacity>
                      {/* Existing operators */}
                      {filteredOperators.map((op) => (
                        <TouchableOpacity
                          key={op.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setCurrentOperator(`${op.name} (${op.contact})`);
                            setCurrentOperatorId(op.id);
                            setSelectedOperatorData(op);
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
                      {filteredOperators.length === 0 && (
                        <View style={styles.dropdownEmpty}>
                          <Text style={styles.dropdownEmptyText}>
                            {operators.length === 0 
                              ? 'No operators available' 
                              : 'No operators matching search'}
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Briefcase size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Assigned Job (Optional)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter assigned job"
                  value={assignedJob}
                  onChangeText={setAssignedJob}
                  editable={!isSaving}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.expandableCard}
            onPress={() => setIsDocumentsExpanded(!isDocumentsExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.expandableHeader}>
              <View style={styles.expandableTitleWithBadge}>
                <Text style={styles.expandableTitle}>Documents & Images</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{attachments.length}</Text>
                </View>
              </View>
              {isDocumentsExpanded ? (
                <ChevronUp size={24} color="#64748b" />
              ) : (
                <ChevronDown size={24} color="#64748b" />
              )}
            </View>
          </TouchableOpacity>

          {isDocumentsExpanded && (
            <View style={styles.expandableContent}>
              <View style={styles.attachmentButtons}>
                <TouchableOpacity
                  style={styles.attachmentButton}
                  onPress={handleImagePick}
                  disabled={isSaving}
                >
                  <ImageIcon size={18} color="#3b82f6" />
                  <Text style={styles.attachmentButtonText}>Add Image</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachmentButton}
                  onPress={handleDocumentPick}
                  disabled={isSaving}
                >
                  <FileText size={18} color="#3b82f6" />
                  <Text style={styles.attachmentButtonText}>Add Document</Text>
                </TouchableOpacity>
              </View>

              {attachments.length === 0 ? (
                <View style={styles.emptyAttachments}>
                  <Paperclip size={32} color="#cbd5e1" />
                  <Text style={styles.emptyAttachmentsText}>No attachments yet</Text>
                </View>
              ) : (
                <View style={styles.attachmentsList}>
                  {attachments.map((attachment) => (
                    <View key={attachment.id} style={styles.attachmentItem}>
                      <TouchableOpacity
                        onPress={() => handleOpenAttachment(attachment)}
                        disabled={isSaving}
                        style={styles.attachmentPreview}
                      >
                        {attachment.fileType === 'image' ? (
                          <Image
                            source={{ uri: attachment.downloadUrl }}
                            style={styles.attachmentImage}
                          />
                        ) : (
                          <View style={styles.attachmentDocument}>
                            <FileText size={32} color="#64748b" />
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleOpenAttachment(attachment)}
                        disabled={isSaving}
                        style={styles.attachmentInfo}
                      >
                        <Text style={styles.attachmentFileName} numberOfLines={1}>
                          {attachment.fileName}
                        </Text>
                        <Text style={styles.attachmentMeta}>
                          {attachment.fileType === 'image' ? 'Image' : 'Document'} • Tap to view
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveAttachment(attachment.id)}
                        disabled={isSaving}
                        style={styles.removeButton}
                      >
                        <X size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.expandableCard}
            onPress={() => setIsChecklistExpanded(!isChecklistExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.expandableHeader}>
              <View style={styles.expandableTitleWithBadge}>
                <Text style={styles.expandableTitle}>Onboarding Checklist</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {checklist.filter((item) => item.completed).length}/{checklist.length}
                  </Text>
                </View>
              </View>
              {isChecklistExpanded ? (
                <ChevronUp size={24} color="#64748b" />
              ) : (
                <ChevronDown size={24} color="#64748b" />
              )}
            </View>
          </TouchableOpacity>

          {isChecklistExpanded && (
            <View style={styles.expandableContent}>
              <AssetChecklistCard
                checklist={checklist}
                onToggleItem={handleToggleChecklistItem}
                onAddItem={handleAddChecklistItem}
                onDeleteItem={handleDeleteChecklistItem}
                disabled={isSaving}
                userName={user?.name}
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.expandableCard}
            onPress={() => setIsOnboardingExpanded(!isOnboardingExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.expandableHeader}>
              <Text style={styles.expandableTitle}>Onboarding and Demobilize</Text>
              {isOnboardingExpanded ? (
                <ChevronUp size={24} color="#64748b" />
              ) : (
                <ChevronDown size={24} color="#64748b" />
              )}
            </View>
          </TouchableOpacity>

          {isOnboardingExpanded && (
            <View style={styles.expandableContent}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Calendar size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Onboarding Date</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setOnboardingDate(new Date())}
                  disabled={isSaving}
                >
                  <Text style={onboardingDate ? styles.dateText : styles.dateTextPlaceholder}>
                    {onboardingDate ? onboardingDate.toLocaleDateString() : 'Set onboarding date'}
                  </Text>
                </TouchableOpacity>
                {onboardingDate && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setOnboardingDate(undefined)}
                    disabled={isSaving}
                  >
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchLabelText}>Mark as Onboarded</Text>
                  <Text style={styles.switchLabelHint}>
                    Toggle if onboarding is already complete
                  </Text>
                </View>
                <Switch
                  value={inductionStatus}
                  onValueChange={setInductionStatus}
                  trackColor={{ false: '#e2e8f0', true: '#10b981' }}
                  thumbColor={inductionStatus ? '#fff' : '#f4f3f4'}
                  ios_backgroundColor="#e2e8f0"
                  disabled={isSaving}
                />
              </View>

              <View style={styles.notesSection}>
                <Text style={styles.inputLabelText}>Onboarding Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add notes about the onboarding..."
                  value={inductionNotes}
                  onChangeText={setInductionNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!isSaving}
                />
              </View>

              {showOffHirePicker && (
                <View style={styles.offHireDatePickerSection}>
                  <Text style={styles.offHireDatePickerTitle}>Select Off-Hire Date</Text>
                  <Text style={styles.offHireDatePickerDescription}>
                    This date will be logged for final billing calculations and reporting
                  </Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setOffHireDate(new Date())}
                    disabled={isSaving}
                  >
                    <Text style={offHireDate ? styles.dateText : styles.dateTextPlaceholder}>
                      {offHireDate ? offHireDate.toLocaleDateString() : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.offHireDateActions}>
                    <TouchableOpacity
                      style={styles.offHireCancelButton}
                      onPress={() => {
                        setShowOffHirePicker(false);
                        setOffHireDate(undefined);
                      }}
                      disabled={isSaving}
                    >
                      <Text style={styles.offHireCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.offHireSubmitButton,
                        !offHireDate && styles.offHireSubmitButtonDisabled,
                      ]}
                      onPress={handleOffHireDateSubmit}
                      disabled={isSaving || !offHireDate}
                    >
                      <Text style={styles.offHireSubmitButtonText}>Set Date</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!showOffHirePicker && (
                <TouchableOpacity
                  style={styles.offHireButton}
                  onPress={() => setShowOffHirePicker(true)}
                  disabled={isSaving}
                >
                  <Calendar size={20} color="#fff" />
                  <Text style={styles.offHireButtonText}>Set Off-Hire Date</Text>
                </TouchableOpacity>
              )}

              {offHireDate && (
                <View style={styles.offHireDateInfo}>
                  <Text style={styles.offHireDateInfoLabel}>Off-Hire Date Set:</Text>
                  <Text style={styles.offHireDateInfoValue}>
                    {offHireDate.toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.expandableCard}
            onPress={() => setIsPlantRatesExpanded(!isPlantRatesExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.expandableHeader}>
              <Text style={styles.expandableTitle}>Plant Rates *</Text>
              {isPlantRatesExpanded ? (
                <ChevronUp size={24} color="#64748b" />
              ) : (
                <ChevronDown size={24} color="#64748b" />
              )}
            </View>
          </TouchableOpacity>

          {isPlantRatesExpanded && (
            <View style={styles.expandableContent}>
              <View style={styles.ratesInfoCard}>
                <DollarSign size={20} color="#10b981" />
                <View style={styles.ratesInfoContent}>
                  <Text style={styles.ratesInfoTitle}>Plant Hourly Rates</Text>
                  <Text style={styles.ratesInfoText}>
                    Enter either Dry Rate (client supplies fuel) or Wet Rate (includes fuel), plus optional Daily Rate. These rates will be used for billing calculations.
                  </Text>
                </View>
              </View>

              <View style={styles.ratesRequiredNote}>
                <Text style={styles.ratesRequiredText}>* At least one rate (Dry or Wet) is required</Text>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <DollarSign size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Dry Rate (per hour) *</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter dry rate (e.g., 450.00)"
                  value={dryRate}
                  onChangeText={setDryRate}
                  keyboardType="decimal-pad"
                  editable={!isSaving}
                />
                <Text style={styles.fieldHint}>
                  Rate when client supplies fuel for the plant asset
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <DollarSign size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Wet Rate (per hour) *</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter wet rate (e.g., 550.00)"
                  value={wetRate}
                  onChangeText={setWetRate}
                  keyboardType="decimal-pad"
                  editable={!isSaving}
                />
                <Text style={styles.fieldHint}>
                  Rate when fuel is included in the hire cost
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <DollarSign size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Daily Rate (optional)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter daily rate (e.g., 3500.00)"
                  value={dailyRate}
                  onChangeText={setDailyRate}
                  keyboardType="decimal-pad"
                  editable={!isSaving}
                />
                <Text style={styles.fieldHint}>
                  Optional flat daily rate for billing
                </Text>
              </View>
            </View>
          )}

          <View style={styles.noteSection}>
            <Text style={styles.noteText}>* Required fields</Text>
            <Text style={styles.noteText}>
              All sections are optional except Basic Information
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    color: Colors.text,
  },
  saveButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 24,
  },
  formSection: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabelText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  input: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteSection: {
    gap: 8,
    marginTop: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic' as const,
  },
  expandableCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandableTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  expandableTitleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  expandableContent: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
    marginTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    flex: 1,
    gap: 4,
  },
  switchLabelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  switchLabelHint: {
    fontSize: 13,
    color: '#64748b',
  },
  notesSection: {
    gap: 8,
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 100,
  },
  attachmentButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  attachmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  attachmentButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  emptyAttachments: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed' as const,
  },
  emptyAttachmentsText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  attachmentsList: {
    gap: 12,
  },
  attachmentItem: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attachmentImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  attachmentDocument: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentPreview: {
    flexShrink: 0,
  },
  attachmentInfo: {
    flex: 1,
    gap: 4,
  },
  attachmentFileName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1e293b',
  },
  attachmentMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  removeButton: {
    padding: 4,
  },
  dateButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateText: {
    fontSize: 15,
    color: '#1e293b',
  },
  dateTextPlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
  },
  clearDateButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  clearDateText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500' as const,
  },
  offHireButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  offHireButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  offHireDatePickerSection: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 12,
  },
  offHireDatePickerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  offHireDatePickerDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  offHireDateActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  offHireCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  offHireCancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  offHireSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  offHireSubmitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  offHireSubmitButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  offHireDateInfo: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 4,
  },
  offHireDateInfoLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#15803d',
  },
  offHireDateInfoValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#166534',
  },
  dropdownButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  dropdownPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: '#94a3b8',
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    maxHeight: 350,
  },
  filterRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  groupHeaderInDropdown: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  groupHeaderText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748b',
    textTransform: 'uppercase' as const,
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
  dropdownEmpty: {
    padding: 20,
    alignItems: 'center' as const,
  },
  dropdownEmptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  readOnlyInput: {
    backgroundColor: '#f1f5f9',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  readOnlyText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500' as const,
  },
  dropdownItemTextSelected: {
    fontSize: 15,
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  fieldHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  ratesInfoCard: {
    flexDirection: 'row' as const,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 16,
    alignItems: 'flex-start' as const,
    gap: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  ratesInfoContent: {
    flex: 1,
  },
  ratesInfoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#15803d',
    marginBottom: 4,
  },
  ratesInfoText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  ratesRequiredNote: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  ratesRequiredText: {
    fontSize: 12,
    color: '#854d0e',
    fontWeight: '600' as const,
  },
});
