import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useCallback, useRef } from 'react';
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
import { LogIn, UserPlus, ScanLine } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { isManagementRole, isOperatorRole, isDieselClerkRole } from '@/utils/roles';

export default function LoginScreen() {
  console.log('[Login] LoginScreen component rendering');
  const { loginWithId, isOffline } = useAuth();
  console.log('[Login] Auth hook loaded, isOffline:', isOffline);
  
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [verifyPin, setVerifyPin] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const pinInputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      console.log('[Login] Screen focused, isLoading:', isLoading);
      // Only clear form when NOT loading to prevent clearing during navigation
      if (!isLoading) {
        console.log('[Login] Clearing form state');
        setUserId('');
        setPin('');
        setVerifyPin('');
        setIsFirstTime(false);
      } else {
        console.log('[Login] Keeping form state during loading');
      }
    }, [isLoading])
  );



  const handleLogin = async () => {
    console.log('[Login] ==========================================');
    console.log('[Login] handleLogin called at:', new Date().toISOString());
    console.log('[Login] Form state:');
    console.log('[Login]   userId raw:', userId);
    console.log('[Login]   pin raw:', pin);
    console.log('[Login]   isFirstTime:', isFirstTime);
    console.log('[Login] ==========================================');
    
    const userIdToUse = userId.trim();
    const pinToUse = pin.trim();
    
    if (!userIdToUse) {
      Alert.alert('Error', 'Please enter your ID number');
      return;
    }

    if (!pinToUse && !isFirstTime) {
      Alert.alert('Error', 'Please enter your PIN');
      return;
    }

    if (isFirstTime) {
      if (!pin.trim() || !verifyPin.trim()) {
        Alert.alert('Error', 'Please enter and verify your PIN');
        return;
      }
      if (pin !== verifyPin) {
        Alert.alert('Error', 'PINs do not match');
        return;
      }
    }

    setIsLoading(true);
    console.log('[Login] isLoading set to true');
    
    let loginSuccess = false;

    try {
      const result = await loginWithId(userIdToUse, pinToUse || undefined, isFirstTime);

      if (result.success && result.user) {
        console.log('[Login] Login success! User:', result.user.userId, 'Role:', result.user.role);
        console.log('[Login] Using result.user for routing decision');
        loginSuccess = true;
        
        const isManagement = isManagementRole(result.user.role);
        const isOperator = isOperatorRole(result.user.role);
        const isDieselClerk = isDieselClerkRole(result.user.role);
        const destination = isManagement ? '/(tabs)' : isOperator ? '/operator-home' : isDieselClerk ? '/diesel-clerk-home' : '/employee-timesheet';
        console.log('[Login] Scheduled navigation to:', destination, '(based on role:', result.user.role, ')');
        
        setTimeout(() => {
          console.log('[Login] Executing delayed navigation to:', destination);
          router.replace(destination as any);
        }, 100);
        return
      } else if (result.isFirstTime) {
        console.log('[Login] First time user detected - showing PIN setup');
        setIsFirstTime(true);
        setPin('');
        setVerifyPin('');
        Alert.alert(
          'Welcome!',
          'Please create a PIN to secure your account. You will use this PIN to login in the future.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('[Login] Login failed:', result.error);
        setPin('');
        setVerifyPin('');
        if (result.error && result.error.includes('Incorrect PIN')) {
          Alert.alert('Login Failed', result.error);
        } else if (result.error && !result.error.includes('PIN')) {
          Alert.alert('Login Failed', result.error);
        }
      }
    } catch (error) {
      console.error('[Login] ==========================================');
      console.error('[Login] UNEXPECTED ERROR in handleLogin:');
      console.error('[Login] Error type:', typeof error);
      console.error('[Login] Error:', error);
      console.error('[Login] Error message:', error instanceof Error ? error.message : 'Unknown');
      console.error('[Login] Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('[Login] ==========================================');
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      if (!loginSuccess) {
        console.log('[Login] Login failed, setting isLoading to false');
        setIsLoading(false);
      } else {
        console.log('[Login] Login successful, keeping loading state during navigation');
        setTimeout(() => {
          setIsLoading(false);
        }, 500); // Brief delay to let navigation complete
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
          style={styles.content}
        >
          <View style={styles.header}>
            <TouchableOpacity
              testID="login-logo-button"
              activeOpacity={0.7}
              onPress={() => {
                console.log('[Login] Logo button pressed!');
                console.log('[Login] Navigating to admin-pin-verify');
                try {
                  router.push('/admin-pin-verify');
                  console.log('[Login] Navigation command sent');
                } catch (error) {
                  console.error('[Login] Navigation error:', error);
                  Alert.alert('Error', 'Failed to open admin panel');
                }
              }}
              style={styles.logoPlaceholder}
            >
              <View style={styles.logoCircle}>
                <LogIn size={48} color="#fff" strokeWidth={2} />
              </View>
            </TouchableOpacity>
            <Text style={styles.appTitle}>Machine App</Text>
            <Text style={styles.appSubtitle}>Construction Management System</Text>
            {isOffline && (
              <View style={styles.offlineBadge}>
                <Text style={styles.offlineText}>Offline Mode</Text>
              </View>
            )}
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Sign In</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>ID / Master ID</Text>
              <TextInput
                testID="login-user-id-input"
                style={styles.input}
                placeholder="Enter ID number or Master ID"
                placeholderTextColor="#94a3b8"
                value={userId}
                onChangeText={(text) => {
                  console.log('[Login] ID input changed:', text);
                  setUserId(text);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <Text style={styles.hint}>
                Enter your ID number, Master ID, or assigned login ID
              </Text>
            </View>

            {isFirstTime ? (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Create PIN</Text>
                  <TextInput
                    testID="login-create-pin-input"
                    style={styles.input}
                    placeholder="Enter a 4-6 digit PIN"
                    placeholderTextColor="#94a3b8"
                    value={pin}
                    onChangeText={setPin}
                    secureTextEntry
                    keyboardType="numeric"
                    maxLength={6}
                    editable={!isLoading}
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Verify PIN</Text>
                  <TextInput
                    testID="login-verify-pin-input"
                    style={styles.input}
                    placeholder="Re-enter your PIN"
                    placeholderTextColor="#94a3b8"
                    value={verifyPin}
                    onChangeText={setVerifyPin}
                    secureTextEntry
                    keyboardType="numeric"
                    maxLength={6}
                    editable={!isLoading}
                  />
                </View>
              </>
            ) : (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>PIN</Text>
                <TextInput
                  ref={pinInputRef}
                  testID="login-pin-input"
                  style={styles.input}
                  placeholder="Enter your PIN"
                  placeholderTextColor="#94a3b8"
                  value={pin}
                  onChangeText={(text) => {
                    console.log('[Login] PIN input changed:', text.length, 'chars');
                    setPin(text);
                  }}
                  secureTextEntry
                  keyboardType="numeric"
                  maxLength={6}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                testID="login-sign-in-button"
                style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={() => {
                  console.log('[Login] Sign In button pressed');
                  handleLogin();
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <LogIn size={20} color="#fff" />
                    <Text style={styles.buttonText}>Sign In</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="login-qr-scan-button"
                style={[styles.button, styles.qrButton, isLoading && styles.buttonDisabled]}
                onPress={() => router.push({ pathname: '/qr-scanner', params: { context: 'login' } })}
                disabled={isLoading}
              >
                <ScanLine size={20} color="#3b82f6" />
                <Text style={styles.qrButtonText}>Scan QR</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              testID="login-activate-button"
              style={styles.activateButton}
              onPress={() => router.push('/activate')}
              disabled={isLoading}
            >
              <UserPlus size={18} color="#fff" />
              <Text style={styles.activateButtonText}>Activate New Account</Text>
            </TouchableOpacity>
            
            <Text style={styles.footerHint}>
              Use this if you&apos;re setting up Machine App for your company for the first time
            </Text>
            
            <Text style={styles.version}>Machine App V1.0.0</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
  },
  logoPlaceholder: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  offlineBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  offlineText: {
    color: '#78350f',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  form: {
    gap: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    marginLeft: 4,
  },
  hint: {
    fontSize: 12,
    color: '#cbd5e1',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: '#1e3a8a',
  },
  qrButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  footer: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 10,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dividerText: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500' as const,
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: '100%',
  },
  activateButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  footerHint: {
    textAlign: 'center',
    color: '#cbd5e1',
    fontSize: 12,
    paddingHorizontal: 20,
  },
  version: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
});
