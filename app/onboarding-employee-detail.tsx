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
  Modal,
  Linking,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft, Save, CheckCircle, Clock, User, Phone, Mail, Briefcase, Paperclip, ImageIcon, FileText, X, ChevronDown, ChevronUp, Calendar, CreditCard, Globe, QrCode } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Employee, Attachment } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { COUNTRIES } from '@/constants/countries';
import { Colors } from '@/constants/colors';


export default function OnboardingEmployeeDetailScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { employeeId } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
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
  const [isBasicInfoExpanded, setIsBasicInfoExpanded] = useState(false);
  const [isExpiryDatesExpanded, setIsExpiryDatesExpanded] = useState(false);
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
  const [isInductionExpanded, setIsInductionExpanded] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState<'medical' | 'license' | 'competency' | 'pdp' | 'induction' | null>(null);
  const [tempDate, setTempDate] = useState(new Date());

  const loadEmployee = useCallback(async () => {
    if (!employeeId || typeof employeeId !== 'string') return;

    try {
      setIsLoading(true);
      const employeeRef = doc(db, 'employees', employeeId);
      const employeeDoc = await getDoc(employeeRef);

      if (employeeDoc.exists()) {
        const data = employeeDoc.data() as Employee;
        setEmployee({ id: employeeDoc.id, ...data });
        setName(data.name || '');
        setRole(data.role || '');
        setContact(data.contact || '');
        setEmail(data.email || '');
        setEmployeeIdNumber(data.employeeIdNumber || '');
        setCitizenshipCountry(data.citizenshipCountry || '');
        setMedicalExpiryDate(data.medicalExpiryDate ? data.medicalExpiryDate.toDate() : undefined);
        setLicenseExpiryDate(data.licenseExpiryDate ? data.licenseExpiryDate.toDate() : undefined);
        setCompetencyExpiryDate(data.competencyExpiryDate ? data.competencyExpiryDate.toDate() : undefined);
        setPdpExpiryDate(data.pdpExpiryDate ? data.pdpExpiryDate.toDate() : undefined);
        setInductionStatus(data.inductionStatus || false);
        setInductionDate(data.inductionDate ? data.inductionDate.toDate() : undefined);
        setInductionNotes(data.inductionNotes || '');
        setAttachments(data.attachments || []);
      } else {
        Alert.alert('Error', 'Employee not found');
        router.back();
      }
    } catch (error) {
      console.error('[EmployeeDetail] Error loading employee:', error);
      Alert.alert('Error', 'Failed to load employee details');
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

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
        Linking.openURL(attachment.downloadUrl).catch((err: Error) => {
          console.error('[EmployeeDetail] Error opening document:', err);
          Alert.alert('Error', 'Failed to open document');
        });
      }
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const eventType = event?.type;
    
    if (Platform.OS === 'android') {
      setShowDatePicker(null);
      
      if (eventType === 'dismissed' || !selectedDate) {
        return;
      }
    }
    
    if (selectedDate && showDatePicker) {
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
      
      if (Platform.OS === 'ios') {
        setShowDatePicker(null);
      }
    }
  };

  const openDatePicker = (type: 'medical' | 'license' | 'competency' | 'pdp' | 'induction', currentDate?: Date) => {
    setTempDate(currentDate || new Date());
    setShowDatePicker(type);
  };

  const handleSave = async () => {
    if (!employeeId || typeof employeeId !== 'string' || !user) return;

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter employee name');
      return;
    }

    if (!role.trim()) {
      Alert.alert('Validation Error', 'Please enter employee role');
      return;
    }

    if (!contact.trim()) {
      Alert.alert('Validation Error', 'Please enter contact number');
      return;
    }

    if (!employeeIdNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter employee ID number');
      return;
    }

    if (!citizenshipCountry.trim()) {
      Alert.alert('Validation Error', 'Please select citizenship country');
      return;
    }

    if (citizenshipCountry === 'South Africa' && employeeIdNumber.trim().length !== 13) {
      Alert.alert('Validation Error', 'South African ID number must be exactly 13 digits');
      return;
    }

    if (citizenshipCountry === 'South Africa' && !/^\d+$/.test(employeeIdNumber.trim())) {
      Alert.alert('Validation Error', 'South African ID number must contain only digits');
      return;
    }

    try {
      setIsSaving(true);
      const employeeRef = doc(db, 'employees', employeeId);

      const updateData: any = {
        name: name.trim(),
        role: role.trim(),
        contact: contact.trim(),
        email: email.trim() || null,
        employeeIdNumber: employeeIdNumber.trim(),
        citizenshipCountry: citizenshipCountry.trim(),
        inductionStatus,
        inductionNotes: inductionNotes.trim(),
        attachments,
        updatedAt: serverTimestamp(),
      };

      if (medicalExpiryDate) {
        updateData.medicalExpiryDate = Timestamp.fromDate(medicalExpiryDate);
      } else {
        updateData.medicalExpiryDate = null;
      }

      if (licenseExpiryDate) {
        updateData.licenseExpiryDate = Timestamp.fromDate(licenseExpiryDate);
      } else {
        updateData.licenseExpiryDate = null;
      }

      if (competencyExpiryDate) {
        updateData.competencyExpiryDate = Timestamp.fromDate(competencyExpiryDate);
      } else {
        updateData.competencyExpiryDate = null;
      }

      if (pdpExpiryDate) {
        updateData.pdpExpiryDate = Timestamp.fromDate(pdpExpiryDate);
      } else {
        updateData.pdpExpiryDate = null;
      }

      if (inductionDate) {
        updateData.inductionDate = Timestamp.fromDate(inductionDate);
      } else if (inductionStatus && !employee?.inductionStatus) {
        updateData.inductionDate = serverTimestamp();
      } else if (!inductionStatus) {
        updateData.inductionDate = null;
      }

      await updateDoc(employeeRef, updateData);

      Alert.alert('Success', 'Employee details updated successfully');
      router.back();
    } catch (error) {
      console.error('[EmployeeDetail] Error updating employee:', error);
      Alert.alert('Error', 'Failed to update employee details');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !employee) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
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
          disabled={isSaving}
        >
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employee Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push({
              pathname: '/generate-qr',
              params: { userId: employeeId, userName: employee.name }
            })}
            disabled={isSaving}
          >
            <QrCode size={24} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
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
            {employee.inductionStatus ? (
              <View style={styles.statusHeaderSuccess}>
                <CheckCircle size={24} color="#10b981" />
                <Text style={styles.statusTitleSuccess}>Induction Completed</Text>
              </View>
            ) : (
              <View style={styles.statusHeaderWarning}>
                <Clock size={24} color="#f59e0b" />
                <Text style={styles.statusTitleWarning}>Induction Pending</Text>
              </View>
            )}
            {employee.inductionDate && (
              <Text style={styles.statusDate}>
                Completed on: {new Date(employee.inductionDate.toDate()).toLocaleDateString()}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.expandableCard}
            onPress={() => setIsBasicInfoExpanded(!isBasicInfoExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.expandableHeader}>
              <Text style={styles.expandableTitle}>Basic Information</Text>
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
                  <User size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Name</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter employee name"
                  value={name}
                  onChangeText={setName}
                  editable={!isSaving}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Briefcase size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Role</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter employee role"
                  value={role}
                  onChangeText={setRole}
                  editable={!isSaving}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Phone size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Contact</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter contact number"
                  value={contact}
                  onChangeText={setContact}
                  keyboardType="phone-pad"
                  editable={!isSaving}
                />
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

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Globe size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Citizenship Country</Text>
                </View>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowCountryDropdown(!showCountryDropdown)}
                  disabled={isSaving}
                >
                  <Text style={citizenshipCountry ? styles.inputText : styles.inputTextPlaceholder}>
                    {citizenshipCountry || 'Select citizenship country'}
                  </Text>
                </TouchableOpacity>
                {showCountryDropdown && (
                  <View style={styles.dropdown}>
                    <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                      {COUNTRIES.map((country) => (
                        <TouchableOpacity
                          key={country}
                          style={styles.dropdownOption}
                          onPress={() => {
                            setCitizenshipCountry(country);
                            setShowCountryDropdown(false);
                          }}
                        >
                          <Text style={citizenshipCountry === country ? styles.dropdownOptionTextSelected : styles.dropdownOptionText}>
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
                  <CreditCard size={18} color="#64748b" />
                  <Text style={styles.inputLabelText}>Employee ID Number</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={citizenshipCountry === 'South Africa' ? 'Enter 13-digit ID number' : 'Enter ID number'}
                  value={employeeIdNumber}
                  onChangeText={setEmployeeIdNumber}
                  keyboardType={citizenshipCountry === 'South Africa' ? 'numeric' : 'default'}
                  maxLength={citizenshipCountry === 'South Africa' ? 13 : undefined}
                  editable={!isSaving}
                />
                {citizenshipCountry === 'South Africa' && (
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
                          {attachment.fileType === 'image' ? 'Tap to view' : 'Tap to open'}
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
                    Toggle if induction is complete
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
            </View>
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

      {showDatePicker && (
        Platform.OS === 'ios' ? (
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
                  <TouchableOpacity onPress={() => handleDateChange(null, tempDate)}>
                    <Text style={styles.datePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setTempDate(date);
                  }}
                  style={styles.datePickerIOS}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )
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
    gap: 8,
  },
  headerButton: {
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
    gap: 20,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
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
  removeButton: {
    padding: 4,
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
  inputText: {
    fontSize: 15,
    color: '#000000',
  },
  inputTextPlaceholder: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  dropdown: {
    backgroundColor: Colors.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 200,
    marginTop: 8,
  },
  dropdownList: {
    maxHeight: 180,
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownOptionText: {
    fontSize: 15,
    color: '#000000',
  },
  dropdownOptionTextSelected: {
    fontSize: 15,
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  fieldHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
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
});
