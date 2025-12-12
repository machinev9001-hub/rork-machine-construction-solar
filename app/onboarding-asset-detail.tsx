import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
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
  Linking,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft, Save, CheckCircle, Clock, Package, MapPin, Hash, Paperclip, ImageIcon, FileText, X, ChevronDown, ChevronUp, FileDigit, CreditCard, Users, Building2, Edit, Calendar, QrCode, DollarSign } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset, Attachment, ChecklistItem, Subcontractor, DailyChecklistEntry } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { AssetChecklistCard } from '@/components/AssetChecklistCard';
import { Colors } from '@/constants/colors';

export default function OnboardingAssetDetailScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { assetId } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [asset, setAsset] = useState<PlantAsset | null>(null);
  const [inductionStatus, setInductionStatus] = useState(false);
  const [inductionNotes, setInductionNotes] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [plantNumber, setPlantNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [subcontractor, setSubcontractor] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [showSubcontractorPicker, setShowSubcontractorPicker] = useState(false);
  const [crossHire, setCrossHire] = useState('');
  const [onboardingDate, setOnboardingDate] = useState<Date | undefined>(undefined);
  const [offHireDate, setOffHireDate] = useState<Date | undefined>(undefined);
  const [showOffHirePicker, setShowOffHirePicker] = useState(false);
  const [showInductionDatePicker, setShowInductionDatePicker] = useState(false);
  const [tempInductionDate, setTempInductionDate] = useState(new Date());

  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
  const [isRatesExpanded, setIsRatesExpanded] = useState(true);
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
  const [isChecklistExpanded, setIsChecklistExpanded] = useState(false);
  const [isArchivedChecklistsExpanded, setIsArchivedChecklistsExpanded] = useState(false);
  const [archivedChecklists, setArchivedChecklists] = useState<DailyChecklistEntry[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dryRate, setDryRate] = useState('');
  const [wetRate, setWetRate] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [billingMethod, setBillingMethod] = useState<'PER_HOUR' | 'MINIMUM_BILLING'>('PER_HOUR');

  const loadSubcontractors = useCallback(async () => {
    if (!user?.masterAccountId) return;

    try {
      const q = query(
        collection(db, 'subcontractors'),
        where('masterAccountId', '==', user.masterAccountId),
        where('status', '==', 'Active'),
        orderBy('name')
      );
      const snapshot = await getDocs(q);
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subcontractor));
      setSubcontractors(subs);
    } catch (error) {
      console.error('[AssetDetail] Error loading subcontractors:', error);
    }
  }, [user?.masterAccountId]);

  const loadAsset = useCallback(async () => {
    if (!assetId || typeof assetId !== 'string') return;

    try {
      setIsLoading(true);
      const assetRef = doc(db, 'plantAssets', assetId);
      const assetDoc = await getDoc(assetRef);

      if (assetDoc.exists()) {
        const data = assetDoc.data() as PlantAsset;
        setAsset({ id: assetDoc.id, ...data });
        setInductionStatus(data.inductionStatus || false);
        setInductionNotes(data.inductionNotes || '');
        setAttachments(data.attachments || []);
        setChecklist(data.checklist || []);
        setType(data.type || '');
        setLocation(data.location || '');
        setPlantNumber(data.plantNumber || '');
        setRegistrationNumber(data.registrationNumber || '');
        setSubcontractor(data.subcontractor || '');
        setSubcontractorId(data.ownerId || '');
        setCrossHire(data.crossHire || '');
        setOnboardingDate(data.onboardingDate
          ? (typeof data.onboardingDate === 'object' && 'toDate' in data.onboardingDate
            ? data.onboardingDate.toDate()
            : new Date(data.onboardingDate))
          : undefined);
        setOffHireDate(data.offHireDate
          ? (typeof data.offHireDate === 'object' && 'toDate' in data.offHireDate
            ? data.offHireDate.toDate()
            : new Date(data.offHireDate))
          : undefined);
        setDryRate(data.dryRate !== undefined && data.dryRate !== null ? String(data.dryRate) : '');
        setWetRate(data.wetRate !== undefined && data.wetRate !== null ? String(data.wetRate) : '');
        setDailyRate(data.dailyRate !== undefined && data.dailyRate !== null ? String(data.dailyRate) : '');
        setBillingMethod(data.billingMethod || 'PER_HOUR');
      } else {
        Alert.alert('Error', 'Asset not found');
        router.back();
      }
    } catch (error) {
      console.error('[AssetDetail] Error loading asset:', error);
      Alert.alert('Error', 'Failed to load asset details');
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    loadSubcontractors();
    loadAsset();
  }, [loadSubcontractors, loadAsset]);

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
    Alert.alert(
      'Remove Attachment',
      'Are you sure you want to remove this attachment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setAttachments(attachments.filter((a) => a.id !== attachmentId));
          },
        },
      ]
    );
  };

  const handleOpenAttachment = (attachment: Attachment) => {
    if (attachment.fileType === 'image') {
      setSelectedImage(attachment.downloadUrl);
    } else if (attachment.fileType === 'document') {
      if (Platform.OS === 'web') {
        window.open(attachment.downloadUrl, '_blank');
      } else {
        Linking.openURL(attachment.downloadUrl).catch((err) => {
          console.error('[AssetDetail] Error opening document:', err);
          Alert.alert('Error', 'Failed to open document');
        });
      }
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

  const handleSave = async () => {
    if (!assetId || typeof assetId !== 'string' || !user) return;

    if (!type.trim()) {
      Alert.alert('Validation Error', 'Type is required');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Validation Error', 'Location is required');
      return;
    }

    const dryRateValue = dryRate?.toString().trim() || '';
    const wetRateValue = wetRate?.toString().trim() || '';
    const dailyRateValue = dailyRate?.toString().trim() || '';

    const filledRates = [
      dryRateValue ? 'dry' : null,
      wetRateValue ? 'wet' : null,
      dailyRateValue ? 'daily' : null,
    ].filter(Boolean);

    if (filledRates.length === 0) {
      Alert.alert('Validation Error', 'Please enter exactly one rate (Dry, Wet, or Daily)');
      return;
    }

    if (filledRates.length > 1) {
      Alert.alert('Validation Error', 'Please enter only ONE rate type. Clear the other rate fields.');
      return;
    }

    const dryRateNum = dryRateValue ? parseFloat(dryRateValue) : undefined;
    const wetRateNum = wetRateValue ? parseFloat(wetRateValue) : undefined;
    const dailyRateNum = dailyRateValue ? parseFloat(dailyRateValue) : undefined;

    if (dryRateValue && (isNaN(dryRateNum!) || dryRateNum! <= 0)) {
      Alert.alert('Validation Error', 'Dry Rate must be a valid positive number');
      return;
    }

    if (wetRateValue && (isNaN(wetRateNum!) || wetRateNum! <= 0)) {
      Alert.alert('Validation Error', 'Wet Rate must be a valid positive number');
      return;
    }

    if (dailyRateValue && (isNaN(dailyRateNum!) || dailyRateNum! <= 0)) {
      Alert.alert('Validation Error', 'Daily Rate must be a valid positive number');
      return;
    }

    try {
      setIsSaving(true);
      const assetRef = doc(db, 'plantAssets', assetId);

      const selectedSubcontractor = subcontractors.find(s => s.id === subcontractorId);

      const updateData: Partial<PlantAsset> = {
        type: type.trim(),
        location: location.trim(),
        plantNumber: plantNumber.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
        subcontractor: selectedSubcontractor?.name || undefined,
        ownerId: subcontractorId || undefined,
        ownerType: subcontractorId ? 'subcontractor' : 'company',
        ownerName: selectedSubcontractor?.name || undefined,
        crossHire: crossHire.trim() || undefined,
        onboardingDate: onboardingDate ? serverTimestamp() : undefined,
        inductionStatus,
        inductionNotes: inductionNotes.trim(),
        attachments,
        checklist,
        dryRate: dryRateNum,
        wetRate: wetRateNum,
        dailyRate: dailyRateNum,
        billingMethod,
        ratesSetAt: serverTimestamp(),
        ratesSetBy: user.userId,
        updatedAt: serverTimestamp(),
      };

      if (inductionStatus && !asset?.inductionStatus) {
        updateData.inductionDate = serverTimestamp();
        updateData.allocationStatus = 'ALLOCATED';
        console.log('[AssetDetail] Marking asset as onboarded - setting status to ALLOCATED');
      }

      if (!inductionStatus && asset?.inductionStatus) {
        updateData.allocationStatus = 'UNALLOCATED';
        console.log('[AssetDetail] Unmarking asset as onboarded - setting status to UNALLOCATED');
      }

      await updateDoc(assetRef, updateData);

      Alert.alert('Success', 'Asset record updated successfully');
      router.back();
    } catch (error) {
      console.error('[AssetDetail] Error updating asset:', error);
      Alert.alert('Error', 'Failed to update asset record');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !asset) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  const handleOffHireNotification = () => {
    setShowOffHirePicker(true);
  };

  const handleOffHireDateSubmit = async () => {
    if (!offHireDate || !assetId || typeof assetId !== 'string' || !user) return;

    Alert.alert(
      'Submit Off-Hire Date',
      `Submit off-hire date as ${offHireDate.toLocaleDateString()}? This will be used for final billing calculations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setIsSaving(true);
              const assetRef = doc(db, 'plantAssets', assetId);
              await updateDoc(assetRef, {
                offHireDate: offHireDate,
                offHireTimestamp: serverTimestamp(),
                offHireSubmittedBy: user.userId,
                allocationStatus: 'UNALLOCATED',
                updatedAt: serverTimestamp(),
              });
              console.log('[AssetDetail] Off-hire date submitted - setting status to UNALLOCATED/available');
              setShowOffHirePicker(false);
              Alert.alert('Success', 'Off-hire date has been logged for reporting');
            } catch (error) {
              console.error('[AssetDetail] Error submitting off-hire date:', error);
              Alert.alert('Error', 'Failed to submit off-hire date');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
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
        <Text style={styles.headerTitle}>Asset Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => {
              if (asset) {
                router.push({
                  pathname: '/generate-plant-qr',
                  params: {
                    assetId: asset.assetId,
                    assetType: asset.type,
                    location: asset.location || '',
                  },
                });
              }
            }}
            disabled={isSaving}
          >
            <QrCode size={24} color="#f59e0b" />
          </TouchableOpacity>
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
          <View style={styles.statusCard}>
            {asset.inductionStatus ? (
              <View style={styles.statusHeaderSuccess}>
                <CheckCircle size={24} color="#10b981" />
                <Text style={styles.statusTitleSuccess}>Onboarding Complete</Text>
              </View>
            ) : (
              <View style={styles.statusHeaderWarning}>
                <Clock size={24} color="#f59e0b" />
                <Text style={styles.statusTitleWarning}>Onboarding Pending</Text>
              </View>
            )}
            {asset.inductionDate && (
              <Text style={styles.statusDate}>
                Completed on: {new Date(
                  typeof asset.inductionDate === 'object' && 'toDate' in asset.inductionDate
                    ? asset.inductionDate.toDate()
                    : asset.inductionDate
                ).toLocaleDateString()}
              </Text>
            )}
          </View>

          <View style={styles.assetIdCard}>
            <Hash size={20} color="#3b82f6" />
            <Text style={styles.assetIdText}>{asset.assetId}</Text>
          </View>

          <View style={styles.expandableCard}>
            <View style={styles.expandableHeaderRow}>
              <TouchableOpacity
                style={styles.expandableHeaderTouchable}
                onPress={() => setIsDetailsExpanded(!isDetailsExpanded)}
                activeOpacity={0.7}
              >
                <Text style={styles.expandableTitle}>Plant Details</Text>
                {isDetailsExpanded ? (
                  <ChevronUp size={24} color="#64748b" />
                ) : (
                  <ChevronDown size={24} color="#64748b" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Edit size={20} color="#3b82f6" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {isDetailsExpanded && (
            <View style={styles.expandableContent}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Package size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>TYPE</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter asset type"
                  value={type}
                  onChangeText={setType}
                  editable={!isSaving}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <MapPin size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>SITE ID</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter site ID"
                  value={location}
                  onChangeText={setLocation}
                  editable={!isSaving}
                />
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
                  <Users size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>SUBCONTRACTOR</Text>
                </View>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowSubcontractorPicker(true)}
                  disabled={isSaving}
                >
                  <Text style={subcontractor ? styles.pickerButtonText : styles.pickerButtonPlaceholder}>
                    {subcontractor || 'Select subcontractor'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
                </TouchableOpacity>
                {subcontractor && (
                  <TouchableOpacity
                    style={styles.clearSubButton}
                    onPress={() => {
                      setSubcontractor('');
                      setSubcontractorId('');
                    }}
                    disabled={isSaving}
                  >
                    <Text style={styles.clearSubText}>Clear Selection</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Building2 size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>CROSSHIRE (Who Pays you)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter company name if different"
                  value={crossHire}
                  onChangeText={setCrossHire}
                  editable={!isSaving}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Calendar size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Induction Date</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setTempInductionDate(onboardingDate || new Date());
                    setShowInductionDatePicker(true);
                  }}
                  disabled={isSaving}
                >
                  <Text style={onboardingDate ? styles.dateText : styles.dateTextPlaceholder}>
                    {onboardingDate ? onboardingDate.toLocaleDateString() : 'Select induction date'}
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

              <View style={styles.inductionSection}>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Text style={styles.switchLabelText}>Mark as Onboarded</Text>
                    <Text style={styles.switchLabelHint}>
                      Toggle to mark onboarding as complete
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
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.offHireSubmitButtonText}>Submit</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!showOffHirePicker && (
                <TouchableOpacity
                  style={styles.offHireButton}
                  onPress={handleOffHireNotification}
                  disabled={isSaving}
                >
                  <Calendar size={20} color="#fff" />
                  <Text style={styles.offHireButtonText}>Off-Hire Notification</Text>
                </TouchableOpacity>
              )}

              {asset.offHireDate && (
                <View style={styles.offHireDateInfo}>
                  <Text style={styles.offHireDateInfoLabel}>Off-Hire Date Logged:</Text>
                  <Text style={styles.offHireDateInfoValue}>
                    {new Date(asset.offHireDate).toLocaleDateString()}
                  </Text>
                  {asset.offHireTimestamp && (
                    <Text style={styles.offHireDateInfoTimestamp}>
                      Submitted on {new Date(
                        typeof asset.offHireTimestamp === 'object' && 'toDate' in asset.offHireTimestamp
                          ? asset.offHireTimestamp.toDate()
                          : asset.offHireTimestamp
                      ).toLocaleString()}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.expandableCard}
            onPress={() => setIsRatesExpanded(!isRatesExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.expandableHeader}>
              <View style={styles.expandableTitleWithIcon}>
                <DollarSign size={20} color="#10b981" />
                <Text style={styles.expandableTitle}>Plant Rates</Text>
              </View>
              {isRatesExpanded ? (
                <ChevronUp size={24} color="#64748b" />
              ) : (
                <ChevronDown size={24} color="#64748b" />
              )}
            </View>
          </TouchableOpacity>

          {isRatesExpanded && (
            <View style={styles.expandableContent}>
              <View style={styles.billingMethodSection}>
                <Text style={styles.billingMethodTitle}>Billing Method</Text>
                <Text style={styles.billingMethodSubtitle}>Select how this asset will be billed</Text>
                <View style={styles.billingMethodButtons}>
                  <TouchableOpacity
                    style={[
                      styles.billingMethodButton,
                      billingMethod === 'PER_HOUR' && styles.billingMethodButtonActive,
                    ]}
                    onPress={() => setBillingMethod('PER_HOUR')}
                    disabled={isSaving}
                  >
                    <Clock size={20} color={billingMethod === 'PER_HOUR' ? '#3b82f6' : '#64748b'} />
                    <View style={styles.billingMethodButtonContent}>
                      <Text
                        style={[
                          styles.billingMethodButtonText,
                          billingMethod === 'PER_HOUR' && styles.billingMethodButtonTextActive,
                        ]}
                      >
                        Per Hour
                      </Text>
                      <Text style={styles.billingMethodButtonSubtext}>
                        Bill for actual hours worked
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.billingMethodButton,
                      billingMethod === 'MINIMUM_BILLING' && styles.billingMethodButtonActive,
                    ]}
                    onPress={() => setBillingMethod('MINIMUM_BILLING')}
                    disabled={isSaving}
                  >
                    <Calendar size={20} color={billingMethod === 'MINIMUM_BILLING' ? '#10b981' : '#64748b'} />
                    <View style={styles.billingMethodButtonContent}>
                      <Text
                        style={[
                          styles.billingMethodButtonText,
                          billingMethod === 'MINIMUM_BILLING' && styles.billingMethodButtonTextActive,
                        ]}
                      >
                        Minimum Billing
                      </Text>
                      <Text style={styles.billingMethodButtonSubtext}>
                        Apply minimum hours per day
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.ratesRow}>
                <View style={styles.rateInputContainer}>
                  <View style={styles.inputLabel}>
                    <DollarSign size={18} color="#64748b" />
                    <Text style={styles.inputLabelText}>DRY RATE (per hour)</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={dryRate}
                    onChangeText={setDryRate}
                    keyboardType="decimal-pad"
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.rateInputContainer}>
                  <View style={styles.inputLabel}>
                    <DollarSign size={18} color="#64748b" />
                    <Text style={styles.inputLabelText}>WET RATE (per hour)</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={wetRate}
                    onChangeText={setWetRate}
                    keyboardType="decimal-pad"
                    editable={!isSaving}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <DollarSign size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>DAILY RATE</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={dailyRate}
                  onChangeText={setDailyRate}
                  keyboardType="decimal-pad"
                  editable={!isSaving}
                />
              </View>

              <View style={styles.ratesNote}>
                <Text style={styles.ratesNoteText}>
                  Enter exactly ONE rate type. Choose either Dry Rate, Wet Rate, OR Daily Rate - not multiple.
                </Text>
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
                        activeOpacity={0.7}
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
                        activeOpacity={0.7}
                        style={styles.attachmentInfo}
                      >
                        <Text style={styles.attachmentFileName} numberOfLines={1}>
                          {attachment.fileName}
                        </Text>
                        <Text style={styles.attachmentMeta}>
                          {attachment.fileType === 'image' ? 'Tap to view' : 'Tap to open'} • {new Date(attachment.uploadedAt).toLocaleDateString()}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRemoveAttachment(attachment.id);
                        }}
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

          {checklist.length > 0 && (
            <>
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
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseArea}
            onPress={() => setSelectedImage(null)}
            activeOpacity={1}
          >
            <View style={styles.imageModalHeader}>
              <TouchableOpacity
                style={styles.imageModalCloseButton}
                onPress={() => setSelectedImage(null)}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.imageModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={showSubcontractorPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubcontractorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Subcontractor</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowSubcontractorPicker(false)}
              >
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {subcontractors.length === 0 ? (
                <View style={styles.emptyModal}>
                  <Text style={styles.emptyModalText}>No active subcontractors found</Text>
                </View>
              ) : (
                subcontractors.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={[
                      styles.modalItem,
                      subcontractorId === sub.id && styles.modalItemSelected,
                    ]}
                    onPress={() => {
                      setSubcontractor(sub.name);
                      setSubcontractorId(sub.id!);
                      setShowSubcontractorPicker(false);
                    }}
                  >
                    <View style={styles.modalItemContent}>
                      <Text style={styles.modalItemName}>{sub.name}</Text>
                      {sub.contactPerson && (
                        <Text style={styles.modalItemDetail}>{sub.contactPerson}</Text>
                      )}
                    </View>
                    {subcontractorId === sub.id && (
                      <CheckCircle size={20} color="#10b981" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showInductionDatePicker && Platform.OS === 'ios' && (
        <Modal
          visible={showInductionDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowInductionDatePicker(false)}
        >
          <View style={styles.datePickerModalOverlay}>
            <View style={styles.datePickerModalContent}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowInductionDatePicker(false)}>
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Induction Date</Text>
                <TouchableOpacity
                  onPress={() => {
                    setOnboardingDate(tempInductionDate);
                    setShowInductionDatePicker(false);
                  }}
                >
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempInductionDate}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setTempInductionDate(selectedDate);
                  }
                }}
                style={styles.datePickerIOS}
              />
            </View>
          </View>
        </Modal>
      )}

      {showInductionDatePicker && (Platform.OS === 'android' || Platform.OS === 'web') && (
        <DateTimePicker
          value={tempInductionDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowInductionDatePicker(false);
            if (event.type === 'set' && selectedDate) {
              setOnboardingDate(selectedDate);
            }
          }}
        />
      )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 12,
  },
  statusCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  statusHeaderSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTitleSuccess: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#10b981',
  },
  statusHeaderWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTitleWarning: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#f59e0b',
  },
  statusDate: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 36,
  },
  assetIdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  assetIdText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e40af',
    flex: 1,
  },
  expandableCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expandableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  expandableHeaderTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
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
  expandableTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
  },
  inductionSection: {
    paddingTop: 8,
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
    color: Colors.background,
  },
  switchLabelHint: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  notesSection: {
    gap: 8,
  },
  notesInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
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
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed' as const,
  },
  emptyAttachmentsText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  attachmentsList: {
    gap: 12,
  },
  attachmentItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  attachmentPreview: {
    flexShrink: 0,
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
  attachmentInfo: {
    flex: 1,
    gap: 4,
  },
  attachmentFileName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.background,
  },
  attachmentMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  removeButton: {
    padding: 4,
  },
  dateButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#000000',
  },
  dateText: {
    fontSize: 15,
    color: '#000000',
  },
  dateTextPlaceholder: {
    fontSize: 15,
    color: Colors.textSecondary,
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
    marginTop: 8,
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
  offHireDateInfoTimestamp: {
    fontSize: 12,
    color: '#16a34a',
    marginTop: 2,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseArea: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  imageModalHeader: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: 'flex-end',
  },
  imageModalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalImage: {
    width: '90%',
    height: '80%',
  },
  ratesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rateInputContainer: {
    flex: 1,
    gap: 8,
  },
  ratesNote: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  ratesNoteText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#000000',
  },
  pickerButtonText: {
    fontSize: 15,
    color: '#000000',
  },
  pickerButtonPlaceholder: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  clearSubButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  clearSubText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalList: {
    flex: 1,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemSelected: {
    backgroundColor: '#f0fdf4',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
    marginBottom: 4,
  },
  modalItemDetail: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyModal: {
    padding: 40,
    alignItems: 'center',
  },
  emptyModalText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModalContent: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  datePickerCancelText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  datePickerDoneText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  datePickerIOS: {
    height: 200,
  },
  billingMethodSection: {
    marginBottom: 20,
  },
  billingMethodTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.background,
    marginBottom: 4,
  },
  billingMethodSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  billingMethodButtons: {
    gap: 12,
  },
  billingMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  billingMethodButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  billingMethodButtonContent: {
    flex: 1,
  },
  billingMethodButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 2,
  },
  billingMethodButtonTextActive: {
    color: '#1e293b',
  },
  billingMethodButtonSubtext: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
