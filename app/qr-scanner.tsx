import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Camera } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getCachedEmployeeWithUser, handleOfflineEmployeeAccess } from '@/utils/employeeCache';
import { getCachedUserById } from '@/utils/userCache';
import NetInfo from '@react-native-community/netinfo';
import { isManagementRole, isOperatorRole, isDieselClerkRole } from '@/utils/roles';

type ScanContext = 'login' | 'hse' | 'admin' | 'plant' | 'diesel-clerk';

export default function QRScannerScreen() {
  const { context } = useLocalSearchParams<{ context?: ScanContext }>();
  const { user, loginWithId } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [scannedUserId, setScannedUserId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [scannedUserRole, setScannedUserRole] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);



  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.permissionContainer}>
          <Camera size={64} color="#94a3b8" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need access to your camera to scan QR codes
          </Text>
          <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
            <Text style={styles.grantButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);

    try {
      if (context === 'plant' || context === 'diesel-clerk') {
        console.log('[QRScanner] Plant/Diesel context - raw QR data:', data);
        let plantAssetId = data;
        
        if (data.includes('/')) {
          const parts = data.split('/');
          plantAssetId = parts[parts.length - 1];
          console.log('[QRScanner] Extracted asset ID from path:', plantAssetId);
        }
        
        plantAssetId = plantAssetId.trim();
        console.log('[QRScanner] Final trimmed asset ID:', plantAssetId);
        
        if (!plantAssetId) {
          console.error('[QRScanner] Empty plant asset ID after processing');
          Alert.alert('Error', 'Invalid plant asset QR code', [
            { text: 'OK', onPress: () => { setScanned(false); setIsProcessing(false); } }
          ]);
          return;
        }
        
        if (context === 'diesel-clerk') {
          console.log('[QRScanner] Navigating to diesel-clerk-fuel-log with ID:', plantAssetId);
          setIsProcessing(false);
          router.replace({
            pathname: '/diesel-clerk-fuel-log',
            params: { plantAssetId }
          });
          return;
        }
        
        console.log('[QRScanner] Navigating to plant-asset-actions with ID:', plantAssetId);
        setIsProcessing(false);
        router.replace({
          pathname: '/plant-asset-actions',
          params: { plantAssetId }
        });
        return;
      }

      const userId = data.replace('user/', '').trim();

      // Check network status
      const netInfo = await NetInfo.fetch();
      const isOffline = !netInfo.isConnected || !netInfo.isInternetReachable;
      
      let fetchedUserData;
      let actualUserId = userId;
      let isEmployee = false;
      
      if (isOffline) {
        // For HR/Master users accessing employee data offline
        if (context === 'hse' || context === 'admin') {
          const offlineResult = await handleOfflineEmployeeAccess(userId, user?.role);
          
          if (!offlineResult.success) {
            Alert.alert('Offline Access Error', offlineResult.error || 'Cannot access employee data offline', [
              { text: 'OK', onPress: () => { setScanned(false); setIsProcessing(false); } }
            ]);
            return;
          }
          
          fetchedUserData = offlineResult.user || offlineResult.employee;
          if (offlineResult.user) {
            actualUserId = offlineResult.user.id;
          }
        } else {
          // For login context, check cached user/employee
          const { employee, user: cachedUser } = await getCachedEmployeeWithUser(userId);
          
          if (cachedUser) {
            fetchedUserData = cachedUser;
            actualUserId = cachedUser.id;
          } else if (employee) {
            fetchedUserData = employee;
            isEmployee = true;
          } else {
            // Try direct user cache
            const directUser = await getCachedUserById(userId);
            if (directUser) {
              fetchedUserData = directUser;
              actualUserId = directUser.id;
            } else {
              Alert.alert('Offline Error', 'User not found in offline cache. Please sync when online.', [
                { text: 'OK', onPress: () => { setScanned(false); setIsProcessing(false); } }
              ]);
              return;
            }
          }
        }
      } else {
        // Online mode - fetch from Firestore
        let userDoc = await getDoc(doc(db, 'users', userId));
        
        if (!userDoc.exists()) {
          // Try to find as an employee
          const employeeDoc = await getDoc(doc(db, 'employees', userId));
          if (!employeeDoc.exists()) {
            Alert.alert('Error', 'User not found', [
              { text: 'OK', onPress: () => { setScanned(false); setIsProcessing(false); } }
            ]);
            return;
          }
          
          const employeeData = employeeDoc.data();
          isEmployee = true;
          
          // Check if employee has a linked user account
          if (employeeData?.linkedUserId) {
            console.log('[QRScanner] Employee has linked user ID:', employeeData.linkedUserId);
            const linkedUserDoc = await getDoc(doc(db, 'users', employeeData.linkedUserId));
            
            if (linkedUserDoc.exists()) {
              userDoc = linkedUserDoc;
              fetchedUserData = linkedUserDoc.data();
              actualUserId = employeeData.linkedUserId;
              isEmployee = false;
            } else {
              fetchedUserData = employeeData;
            }
          } else {
            fetchedUserData = employeeData;
          }
        } else {
          fetchedUserData = userDoc.data();
        }
      }

      const scannedRole = fetchedUserData?.role || fetchedUserData?.linkedUserRole || 'Operator';
      setUserData(fetchedUserData);
      
      const hasPinSetup = (!!fetchedUserData?.pin && fetchedUserData.pin.trim().length > 0) || !!fetchedUserData?.pinSalt;

      if (context === 'login') {
        if (!hasPinSetup) {
          setIsProcessing(false);
          router.replace({
            pathname: '/setup-employee-pin',
            params: { 
              userId: actualUserId,
              userName: fetchedUserData?.name || 'Unknown',
              userRole: scannedRole,
              isUserAccount: isEmployee ? 'false' : 'true'
            }
          });
          return;
        }
        
        const loginIdentifier = fetchedUserData?.employeeIdNumber || actualUserId;
        setScannedUserId(loginIdentifier);
        setScannedUserRole(scannedRole);
        setShowPinModal(true);
        setIsProcessing(false);
        return;
      }

      if (context === 'hse' && (user?.role === 'HSE' || user?.role === 'HR' || user?.role === 'master')) {
        router.replace({
          pathname: '/onboarding-employee-detail',
          params: { 
            employeeId: userId,
            isOffline: isOffline ? 'true' : 'false'
          }
        });
        return;
      }

      if (context === 'admin' && (user?.role === 'master' || user?.role === 'HR')) {
        router.replace({
          pathname: '/edit-user',
          params: { 
            userId: actualUserId,
            isOffline: isOffline ? 'true' : 'false'
          }
        });
        return;
      }

      Alert.alert(
        'Access Denied',
        'You do not have permission to access this user\'s information',
        [{ text: 'OK', onPress: () => { setScanned(false); setIsProcessing(false); } }]
      );

    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to process QR code', [
        { text: 'OK', onPress: () => { setScanned(false); setIsProcessing(false); } }
      ]);
    }
  };

  const handlePinSubmit = async () => {
    if (!pin.trim()) {
      Alert.alert('Error', 'Please enter your PIN');
      return;
    }

    try {
      setIsProcessing(true);
      
      const result = await loginWithId(scannedUserId, pin);
      
      if (result.success && result.user) {
        setShowPinModal(false);
        setPin('');
        setIsProcessing(false);
        
        const isManagement = isManagementRole(result.user.role);
        const isOperator = isOperatorRole(result.user.role);
        const isDieselClerk = isDieselClerkRole(result.user.role);
        const destination = isManagement ? '/(tabs)' : isOperator ? '/operator-home' : isDieselClerk ? '/diesel-clerk-home' : '/employee-timesheet';
        router.replace(destination as any);
        return;
      } else if (result.isFirstTime) {
        setShowPinModal(false);
        setPin('');
        setIsProcessing(false);
        router.replace({
          pathname: '/setup-employee-pin',
          params: { 
            userId: scannedUserId,
            userName: userData?.name || 'Unknown',
            userRole: scannedUserRole,
            isUserAccount: userData?.linkedUserId ? 'true' : 'false'
          }
        });
        return;
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid PIN');
        setPin('');
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error('[QRScanner] PIN submit error:', error);
      Alert.alert('Error', 'Failed to login');
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setShowPinModal(false);
    setScannedUserId('');
    setScannedUserRole('');
    setPin('');
    setScanned(false);
    setIsProcessing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          
          <View style={styles.instructionContainer}>
            <Text style={styles.instruction}>
              {context === 'login' && 'Scan your personal QR code to login'}
              {context === 'hse' && 'Scan employee QR code to view profile'}
              {context === 'admin' && 'Scan user QR code to manage account'}
              {context === 'plant' && 'Scan plant asset QR code'}
              {context === 'diesel-clerk' && 'Scan plant asset to log fuel'}
              {!context && 'Position the QR code within the frame'}
            </Text>
          </View>
        </View>
      </CameraView>

      {scanned && (
        <TouchableOpacity
          style={styles.rescanButton}
          onPress={() => setScanned(false)}
        >
          <Text style={styles.rescanText}>Tap to Scan Again</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={showPinModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Your PIN</Text>
            <Text style={styles.modalSubtitle}>
              Role: {scannedUserRole}
            </Text>
            
            <TextInput
              style={styles.pinInput}
              placeholder="Enter 4-6 digit PIN"
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              autoFocus
              editable={!isProcessing}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleCancel}
                disabled={isProcessing}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handlePinSubmit}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonTextConfirm}>Login</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#1e293b',
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
  },
  grantButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  grantButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#64748b',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#3b82f6',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
  },
  instruction: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    borderRadius: 8,
  },
  rescanButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rescanText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#1e293b',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  pinInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f1f5f9',
  },
  modalButtonConfirm: {
    backgroundColor: '#3b82f6',
  },
  modalButtonTextCancel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  modalButtonTextConfirm: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
