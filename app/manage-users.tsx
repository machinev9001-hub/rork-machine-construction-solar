import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { ArrowLeft, Plus, Search, ChevronDown, ChevronUp, X, Filter, RefreshCw, Edit, Trash2, Lock, Unlock, QrCode, Share2 } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { SubContractorUser } from '@/types';
import { SvgXml } from 'react-native-svg';
import QRCodeGenerator from 'qrcode';
import * as Sharing from 'expo-sharing';

export default function ManageUsersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<SubContractorUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<SubContractorUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [userToDelete, setUserToDelete] = useState<SubContractorUser | null>(null);
  const [isPinVerifying, setIsPinVerifying] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedUserForQR, setSelectedUserForQR] = useState<SubContractorUser | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');

  const loadUsers = useCallback(async () => {
    if (!user?.siteId) return;

    try {
      setIsLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('siteId', '==', user.siteId));
      const querySnapshot = await getDocs(q);

      const loadedUsers: SubContractorUser[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role !== 'master') {
          loadedUsers.push({
            id: doc.id,
            ...data,
          } as SubContractorUser);
        }
      });

      setUsers(loadedUsers);
      setFilteredUsers(loadedUsers);
    } catch (error) {
      console.error('[ManageUsers] Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [user?.siteId]);

  useFocusEffect(
    useCallback(() => {
      console.log('[ManageUsers] Screen focused, reloading users');
      loadUsers();
    }, [loadUsers])
  );

  useEffect(() => {
    let filtered = [...users];

    if (selectedRoleFilter) {
      filtered = filtered.filter((u) => u.role === selectedRoleFilter);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((u) => {
        const normalizedUserId = u.userId.toLowerCase();
        const normalizedUserName = u.userName ? u.userName.toLowerCase() : '';
        const normalizedSubContractorName = u.subContractorName ? u.subContractorName.toLowerCase() : '';
        const normalizedLegalEntityName = u.legalEntityName ? u.legalEntityName.toLowerCase() : '';
        const normalizedCompanyRegistrationNr = u.companyRegistrationNr ? u.companyRegistrationNr.toLowerCase() : '';
        const normalizedAdminEmail = u.adminEmail ? u.adminEmail.toLowerCase() : '';

        return (
          normalizedUserId.includes(query) ||
          normalizedUserName.includes(query) ||
          normalizedSubContractorName.includes(query) ||
          normalizedLegalEntityName.includes(query) ||
          normalizedCompanyRegistrationNr.includes(query) ||
          normalizedAdminEmail.includes(query)
        );
      });
    }

    setFilteredUsers(filtered);
  }, [searchQuery, users, selectedRoleFilter]);

  const toggleExpanded = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };



  const handleAddUser = () => {
    router.push('/add-user' as any);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUsers();
    setIsRefreshing(false);
  };

  const handleToggleLock = async (userToToggle: SubContractorUser) => {
    const newLockState = !userToToggle.isLocked;
    const action = newLockState ? 'lock' : 'unlock';
    
    Alert.alert(
      `${newLockState ? 'Lock' : 'Unlock'} User`,
      `Are you sure you want to ${action} ${userToToggle.subContractorName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: newLockState ? 'Lock' : 'Unlock',
          onPress: async () => {
            try {
              const userRef = doc(db, 'users', userToToggle.id);
              await updateDoc(userRef, { isLocked: newLockState });
              Alert.alert('Success', `User ${action}ed successfully`);
              await loadUsers();
            } catch (error) {
              console.error('[ManageUsers] Error toggling lock:', error);
              Alert.alert('Error', `Failed to ${action} user`);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteUser = async (selectedUser: SubContractorUser) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${selectedUser.subContractorName}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: () => {
            setUserToDelete(selectedUser);
            setShowPinModal(true);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handlePinVerificationForDelete = async () => {
    if (!userToDelete) return;
    if (!pinInput.trim()) {
      Alert.alert('Error', 'Please enter your PIN');
      return;
    }

    setIsPinVerifying(true);

    try {
      const currentUserPin = user?.pin;
      if (!currentUserPin) {
        Alert.alert('Error', 'Unable to verify PIN');
        return;
      }

      if (pinInput.trim() !== currentUserPin.trim()) {
        Alert.alert('Error', 'Incorrect PIN');
        setIsPinVerifying(false);
        return;
      }

      await deleteDoc(doc(db, 'users', userToDelete.id));
      Alert.alert('Success', 'User deleted successfully');
      setShowPinModal(false);
      setPinInput('');
      setUserToDelete(null);
      await loadUsers();
    } catch (error) {
      console.error('[ManageUsers] Error deleting user:', error);
      Alert.alert('Error', 'Failed to delete user');
    } finally {
      setIsPinVerifying(false);
    }
  };

  const handleCancelPinModal = () => {
    setShowPinModal(false);
    setPinInput('');
    setUserToDelete(null);
  };

  const handleShowQR = async (userItem: SubContractorUser) => {
    console.log('[ManageUsers] Generating QR for user ID:', userItem.id);
    setSelectedUserForQR(userItem);
    setShowQRModal(true);

    try {
      const qrData = `user/${userItem.id}`;
      console.log('[ManageUsers] QR data format:', qrData);

      const svgString = await QRCodeGenerator.toString(qrData, {
        type: 'svg',
        width: 240,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff',
        },
      });

      setQrSvg(svgString);
    } catch (error) {
      console.error('[ManageUsers] Error generating QR:', error);
      Alert.alert('Error', 'Failed to generate QR code');
    }
  };

  const handleShareQR = async () => {
    if (!selectedUserForQR || !qrSvg) return;

    try {
      const qrData = `user/${selectedUserForQR.id}`;
      
      if (Platform.OS === 'web') {
        const canvas = document.createElement('canvas');

        await QRCodeGenerator.toCanvas(canvas, qrData, {
          width: 400,
          margin: 2,
        });

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `QR_${selectedUserForQR.subContractorName.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            Alert.alert('Success', 'QR code downloaded');
          }
        });
      } else {
        await QRCodeGenerator.toDataURL(qrData, {
          width: 400,
          margin: 2,
        });

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          Alert.alert(
            'Share QR Code',
            'QR code sharing on mobile requires saving to a file first. This feature will be enhanced in a future update.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
    } catch (error) {
      console.error('[ManageUsers] Error sharing QR:', error);
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setSelectedUserForQR(null);
    setQrSvg('');
  };

  const uniqueRoles = Array.from(new Set(users.map((u) => u.role))).sort();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#3b82f6" />
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
        <Text style={styles.headerTitle}>Manage Users</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddUser}
        >
          <Plus size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, ID, email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterBar}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.7}
          >
            <Filter size={16} color={showFilters ? "#3b82f6" : "#64748b"} />
            <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>
              Filters {selectedRoleFilter ? '(1)' : ''}
            </Text>
            <ChevronDown size={16} color={showFilters ? "#3b82f6" : "#64748b"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            <RefreshCw
              size={16}
              color="#64748b"
              style={isRefreshing ? styles.rotating : undefined}
            />
          </TouchableOpacity>

          <Text style={styles.resultCount}>
            {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
          </Text>
        </View>

        {showFilters && (
          <View style={styles.filterPanel}>
            <Text style={styles.filterTitle}>User Role</Text>
            <View style={styles.filterChips}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedRoleFilter === null && styles.filterChipActive,
                ]}
                onPress={() => setSelectedRoleFilter(null)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedRoleFilter === null && styles.filterChipTextActive,
                  ]}
                >
                  All Roles
                </Text>
              </TouchableOpacity>
              {uniqueRoles.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.filterChip,
                    selectedRoleFilter === role && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedRoleFilter(role === selectedRoleFilter ? null : role)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedRoleFilter === role && styles.filterChipTextActive,
                    ]}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <ScrollView style={styles.usersList} contentContainerStyle={styles.usersListContent}>
          {filteredUsers.map((userItem) => {
            const isExpanded = expandedUserId === userItem.id;
            const trimmedUserName = userItem.userName ? userItem.userName.trim() : '';
            const displayUserName = trimmedUserName.length > 0 ? trimmedUserName : userItem.subContractorName;
            
            return (
              <View key={userItem.id} style={styles.userCard}>
                <TouchableOpacity
                  style={styles.userCardHeader}
                  onPress={() => toggleExpanded(userItem.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.userHeaderContent}>
                    <View style={styles.userMainInfo}>
                      <View style={styles.userNameRow}>
                        <Text style={styles.userName}>{userItem.subContractorName}</Text>
                        {userItem.isLocked && (
                          <View style={styles.lockBadge}>
                            <Lock size={12} color="#ef4444" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.userMeta}>User: {displayUserName}</Text>
                    </View>
                    <View style={styles.userHeaderActions}>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>{userItem.role}</Text>
                      </View>
                      {isExpanded ? (
                        <ChevronUp size={20} color="#64748b" />
                      ) : (
                        <ChevronDown size={20} color="#64748b" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.userDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Legal Entity</Text>
                      <Text style={styles.detailValue}>{userItem.legalEntityName || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Contact Nr</Text>
                      <Text style={styles.detailValue}>{userItem.directPersonalContactNr || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Admin Contact</Text>
                      <Text style={styles.detailValue}>{userItem.adminContact || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Admin Email</Text>
                      <Text style={styles.detailValue}>{userItem.adminEmail || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Registration Nr</Text>
                      <Text style={styles.detailValue}>{userItem.companyRegistrationNr || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>VAT Nr</Text>
                      <Text style={styles.detailValue}>{userItem.vatNr || '-'}</Text>
                    </View>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.qrButton}
                        onPress={() => handleShowQR(userItem)}
                      >
                        <QrCode size={18} color="#3b82f6" />
                        <Text style={styles.qrButtonText}>QR Code</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => router.push(`/edit-user?userId=${userItem.id}` as any)}
                      >
                        <Edit size={18} color="#10b981" />
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={userItem.isLocked ? styles.unlockButton : styles.lockButton}
                        onPress={() => handleToggleLock(userItem)}
                      >
                        {userItem.isLocked ? (
                          <Unlock size={18} color="#f59e0b" />
                        ) : (
                          <Lock size={18} color="#6b7280" />
                        )}
                        <Text style={userItem.isLocked ? styles.unlockButtonText : styles.lockButtonText}>
                          {userItem.isLocked ? 'Unlock' : 'Lock'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteUser(userItem)}
                      >
                        <Trash2 size={18} color="#ef4444" />
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      <Modal
        visible={showPinModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelPinModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify PIN</Text>
              <TouchableOpacity onPress={handleCancelPinModal} style={styles.closeButton}>
                <X size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>

            <View style={styles.pinVerificationContainer}>
              <Text style={styles.pinVerificationText}>
                Enter your PIN to confirm deletion of:
              </Text>
              <Text style={styles.pinVerificationUserName}>
                {userToDelete?.subContractorName}
              </Text>
              
              <TextInput
                style={styles.pinInput}
                placeholder="Enter PIN"
                value={pinInput}
                onChangeText={setPinInput}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                editable={!isPinVerifying}
                autoFocus
              />

              <View style={styles.pinModalButtons}>
                <TouchableOpacity
                  style={styles.pinCancelButton}
                  onPress={handleCancelPinModal}
                  disabled={isPinVerifying}
                >
                  <Text style={styles.pinCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pinConfirmButton, isPinVerifying && styles.pinConfirmButtonDisabled]}
                  onPress={handlePinVerificationForDelete}
                  disabled={isPinVerifying}
                >
                  {isPinVerifying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.pinConfirmButtonText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showQRModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseQRModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User QR Code</Text>
              <TouchableOpacity onPress={handleCloseQRModal} style={styles.closeButton}>
                <X size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>

            <View style={styles.qrModalBody}>
              {selectedUserForQR && (
                <>
                  <Text style={styles.qrUserName}>{selectedUserForQR.subContractorName}</Text>
                  <Text style={styles.qrUserRole}>{selectedUserForQR.role}</Text>
                  <Text style={styles.qrUserId}>ID: {selectedUserForQR.userId}</Text>

                  <View style={styles.qrCodeDisplay}>
                    {qrSvg ? (
                      <SvgXml xml={qrSvg} width={240} height={240} />
                    ) : (
                      <ActivityIndicator size="large" color="#3b82f6" />
                    )}
                  </View>

                  <Text style={styles.qrInstruction}>
                    Scan this QR code to quickly access login credentials
                  </Text>

                  <TouchableOpacity
                    style={styles.shareQRButton}
                    onPress={handleShareQR}
                  >
                    <Share2 size={20} color="#fff" />
                    <Text style={styles.shareQRButtonText}>
                      {Platform.OS === 'web' ? 'Download QR Code' : 'Share QR Code'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
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
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
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
  addButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  resultCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600' as const,
  },
  usersList: {
    flex: 1,
    marginTop: 8,
  },
  usersListContent: {
    gap: 12,
    paddingBottom: 16,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  userCardHeader: {
    padding: 16,
  },
  userHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userMainInfo: {
    flex: 1,
    gap: 4,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockBadge: {
    backgroundColor: '#fee2e2',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  userMeta: {
    fontSize: 13,
    color: '#64748b',
  },
  userHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  userDetails: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '500' as const,
    flex: 2,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d1fae5',
    paddingVertical: 12,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#10b981',
  },

  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ef4444',
  },
  lockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  lockButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6b7280',
  },
  unlockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    borderRadius: 8,
  },
  unlockButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#f59e0b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  filterButtonTextActive: {
    color: '#3b82f6',
  },
  refreshButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rotating: {
    transform: [{ rotate: '360deg' }],
  },
  filterPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 4,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  filterChipText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  filterChipTextActive: {
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  pinVerificationContainer: {
    padding: 24,
    gap: 16,
  },
  pinVerificationText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  pinVerificationUserName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  pinInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlign: 'center',
    letterSpacing: 8,
  },
  pinModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  pinCancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  pinCancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  pinConfirmButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  pinConfirmButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  pinConfirmButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  qrButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    paddingVertical: 12,
    borderRadius: 8,
  },
  qrButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  qrModalBody: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  qrUserName: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#1e293b',
    textAlign: 'center',
  },
  qrUserRole: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#3b82f6',
    textAlign: 'center',
  },
  qrUserId: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  qrCodeDisplay: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  qrInstruction: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  shareQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  shareQRButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
