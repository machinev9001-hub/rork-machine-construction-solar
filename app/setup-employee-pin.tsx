import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { isManagementRole } from '@/utils/roles';

export default function SetupEmployeePinScreen() {
  const { userId, userName, userRole, employeeIdNumber, isUserAccount } = useLocalSearchParams<{ 
    userId: string; 
    userName?: string;
    userRole?: string;
    employeeIdNumber?: string;
    isUserAccount?: string;
  }>();
  const { loginWithId } = useAuth();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const isSubmittingRef = useRef(false);

  console.log('[SetupEmployeePin] Params received:');
  console.log('[SetupEmployeePin]   userId (doc ID):', userId);
  console.log('[SetupEmployeePin]   employeeIdNumber:', employeeIdNumber);
  console.log('[SetupEmployeePin]   userName:', userName);
  console.log('[SetupEmployeePin]   userRole:', userRole);
  console.log('[SetupEmployeePin]   isUserAccount:', isUserAccount);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!userId || !db) return;
      
      try {
        const isUser = isUserAccount === 'true';
        console.log('[SetupEmployeePin] Fetching data for doc ID:', userId);
        console.log('[SetupEmployeePin] Looking in collection:', isUser ? 'users' : 'employees');
        
        const docRef = isUser 
          ? doc(db, 'users', userId)
          : doc(db, 'employees', userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setEmployeeData(data);
          console.log('[SetupEmployeePin] Data loaded:', {
            employeeIdNumber: data.employeeIdNumber,
            name: data.name,
            role: data.role,
            collection: isUser ? 'users' : 'employees'
          });
        } else {
          console.error('[SetupEmployeePin] Document not found in', isUser ? 'users' : 'employees', 'collection!');
          console.error('[SetupEmployeePin] Trying alternate collection...');
          
          const alternateRef = isUser 
            ? doc(db, 'employees', userId)
            : doc(db, 'users', userId);
          const alternateSnap = await getDoc(alternateRef);
          
          if (alternateSnap.exists()) {
            const data = alternateSnap.data();
            setEmployeeData(data);
            console.log('[SetupEmployeePin] Found in alternate collection:', {
              employeeIdNumber: data.employeeIdNumber,
              name: data.name,
              role: data.role
            });
          } else {
            console.error('[SetupEmployeePin] Document not found in either collection!');
            Alert.alert('Error', 'User/Employee not found. Please try again.');
          }
        }
      } catch (error) {
        console.error('[SetupEmployeePin] Error fetching data:', error);
      }
    };
    
    fetchEmployeeData();
  }, [userId, isUserAccount]);

  let loginSuccess = false;

  const handleSetupPin = async () => {
    if (isSubmittingRef.current) {
      console.log('[SetupEmployeePin] Already submitting, ignoring duplicate click');
      return;
    }

    console.log('[SetupEmployeePin] ========================================');
    console.log('[SetupEmployeePin] handleSetupPin called');
    console.log('[SetupEmployeePin] userId (doc ID):', userId);
    console.log('[SetupEmployeePin] employeeIdNumber:', employeeData?.employeeIdNumber);
    console.log('[SetupEmployeePin] pin length:', pin.length);
    console.log('[SetupEmployeePin] confirmPin length:', confirmPin.length);
    console.log('[SetupEmployeePin] ========================================');

    if (!employeeData?.employeeIdNumber) {
      console.error('[SetupEmployeePin] Employee data not loaded yet');
      Alert.alert('Error', 'Please wait for employee data to load');
      return;
    }

    if (!pin.trim()) {
      console.log('[SetupEmployeePin] Validation failed: pin is empty');
      Alert.alert('Error', 'Please enter a PIN');
      return;
    }

    if (pin.length < 4) {
      console.log('[SetupEmployeePin] Validation failed: pin too short');
      Alert.alert('Error', 'PIN must be at least 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      console.log('[SetupEmployeePin] Validation failed: PINs do not match');
      Alert.alert('Error', 'PINs do not match');
      return;
    }

    console.log('[SetupEmployeePin] All validations passed, setting up PIN...');
    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const loginId = employeeData.employeeIdNumber;
      console.log('[SetupEmployeePin] Calling loginWithId with employeeIdNumber:', loginId);
      const result = await loginWithId(loginId, pin.trim(), true);

      console.log('[SetupEmployeePin] loginWithId result:', result);

      if (result.success && result.user) {
        console.log('[SetupEmployeePin] ✅ PIN setup successful!');
        console.log('[SetupEmployeePin] Using result.user for routing decision');
        console.log('[SetupEmployeePin] User:', result.user.userId, 'Role:', result.user.role);
        loginSuccess = true;
        
        const destinationScreen = isManagementRole(result.user.role) ? '/' : '/employee-timesheet';
        console.log('[SetupEmployeePin] 🎯 Routing to:', destinationScreen, '(based on role:', result.user.role, ')');
        
        // Immediate routing without delay to prevent navigation conflicts
        router.replace(destinationScreen as any);
        console.log('[SetupEmployeePin] ✓ Navigation completed');
      } else {
        console.log('[SetupEmployeePin] PIN setup failed:', result.error);
        Alert.alert('Error', result.error || 'Failed to setup PIN');
      }
    } catch (error) {
      console.error('[SetupEmployeePin] Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      // Only reset loading state if login failed
      if (!loginSuccess) {
        console.log('[SetupEmployeePin] Setting isLoading to false');
        isSubmittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient
        colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Shield size={48} color="#fff" strokeWidth={2} />
              </View>
              <Text style={styles.title}>Welcome!</Text>
              <Text style={styles.subtitle}>
                Set up your personal PIN for secure login
              </Text>
              {userName && (
                <View style={styles.userBadge}>
                  <Text style={styles.userBadgeText}>
                    {userName}
                  </Text>
                </View>
              )}
              {userRole && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {userRole}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Create Your PIN</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    testID="setup-employee-pin-input"
                    style={styles.passwordInput}
                    placeholder="Enter 4-6 digit PIN"
                    placeholderTextColor="#94a3b8"
                    value={pin}
                    onChangeText={setPin}
                    secureTextEntry={!showPin}
                    keyboardType="numeric"
                    maxLength={6}
                    editable={!isLoading}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPin(!showPin)}
                  >
                    {showPin ? (
                      <EyeOff size={20} color="#64748b" />
                    ) : (
                      <Eye size={20} color="#64748b" />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.hint}>
                  Choose a secure PIN that you will remember
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Your PIN</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    testID="setup-employee-confirm-pin-input"
                    style={styles.passwordInput}
                    placeholder="Re-enter PIN to confirm"
                    placeholderTextColor="#94a3b8"
                    value={confirmPin}
                    onChangeText={setConfirmPin}
                    secureTextEntry={!showConfirmPin}
                    keyboardType="numeric"
                    maxLength={6}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPin(!showConfirmPin)}
                  >
                    {showConfirmPin ? (
                      <EyeOff size={20} color="#64748b" />
                    ) : (
                      <Eye size={20} color="#64748b" />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.hint}>
                  Enter the same PIN to confirm
                </Text>
              </View>

              <TouchableOpacity
                testID="setup-employee-create-button"
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSetupPin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#1e3a8a" />
                ) : (
                  <Text style={styles.buttonText}>Set Up PIN & Login</Text>
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  💡 This PIN will be used to login to your account. Keep it secure and don&apos;t share it with anyone.
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a',
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#cbd5e1',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  userBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  userBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  roleBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#cbd5e1',
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    marginLeft: 4,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
  },
  eyeButton: {
    padding: 8,
  },
  hint: {
    fontSize: 12,
    color: '#cbd5e1',
    marginLeft: 4,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e3a8a',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 20,
  },
});
