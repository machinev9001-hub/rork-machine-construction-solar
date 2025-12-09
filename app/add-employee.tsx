import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
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
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft, Save, User, Briefcase, Phone, Mail, Calendar, ChevronDown, ChevronUp, ImageIcon, FileText, X, Paperclip, Send, Plus, Trash2, CreditCard, Globe, Building } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { queueFirestoreOperation } from '@/utils/offlineQueue';
import { db } from '@/config/firebase';
import { Attachment } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { COUNTRIES } from '@/constants/countries';
import { getEmployeeRoleOptions } from '@/constants/roles';
import { CompanySelector } from '@/components/CompanySelector';
import { Colors } from '@/constants/colors';


export default function AddEmployeeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [employeeIdNumber, setEmployeeIdNumber] = useState('');
  const [citizenshipCountry, setCitizenshipCountry] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [medicalExpiryDate, setMedicalExpiryDate] = useState<Date | undefined>(undefined);
  const [licenseExpiryDate, setLicenseExpiryDate] = useState<Date | undefined>(undefined);
  const [competencyExpiryDate, setCompetencyExpiryDate] = useState<Date | undefined>(undefined);
  const [pdpExpiryDate, setPdpExpiryDate] = useState<Date | undefined>(undefined);
  const [inductionStatus, setInductionStatus] = useState(false);
  const [inductionDate, setInductionDate] = useState<Date | undefined>(undefined);
  const [inductionNotes, setInductionNotes] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isBasicInfoExpanded, setIsBasicInfoExpanded] = useState(false);
  const [isExpiryDatesExpanded, setIsExpiryDatesExpanded] = useState(false);
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
  const [isInductionExpanded, setIsInductionExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'medical' | 'license' | 'competency' | 'pdp' | 'induction' | null>(null);
  const [tempDate, setTempDate] = useState(new Date());
  const [validationErrors, setValidationErrors] = useState<{
    name?: boolean;
    role?: boolean;
    contact?: boolean;
    employeeIdNumber?: boolean;
    citizenshipCountry?: boolean;
    employerName?: boolean;
  }>({});

  const [employerName, setEmployerName] = useState('');
  const [employerId, setEmployerId] = useState('');
  const [employerType, setEmployerType] = useState<'company' | 'subcontractor'>('company');
  const [isCrossHire, setIsCrossHire] = useState(false);
  const [crossHireName, setCrossHireName] = useState('');

  const handleEmployerSelect = (name: string, id: string, type: 'company' | 'subcontractor') => {
    setEmployerName(name);
    setEmployerId(id);
    setEmployerType(type);
    if (validationErrors.employerName) {
      setValidationErrors(prev => ({ ...prev, employerName: false }));
    }
  };


  const defaultRoles = useMemo(() => getEmployeeRoleOptions(), []);

  const allRoles = [...defaultRoles, ...customRoles];

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
    console.log('[AddEmployee] Removing attachment:', attachmentId);
    Alert.alert(
      'Remove Attachment',
      'Are you sure you want to remove this attachment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            console.log('[AddEmployee] Confirmed removal, filtering attachments');
            setAttachments(prevAttachments => {
              const filtered = prevAttachments.filter((a) => a.id !== attachmentId);
              console.log('[AddEmployee] Attachments after removal:', filtered.length);
              return filtered;
            });
          },
        },
      ]
    );
  };

  const handleOpenAttachment = async (attachment: Attachment) => {
    console.log('[AddEmployee] Opening attachment:', attachment.fileName);
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
      console.error('[AddEmployee] Error opening attachment:', error);
      Alert.alert('Error', 'Failed to open attachment');
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const eventType = event?.type;
    
    if (Platform.OS === 'android' || Platform.OS === 'web') {
      setShowDatePicker(null);
      
      if (eventType === 'dismissed' || !selectedDate) {
        return;
      }
      
      if (selectedDate) {
        switch (showDatePicker) {
          case 'medical':
            setMedicalExpiryDate(selectedDate);
            break;
          case 'license':
            setLicenseExpiryDate(selectedDate);
            break;
          case 'competency':
            setCompetencyExpiryDate(selectedDate);
            break;
          case 'pdp':
            setPdpExpiryDate(selectedDate);
            break;
          case 'induction':
            setInductionDate(selectedDate);
            break;
        }
      }
      return;
    }
    
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const confirmDateSelection = () => {
    if (showDatePicker) {
      switch (showDatePicker) {
        case 'medical':
          setMedicalExpiryDate(tempDate);
          break;
        case 'license':
          setLicenseExpiryDate(tempDate);
          break;
        case 'competency':
          setCompetencyExpiryDate(tempDate);
          break;
        case 'pdp':
          setPdpExpiryDate(tempDate);
          break;
        case 'induction':
          setInductionDate(tempDate);
          break;
      }
      setShowDatePicker(null);
    }
  };

  const openDatePicker = (type: 'medical' | 'license' | 'competency' | 'pdp' | 'induction', currentDate?: Date) => {
    setTempDate(currentDate || new Date());
    setShowDatePicker(type);
  };

  const handleDemobilize = async () => {
    Alert.alert(
      'Request Exit Medical',
      'This will send a demobilization request. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: async () => {
            try {
              const messagesRef = collection(db, 'onboardingMessages');
              await addDoc(messagesRef, {
                siteId: user?.siteId,
                masterAccountId: user?.masterAccountId,
                fromUserId: user?.id,
                fromUserName: user?.name,
                toUserId: '',
                message: `Request Exit Medical for employee: ${name}`,
                type: 'EXIT_MEDICAL',
                employeeName: name,
                read: false,
                createdAt: serverTimestamp(),
              });
              Alert.alert('Success', 'Demobilization request sent');
            } catch (error) {
              console.error('[AddEmployee] Error sending demobilize request:', error);
              Alert.alert('Error', 'Failed to send demobilization request');
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!user?.siteId || !user?.masterAccountId) {
      Alert.alert('Error', 'Missing site or account information');
      return;
    }

    const errors: typeof validationErrors = {};

    if (!name.trim()) {
      errors.name = true;
    }

    if (!role.trim()) {
      errors.role = true;
    }

    if (!contact.trim()) {
      errors.contact = true;
    }

    if (!employeeIdNumber.trim()) {
      errors.employeeIdNumber = true;
    }

    if (!citizenshipCountry.trim()) {
      errors.citizenshipCountry = true;
    }

    if (!employerName.trim()) {
      errors.employerName = true;
    }

    if (citizenshipCountry === 'South Africa' && employeeIdNumber.trim().length !== 13) {
      errors.employeeIdNumber = true;
    }

    if (citizenshipCountry === 'South Africa' && !/^\d+$/.test(employeeIdNumber.trim())) {
      errors.employeeIdNumber = true;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setIsBasicInfoExpanded(true);
      Alert.alert('Validation Error', 'Please fill in all required fields correctly. Fields with errors are highlighted in red.');
      return;
    }

    setValidationErrors({});

    setIsSaving(true);

    try {
      console.log('[AddEmployee] Checking for duplicate ID number and contact');
      console.log('[AddEmployee] Current user.siteId:', user.siteId);
      console.log('[AddEmployee] Checking employeeIdNumber:', employeeIdNumber.trim());
      const employeesRef = collection(db, 'employees');
      
      const idQuery = query(
        employeesRef,
        where('employeeIdNumber', '==', employeeIdNumber.trim()),
        where('siteId', '==', user.siteId)
      );
      
      const idSnapshot = await getDocs(idQuery);
      console.log('[AddEmployee] Found', idSnapshot.size, 'matching employees in this site');
      
      if (!idSnapshot.empty) {
        const existingEmployee = idSnapshot.docs[0].data();
        console.log('[AddEmployee] Duplicate ID number found within site:', user.siteId);
        console.log('[AddEmployee] Existing employee:', existingEmployee.name, '| ID:', existingEmployee.employeeIdNumber);
        setValidationErrors({ employeeIdNumber: true });
        setIsBasicInfoExpanded(true);
        Alert.alert(
          'Duplicate ID Number',
          `An employee with ID "${employeeIdNumber.trim()}" already exists in this site: "${existingEmployee.name}". Each employee must have a unique ID number within the same site. The same ID can exist in different sites.`,
          [{ text: 'OK' }]
        );
        setIsSaving(false);
        return;
      }

      const contactQuery = query(
        employeesRef,
        where('contact', '==', contact.trim()),
        where('siteId', '==', user.siteId)
      );
      
      const contactSnapshot = await getDocs(contactQuery);
      console.log('[AddEmployee] Found', contactSnapshot.size, 'employees with matching contact in this site');
      
      if (!contactSnapshot.empty) {
        const existingEmployee = contactSnapshot.docs[0].data();
        console.log('[AddEmployee] Duplicate contact number found within site:', user.siteId);
        console.log('[AddEmployee] Existing employee:', existingEmployee.name, '| Contact:', existingEmployee.contact);
        setValidationErrors({ contact: true });
        setIsBasicInfoExpanded(true);
        Alert.alert(
          'Duplicate Contact Number',
          `An employee with contact "${contact.trim()}" already exists in this site: "${existingEmployee.name}". Each employee must have a unique contact number within the same site.`,
          [{ text: 'OK' }]
        );
        setIsSaving(false);
        return;
      }

      console.log('[AddEmployee] No duplicates found, proceeding with save');
    } catch (error) {
      console.error('[AddEmployee] Error checking for duplicates:', error);
      Alert.alert('Error', 'Failed to validate employee information');
      setIsSaving(false);
      return;
    }

    try {
      const employeeData: any = {
        name: name.trim(),
        role: role.trim(),
        contact: contact.trim(),
        email: email.trim() || null,
        employeeIdNumber: employeeIdNumber.trim(),
        citizenshipCountry: citizenshipCountry.trim(),
        employerName: employerName.trim(),
        employerId: employerId || null,
        employerType,
        isCrossHire,
        crossHireName: isCrossHire ? crossHireName.trim() : null,
        siteId: user.siteId,
        masterAccountId: user.masterAccountId,
        companyId: user.currentCompanyId || null,
        inductionStatus,
        inductionNotes: inductionNotes.trim(),
        attachments,
        photoUri: photoUri || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (medicalExpiryDate) {
        employeeData.medicalExpiryDate = Timestamp.fromDate(medicalExpiryDate);
      }

      if (licenseExpiryDate) {
        employeeData.licenseExpiryDate = Timestamp.fromDate(licenseExpiryDate);
      }

      if (competencyExpiryDate) {
        employeeData.competencyExpiryDate = Timestamp.fromDate(competencyExpiryDate);
      }

      if (pdpExpiryDate) {
        employeeData.pdpExpiryDate = Timestamp.fromDate(pdpExpiryDate);
      }

      if (inductionDate) {
        employeeData.inductionDate = Timestamp.fromDate(inductionDate);
      } else if (inductionStatus) {
        employeeData.inductionDate = Date.now();
      }

      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected;

      console.log('[AddEmployee] Network status:', isOnline ? 'Online' : 'Offline');

      if (isOnline) {
        const employeesRef = collection(db, 'employees');
        await addDoc(employeesRef, employeeData);
        console.log('[AddEmployee] Employee saved to Firebase');
      } else {
        await queueFirestoreOperation(
          {
            type: 'add',
            collection: 'employees',
            data: employeeData,
          },
          {
            priority: 'P1',
            entityType: 'other',
          }
        );
        console.log('[AddEmployee] Employee queued for offline sync');
      }

      const statusMessage = isOnline 
        ? 'Employee added successfully'
        : 'Employee saved offline. Will sync when connection is restored.';

      Alert.alert('Success', statusMessage, [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('[AddEmployee] Error adding employee:', error);
      Alert.alert('Error', 'Failed to add employee');
    } finally {
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
        <Text style={styles.headerTitle}>Add Employee / Subcontractors</Text>
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
                  <ImageIcon size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Profile Photo (Optional)</Text>
                </View>
                {photoUri ? (
                  <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => setPhotoUri(null)}
                      disabled={isSaving}
                    >
                      <X size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.photoUploadButton}
                    onPress={async () => {
                      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (!permissionResult.granted) {
                        Alert.alert('Permission Required', 'Please grant permission to access photos');
                        return;
                      }
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsEditing: true,
                        aspect: [1, 1],
                        quality: 0.7,
                        base64: true,
                      });
                      if (!result.canceled && result.assets[0]) {
                        const file = result.assets[0];
                        if (file.base64) {
                          setPhotoUri(`data:image/jpeg;base64,${file.base64}`);
                        }
                      }
                    }}
                    disabled={isSaving}
                  >
                    <ImageIcon size={32} color="#94a3b8" />
                    <Text style={styles.photoUploadText}>Tap to add photo</Text>
                    <Text style={styles.photoUploadHint}>For QR access card</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <User size={18} color={validationErrors.name ? "#ef4444" : "#64748b"} />
                  <Text style={[styles.inputLabelText, validationErrors.name && styles.inputLabelTextError]}>Name *</Text>
                </View>
                <TextInput
                  style={[styles.input, validationErrors.name && styles.inputError]}
                  placeholder="Enter employee name"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (validationErrors.name && text.trim()) {
                      setValidationErrors(prev => ({ ...prev, name: false }));
                    }
                  }}
                  editable={!isSaving}
                />
                {validationErrors.name && (
                  <Text style={styles.errorText}>Name is required</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Briefcase size={18} color={validationErrors.role ? "#ef4444" : "#64748b"} />
                  <Text style={[styles.inputLabelText, validationErrors.role && styles.inputLabelTextError]}>Role *</Text>
                </View>
                <TouchableOpacity
                  style={[styles.roleSelector, validationErrors.role && styles.inputError]}
                  onPress={() => setShowRoleDropdown(!showRoleDropdown)}
                  disabled={isSaving}
                >
                  <Text style={role ? styles.roleSelectorText : styles.roleSelectorPlaceholder}>
                    {role || 'Select employee role'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
                </TouchableOpacity>
                {validationErrors.role && (
                  <Text style={styles.errorText}>Role is required</Text>
                )}
                {showRoleDropdown && (
                  <View style={styles.roleDropdown}>
                    <ScrollView style={styles.roleList} nestedScrollEnabled>
                      {allRoles.map((roleOption) => (
                        <TouchableOpacity
                          key={roleOption}
                          style={styles.roleOption}
                          onPress={() => {
                            setRole(roleOption);
                            setShowRoleDropdown(false);
                            if (validationErrors.role) {
                              setValidationErrors(prev => ({ ...prev, role: false }));
                            }
                          }}
                        >
                          <Text style={role === roleOption ? styles.roleOptionTextSelected : styles.roleOptionText}>
                            {roleOption}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TouchableOpacity
                      style={styles.manageRolesButton}
                      onPress={() => {
                        setShowRoleDropdown(false);
                        setShowRoleManager(true);
                      }}
                    >
                      <Plus size={18} color="#3b82f6" />
                      <Text style={styles.manageRolesButtonText}>Manage Roles</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Phone size={18} color={validationErrors.contact ? "#ef4444" : "#64748b"} />
                  <Text style={[styles.inputLabelText, validationErrors.contact && styles.inputLabelTextError]}>Contact *</Text>
                </View>
                <TextInput
                  style={[styles.input, validationErrors.contact && styles.inputError]}
                  placeholder="Enter contact number"
                  value={contact}
                  onChangeText={(text) => {
                    setContact(text);
                    if (validationErrors.contact && text.trim()) {
                      setValidationErrors(prev => ({ ...prev, contact: false }));
                    }
                  }}
                  keyboardType="phone-pad"
                  editable={!isSaving}
                />
                {validationErrors.contact && (
                  <Text style={styles.errorText}>
                    {!contact.trim() ? 'Contact is required' : 'This contact number already exists'}
                  </Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Mail size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Email (Optional)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isSaving}
                />
              </View>

              <CompanySelector
                masterAccountId={user?.masterAccountId || ''}
                currentCompanyId={user?.currentCompanyId}
                siteId={user?.siteId}
                value={employerName}
                onSelect={handleEmployerSelect}
                disabled={isSaving}
                placeholder="Select employer"
                label="Employer Name *"
                hasError={validationErrors.employerName}
                errorMessage="Employer is required"
              />

              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchLabelText}>Cross-Hire</Text>
                  <Text style={styles.switchLabelHint}>
                    Employee hired from another company
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
                    <Building size={18} color="#64748b" />
                    <Text style={styles.inputLabelText}>Cross-Hire From</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter company name (true owner/payer)"
                    value={crossHireName}
                    onChangeText={setCrossHireName}
                    editable={!isSaving}
                  />
                  <Text style={styles.fieldHint}>
                    Specify the company that pays this employee
                  </Text>
                </View>
              )}

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Globe size={18} color={validationErrors.citizenshipCountry ? "#ef4444" : "#64748b"} />
                  <Text style={[styles.inputLabelText, validationErrors.citizenshipCountry && styles.inputLabelTextError]}>Citizenship Country *</Text>
                </View>
                <TouchableOpacity
                  style={[styles.roleSelector, validationErrors.citizenshipCountry && styles.inputError]}
                  onPress={() => setShowCountryDropdown(!showCountryDropdown)}
                  disabled={isSaving}
                >
                  <Text style={citizenshipCountry ? styles.roleSelectorText : styles.roleSelectorPlaceholder}>
                    {citizenshipCountry || 'Select citizenship country'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
                </TouchableOpacity>
                {validationErrors.citizenshipCountry && (
                  <Text style={styles.errorText}>Citizenship country is required</Text>
                )}
                {showCountryDropdown && (
                  <View style={styles.roleDropdown}>
                    <ScrollView style={styles.roleList} nestedScrollEnabled>
                      {COUNTRIES.map((country) => (
                        <TouchableOpacity
                          key={country}
                          style={styles.roleOption}
                          onPress={() => {
                            setCitizenshipCountry(country);
                            setShowCountryDropdown(false);
                            if (validationErrors.citizenshipCountry) {
                              setValidationErrors(prev => ({ ...prev, citizenshipCountry: false }));
                            }
                          }}
                        >
                          <Text style={citizenshipCountry === country ? styles.roleOptionTextSelected : styles.roleOptionText}>
                            {country}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <CreditCard size={18} color={validationErrors.employeeIdNumber ? "#ef4444" : "#64748b"} />
                  <Text style={[styles.inputLabelText, validationErrors.employeeIdNumber && styles.inputLabelTextError]}>Employee ID Number *</Text>
                </View>
                <TextInput
                  style={[styles.input, validationErrors.employeeIdNumber && styles.inputError]}
                  placeholder={citizenshipCountry === 'South Africa' ? 'Enter 13-digit ID number' : 'Enter ID number'}
                  value={employeeIdNumber}
                  onChangeText={(text) => {
                    setEmployeeIdNumber(text);
                    if (validationErrors.employeeIdNumber && text.trim()) {
                      setValidationErrors(prev => ({ ...prev, employeeIdNumber: false }));
                    }
                  }}
                  keyboardType={citizenshipCountry === 'South Africa' ? 'numeric' : 'default'}
                  maxLength={citizenshipCountry === 'South Africa' ? 13 : undefined}
                  editable={!isSaving}
                />
                {validationErrors.employeeIdNumber && (
                  <Text style={styles.errorText}>
                    {!employeeIdNumber.trim() 
                      ? 'ID number is required' 
                      : citizenshipCountry === 'South Africa' && employeeIdNumber.trim().length !== 13
                      ? 'South African ID must be 13 digits'
                      : citizenshipCountry === 'South Africa' && !/^\d+$/.test(employeeIdNumber.trim())
                      ? 'South African ID must contain only digits'
                      : 'This ID number already exists'}
                  </Text>
                )}
                {!validationErrors.employeeIdNumber && citizenshipCountry === 'South Africa' && (
                  <Text style={styles.fieldHint}>
                    Must be 13 digits for South African citizens
                  </Text>
                )}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.expandableCard}
            onPress={() => setIsExpiryDatesExpanded(!isExpiryDatesExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.expandableHeader}>
              <Text style={styles.expandableTitle}>Expiry Dates & Certifications</Text>
              {isExpiryDatesExpanded ? (
                <ChevronUp size={24} color="#64748b" />
              ) : (
                <ChevronDown size={24} color="#64748b" />
              )}
            </View>
          </TouchableOpacity>

          {isExpiryDatesExpanded && (
            <View style={styles.expandableContent}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Calendar size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Medical Expiry Date</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => openDatePicker('medical', medicalExpiryDate)}
                  disabled={isSaving}
                >
                  <Text style={medicalExpiryDate ? styles.dateText : styles.dateTextPlaceholder}>
                    {medicalExpiryDate ? medicalExpiryDate.toLocaleDateString() : 'Select medical expiry date'}
                  </Text>
                </TouchableOpacity>
                {medicalExpiryDate && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setMedicalExpiryDate(undefined)}
                    disabled={isSaving}
                  >
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Calendar size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>License Expiry Date</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => openDatePicker('license', licenseExpiryDate)}
                  disabled={isSaving}
                >
                  <Text style={licenseExpiryDate ? styles.dateText : styles.dateTextPlaceholder}>
                    {licenseExpiryDate ? licenseExpiryDate.toLocaleDateString() : 'Select license expiry date'}
                  </Text>
                </TouchableOpacity>
                {licenseExpiryDate && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setLicenseExpiryDate(undefined)}
                    disabled={isSaving}
                  >
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Calendar size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Competency Expiry Date</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => openDatePicker('competency', competencyExpiryDate)}
                  disabled={isSaving}
                >
                  <Text style={competencyExpiryDate ? styles.dateText : styles.dateTextPlaceholder}>
                    {competencyExpiryDate ? competencyExpiryDate.toLocaleDateString() : 'Select competency expiry date'}
                  </Text>
                </TouchableOpacity>
                {competencyExpiryDate && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setCompetencyExpiryDate(undefined)}
                    disabled={isSaving}
                  >
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Calendar size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>PDP Expiry Date</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => openDatePicker('pdp', pdpExpiryDate)}
                  disabled={isSaving}
                >
                  <Text style={pdpExpiryDate ? styles.dateText : styles.dateTextPlaceholder}>
                    {pdpExpiryDate ? pdpExpiryDate.toLocaleDateString() : 'Select PDP expiry date'}
                  </Text>
                </TouchableOpacity>
                {pdpExpiryDate && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setPdpExpiryDate(undefined)}
                    disabled={isSaving}
                  >
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Notifications will be triggered 25 days before each expiry date.
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
            onPress={() => setIsInductionExpanded(!isInductionExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.expandableHeader}>
              <Text style={styles.expandableTitle}>Induction and Demobilize</Text>
              {isInductionExpanded ? (
                <ChevronUp size={24} color="#64748b" />
              ) : (
                <ChevronDown size={24} color="#64748b" />
              )}
            </View>
          </TouchableOpacity>

          {isInductionExpanded && (
            <View style={styles.expandableContent}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Calendar size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Induction Date</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => openDatePicker('induction', inductionDate)}
                  disabled={isSaving}
                >
                  <Text style={inductionDate ? styles.dateText : styles.dateTextPlaceholder}>
                    {inductionDate ? inductionDate.toLocaleDateString() : 'Select induction date'}
                  </Text>
                </TouchableOpacity>
                {inductionDate && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setInductionDate(undefined)}
                    disabled={isSaving}
                  >
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchLabelText}>Mark as Inducted</Text>
                  <Text style={styles.switchLabelHint}>
                    Toggle if induction is already complete
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
                <Text style={styles.inputLabelText}>Induction Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add notes about the induction..."
                  value={inductionNotes}
                  onChangeText={setInductionNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!isSaving}
                />
              </View>

              <TouchableOpacity
                style={styles.demobilizeButton}
                onPress={handleDemobilize}
                disabled={isSaving || !name.trim()}
              >
                <Send size={20} color="#fff" />
                <Text style={styles.demobilizeButtonText}>Request Exit Medical</Text>
              </TouchableOpacity>
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

      {showRoleManager && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Roles</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowRoleManager(false);
                  setNewRoleName('');
                }}
              >
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.addRoleSection}>
              <TextInput
                style={styles.addRoleInput}
                placeholder="Enter new role name"
                value={newRoleName}
                onChangeText={setNewRoleName}
              />
              <TouchableOpacity
                style={styles.addRoleButton}
                onPress={() => {
                  if (newRoleName.trim() && !allRoles.includes(newRoleName.trim())) {
                    setCustomRoles([...customRoles, newRoleName.trim()]);
                    setNewRoleName('');
                  } else if (allRoles.includes(newRoleName.trim())) {
                    Alert.alert('Duplicate Role', 'This role already exists');
                  }
                }}
              >
                <Plus size={20} color="#fff" />
                <Text style={styles.addRoleButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.roleManagerDivider} />

            <ScrollView style={styles.roleManagerList}>
              <Text style={styles.roleManagerSectionTitle}>Default Roles</Text>
              {defaultRoles.map((roleOption) => (
                <View key={roleOption} style={styles.roleManagerItem}>
                  <Text style={styles.roleManagerItemText}>{roleOption}</Text>
                  <Text style={styles.roleManagerItemLabel}>Built-in</Text>
                </View>
              ))}

              {customRoles.length > 0 && (
                <>
                  <Text style={[styles.roleManagerSectionTitle, { marginTop: 16 }]}>Custom Roles</Text>
                  {customRoles.map((roleOption) => (
                    <View key={roleOption} style={styles.roleManagerItem}>
                      <Text style={styles.roleManagerItemText}>{roleOption}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert(
                            'Delete Role',
                            `Are you sure you want to delete "${roleOption}"?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => {
                                  setCustomRoles(customRoles.filter((r) => r !== roleOption));
                                  if (role === roleOption) {
                                    setRole('');
                                  }
                                },
                              },
                            ]
                          );
                        }}
                        style={styles.deleteRoleButton}
                      >
                        <Trash2 size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowRoleManager(false);
                setNewRoleName('');
              }}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showDatePicker && Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(null)}
        >
          <View style={styles.datePickerModalOverlay}>
            <View style={styles.datePickerModalContent}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(null)}>
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>
                  {showDatePicker === 'medical' && 'Medical Expiry Date'}
                  {showDatePicker === 'license' && 'License Expiry Date'}
                  {showDatePicker === 'competency' && 'Competency Expiry Date'}
                  {showDatePicker === 'pdp' && 'PDP Expiry Date'}
                  {showDatePicker === 'induction' && 'Induction Date'}
                </Text>
                <TouchableOpacity onPress={confirmDateSelection}>
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                style={styles.datePickerIOS}
              />
            </View>
          </View>
        </Modal>
      )}
      
      {showDatePicker && (Platform.OS === 'android' || Platform.OS === 'web') && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
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
    color: Colors.text,
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
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
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
  demobilizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  demobilizeButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  roleSelector: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roleSelectorText: {
    fontSize: 15,
    color: '#1e293b',
  },
  roleSelectorPlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
  },
  roleDropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: 300,
    marginTop: 8,
  },
  roleList: {
    maxHeight: 240,
  },
  roleOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  roleOptionText: {
    fontSize: 15,
    color: '#1e293b',
  },
  roleOptionTextSelected: {
    fontSize: 15,
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  manageRolesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  manageRolesButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  modalOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  addRoleSection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  addRoleInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addRoleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addRoleButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  roleManagerDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  roleManagerList: {
    maxHeight: 400,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  roleManagerSectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  roleManagerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  roleManagerItemText: {
    fontSize: 15,
    color: '#1e293b',
  },
  roleManagerItemLabel: {
    fontSize: 12,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteRoleButton: {
    padding: 4,
  },
  modalCloseButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModalContent: {
    backgroundColor: '#fff',
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
    borderBottomColor: '#e2e8f0',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  datePickerCancelText: {
    fontSize: 16,
    color: '#64748b',
  },
  datePickerDoneText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  datePickerIOS: {
    height: 200,
  },
  fieldHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  inputLabelTextError: {
    color: '#ef4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '500' as const,
  },
  photoPreviewContainer: {
    position: 'relative' as const,
    alignSelf: 'center',
    marginTop: 8,
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e2e8f0',
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  removePhotoButton: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  photoUploadButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed' as const,
  },
  photoUploadText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  photoUploadHint: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
