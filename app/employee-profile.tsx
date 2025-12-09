import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { ArrowLeft, User, Phone, Mail, Briefcase, CreditCard, Globe, Calendar, CheckCircle, Clock, FileText, ImageIcon, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Employee, Attachment } from '@/types';

export default function EmployeeProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isExpiryDatesExpanded, setIsExpiryDatesExpanded] = useState(false);
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
  const [isInductionExpanded, setIsInductionExpanded] = useState(false);

  useEffect(() => {
    loadEmployeeData();
  }, [user?.userId]);

  const loadEmployeeData = async () => {
    if (!user?.userId) return;

    try {
      setIsLoading(true);
      const employeeRef = doc(db, 'employees', user.userId);
      const employeeDoc = await getDoc(employeeRef);

      if (employeeDoc.exists()) {
        const data = employeeDoc.data() as Employee;
        setEmployee({ id: employeeDoc.id, ...data });
      }
    } catch (error) {
      console.error('[EmployeeProfile] Error loading employee data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAttachment = (attachment: Attachment) => {
    if (attachment.fileType === 'image') {
      setSelectedImage(attachment.downloadUrl);
    } else if (attachment.fileType === 'document') {
      if (Platform.OS === 'web') {
        window.open(attachment.downloadUrl, '_blank');
      } else {
        Linking.openURL(attachment.downloadUrl).catch((err: Error) => {
          console.error('[EmployeeProfile] Error opening document:', err);
        });
      }
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Not set';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  const isExpiringSoon = (timestamp: any) => {
    if (!timestamp) return false;
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const daysUntilExpiry = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 25 && daysUntilExpiry >= 0;
    } catch (error) {
      return false;
    }
  };

  const isExpired = (timestamp: any) => {
    if (!timestamp) return false;
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.getTime() < Date.now();
    } catch (error) {
      return false;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  if (!employee) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.emptyContainer}>
          <User size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>Profile not found</Text>
          <Text style={styles.emptySubtext}>
            Your employee profile could not be loaded.
          </Text>
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
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <User size={48} color="#3b82f6" />
          </View>
          <Text style={styles.profileName}>{employee.name}</Text>
          <Text style={styles.profileRole}>{employee.role}</Text>
        </View>

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
              Completed on: {formatDate(employee.inductionDate)}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <User size={18} color="#64748b" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{employee.name}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Briefcase size={18} color="#64748b" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={styles.infoValue}>{employee.role}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Phone size={18} color="#64748b" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Contact</Text>
                <Text style={styles.infoValue}>{employee.contact}</Text>
              </View>
            </View>

            {employee.email && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Mail size={18} color="#64748b" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{employee.email}</Text>
                </View>
              </View>
            )}

            {employee.citizenshipCountry && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Globe size={18} color="#64748b" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Citizenship</Text>
                  <Text style={styles.infoValue}>{employee.citizenshipCountry}</Text>
                </View>
              </View>
            )}

            {employee.employeeIdNumber && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <CreditCard size={18} color="#64748b" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Employee ID Number</Text>
                  <Text style={styles.infoValue}>{employee.employeeIdNumber}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.expandableCard}
          onPress={() => setIsExpiryDatesExpanded(!isExpiryDatesExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.expandableHeader}>
            <Text style={styles.expandableTitle}>Certifications & Expiry Dates</Text>
            {isExpiryDatesExpanded ? (
              <ChevronUp size={24} color="#64748b" />
            ) : (
              <ChevronDown size={24} color="#64748b" />
            )}
          </View>
        </TouchableOpacity>

        {isExpiryDatesExpanded && (
          <View style={styles.expandableContent}>
            {employee.medicalExpiryDate && (
              <View style={styles.expiryRow}>
                <View style={styles.expiryIcon}>
                  <Calendar size={18} color="#64748b" />
                </View>
                <View style={styles.expiryContent}>
                  <Text style={styles.expiryLabel}>Medical Expiry Date</Text>
                  <Text style={[
                    styles.expiryValue,
                    isExpired(employee.medicalExpiryDate) && styles.expiryExpired,
                    isExpiringSoon(employee.medicalExpiryDate) && styles.expiryWarning,
                  ]}>
                    {formatDate(employee.medicalExpiryDate)}
                  </Text>
                </View>
                {isExpired(employee.medicalExpiryDate) && (
                  <View style={styles.expiredBadge}>
                    <Text style={styles.expiredBadgeText}>EXPIRED</Text>
                  </View>
                )}
                {!isExpired(employee.medicalExpiryDate) && isExpiringSoon(employee.medicalExpiryDate) && (
                  <View style={styles.warningSoon}>
                    <Text style={styles.warningSoonText}>SOON</Text>
                  </View>
                )}
              </View>
            )}

            {employee.licenseExpiryDate && (
              <View style={styles.expiryRow}>
                <View style={styles.expiryIcon}>
                  <Calendar size={18} color="#64748b" />
                </View>
                <View style={styles.expiryContent}>
                  <Text style={styles.expiryLabel}>License Expiry Date</Text>
                  <Text style={[
                    styles.expiryValue,
                    isExpired(employee.licenseExpiryDate) && styles.expiryExpired,
                    isExpiringSoon(employee.licenseExpiryDate) && styles.expiryWarning,
                  ]}>
                    {formatDate(employee.licenseExpiryDate)}
                  </Text>
                </View>
                {isExpired(employee.licenseExpiryDate) && (
                  <View style={styles.expiredBadge}>
                    <Text style={styles.expiredBadgeText}>EXPIRED</Text>
                  </View>
                )}
                {!isExpired(employee.licenseExpiryDate) && isExpiringSoon(employee.licenseExpiryDate) && (
                  <View style={styles.warningSoon}>
                    <Text style={styles.warningSoonText}>SOON</Text>
                  </View>
                )}
              </View>
            )}

            {employee.competencyExpiryDate && (
              <View style={styles.expiryRow}>
                <View style={styles.expiryIcon}>
                  <Calendar size={18} color="#64748b" />
                </View>
                <View style={styles.expiryContent}>
                  <Text style={styles.expiryLabel}>Competency Expiry Date</Text>
                  <Text style={[
                    styles.expiryValue,
                    isExpired(employee.competencyExpiryDate) && styles.expiryExpired,
                    isExpiringSoon(employee.competencyExpiryDate) && styles.expiryWarning,
                  ]}>
                    {formatDate(employee.competencyExpiryDate)}
                  </Text>
                </View>
                {isExpired(employee.competencyExpiryDate) && (
                  <View style={styles.expiredBadge}>
                    <Text style={styles.expiredBadgeText}>EXPIRED</Text>
                  </View>
                )}
                {!isExpired(employee.competencyExpiryDate) && isExpiringSoon(employee.competencyExpiryDate) && (
                  <View style={styles.warningSoon}>
                    <Text style={styles.warningSoonText}>SOON</Text>
                  </View>
                )}
              </View>
            )}

            {employee.pdpExpiryDate && (
              <View style={styles.expiryRow}>
                <View style={styles.expiryIcon}>
                  <Calendar size={18} color="#64748b" />
                </View>
                <View style={styles.expiryContent}>
                  <Text style={styles.expiryLabel}>PDP Expiry Date</Text>
                  <Text style={[
                    styles.expiryValue,
                    isExpired(employee.pdpExpiryDate) && styles.expiryExpired,
                    isExpiringSoon(employee.pdpExpiryDate) && styles.expiryWarning,
                  ]}>
                    {formatDate(employee.pdpExpiryDate)}
                  </Text>
                </View>
                {isExpired(employee.pdpExpiryDate) && (
                  <View style={styles.expiredBadge}>
                    <Text style={styles.expiredBadgeText}>EXPIRED</Text>
                  </View>
                )}
                {!isExpired(employee.pdpExpiryDate) && isExpiringSoon(employee.pdpExpiryDate) && (
                  <View style={styles.warningSoon}>
                    <Text style={styles.warningSoonText}>SOON</Text>
                  </View>
                )}
              </View>
            )}

            {!employee.medicalExpiryDate && !employee.licenseExpiryDate && 
             !employee.competencyExpiryDate && !employee.pdpExpiryDate && (
              <View style={styles.emptySection}>
                <Calendar size={32} color="#cbd5e1" />
                <Text style={styles.emptySectionText}>No certification dates recorded</Text>
              </View>
            )}
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
              {employee.attachments && employee.attachments.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{employee.attachments.length}</Text>
                </View>
              )}
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
            {employee.attachments && employee.attachments.length > 0 ? (
              <View style={styles.attachmentsList}>
                {employee.attachments.map((attachment) => (
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
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptySection}>
                <FileText size={32} color="#cbd5e1" />
                <Text style={styles.emptySectionText}>No documents attached</Text>
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
            <Text style={styles.expandableTitle}>Induction Details</Text>
            {isInductionExpanded ? (
              <ChevronUp size={24} color="#64748b" />
            ) : (
              <ChevronDown size={24} color="#64748b" />
            )}
          </View>
        </TouchableOpacity>

        {isInductionExpanded && (
          <View style={styles.expandableContent}>
            {employee.inductionDate && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Calendar size={18} color="#64748b" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Induction Date</Text>
                  <Text style={styles.infoValue}>{formatDate(employee.inductionDate)}</Text>
                </View>
              </View>
            )}

            {employee.inductionNotes && (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>Induction Notes</Text>
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{employee.inductionNotes}</Text>
                </View>
              </View>
            )}

            {!employee.inductionDate && !employee.inductionNotes && (
              <View style={styles.emptySection}>
                <Clock size={32} color="#cbd5e1" />
                <Text style={styles.emptySectionText}>No induction details recorded</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
    color: '#1e293b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  profileHeader: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1e293b',
    textAlign: 'center',
  },
  profileRole: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#64748b',
    marginLeft: 36,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
    paddingHorizontal: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500' as const,
  },
  expandableCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandableTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16,
    marginTop: 12,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  expiryIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiryContent: {
    flex: 1,
    gap: 4,
  },
  expiryLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  expiryValue: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500' as const,
  },
  expiryWarning: {
    color: '#f59e0b',
  },
  expiryExpired: {
    color: '#ef4444',
  },
  expiredBadge: {
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  expiredBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#ef4444',
  },
  warningSoon: {
    backgroundColor: '#fefce8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  warningSoonText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#f59e0b',
  },
  emptySection: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptySectionText: {
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
    color: '#1e293b',
  },
  attachmentMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  notesSection: {
    gap: 8,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notesText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
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
