import { Stack, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

const ACTIVATION_STORAGE_KEY = '@activation_data';

export default function SetupMasterPinScreen() {
  const { createMasterAccount } = useAuth();
  const [name, setName] = useState('');
  const [masterId, setMasterId] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activationData, setActivationData] = useState<any>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    loadActivationData();
  }, []);

  const loadActivationData = async () => {
    try {
      const stored = await AsyncStorage.getItem(ACTIVATION_STORAGE_KEY);
      if (!stored) {
        Alert.alert('Error', 'No activation code found. Please start over.');
        router.replace('/activate');
        return;
      }
      
      const data = JSON.parse(stored);
      setActivationData(data);
      
      if (data.companyName) {
        setName(data.companyName);
      }
    } catch (error) {
      console.error('[SetupMasterPin] Error loading activation data:', error);
      Alert.alert('Error', 'Failed to load activation data');
      router.replace('/activate');
    }
  };

  const handleSetupAccount = async () => {
    if (isSubmittingRef.current) {
      console.log('[SetupMasterPin] Already submitting, ignoring duplicate click');
      return;
    }

    console.log('[SetupMasterPin] ========================================');
    console.log('[SetupMasterPin] handleSetupAccount called');
    console.log('[SetupMasterPin] name:', name);
    console.log('[SetupMasterPin] masterId:', masterId);
    console.log('[SetupMasterPin] pin length:', pin.length);
    console.log('[SetupMasterPin] confirmPin length:', confirmPin.length);
    console.log('[SetupMasterPin] activationData:', activationData);
    console.log('[SetupMasterPin] ========================================');

    if (!name.trim()) {
      console.log('[SetupMasterPin] Validation failed: name is empty');
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!masterId.trim()) {
      console.log('[SetupMasterPin] Validation failed: masterId is empty');
      Alert.alert('Error', 'Please enter Master User ID');
      return;
    }

    if (!pin.trim()) {
      console.log('[SetupMasterPin] Validation failed: pin is empty');
      Alert.alert('Error', 'Please enter PIN');
      return;
    }

    if (pin.length < 4) {
      console.log('[SetupMasterPin] Validation failed: pin too short');
      Alert.alert('Error', 'PIN must be at least 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      console.log('[SetupMasterPin] Validation failed: PINs do not match');
      console.log('[SetupMasterPin] pin:', pin);
      console.log('[SetupMasterPin] confirmPin:', confirmPin);
      Alert.alert('Error', 'PINs do not match');
      return;
    }

    if (!activationData) {
      console.log('[SetupMasterPin] Validation failed: no activation data');
      Alert.alert('Error', 'Activation data not found. Please start over.');
      router.replace('/activate');
      return;
    }

    console.log('[SetupMasterPin] All validations passed, creating account...');
    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      console.log('[SetupMasterPin] Calling createMasterAccount...');
      const result = await createMasterAccount(
        name.trim(),
        masterId.trim(),
        pin.trim(),
        activationData.code
      );

      console.log('[SetupMasterPin] createMasterAccount result:', result);

      if (result.success) {
        console.log('[SetupMasterPin] Account created successfully!');
        await AsyncStorage.removeItem(ACTIVATION_STORAGE_KEY);
        
        console.log('[SetupMasterPin] Master account is now logged in, navigating to company setup');
        router.replace('/company-setup');
      } else {
        console.log('[SetupMasterPin] Account creation failed:', result.error);
        
        if (result.error === 'Master ID already exists') {
          Alert.alert(
            'Account Already Exists',
            `A master account with ID "${masterId}" already exists. Would you like to login instead?`,
            [
              {
                text: 'Use Different ID',
                style: 'cancel',
              },
              {
                text: 'Go to Login',
                onPress: () => {
                  console.log('[SetupMasterPin] Navigating to login...');
                  router.replace('/login');
                }
              }
            ]
          );
        } else {
          Alert.alert('Error', result.error || 'Failed to create account');
        }
      }
    } catch (error) {
      console.error('[SetupMasterPin] Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      console.log('[SetupMasterPin] Setting isLoading to false');
      isSubmittingRef.current = false;
      setIsLoading(false);
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
              <Text style={styles.title}>Setup Master Account</Text>
              <Text style={styles.subtitle}>
                Create your master account credentials
              </Text>
              {activationData?.companyName && (
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>
                    {activationData.companyName}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Master Name</Text>
                <TextInput
                  testID="setup-name-input"
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Master User ID</Text>
                <TextInput
                  testID="setup-master-id-input"
                  style={styles.input}
                  placeholder="Enter master user ID"
                  placeholderTextColor="#94a3b8"
                  value={masterId}
                  onChangeText={setMasterId}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <Text style={styles.hint}>
                  This ID will be used to sign in (e.g., 3002)
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Master PIN</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    testID="setup-pin-input"
                    style={styles.passwordInput}
                    placeholder="Enter 4-6 digit PIN"
                    placeholderTextColor="#94a3b8"
                    value={pin}
                    onChangeText={setPin}
                    secureTextEntry={!showPin}
                    keyboardType="numeric"
                    maxLength={6}
                    editable={!isLoading}
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
                  Choose a secure PIN for your account
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Master PIN</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    testID="setup-confirm-pin-input"
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
                testID="setup-create-button"
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSetupAccount}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#1e3a8a" />
                ) : (
                  <Text style={styles.buttonText}>Create Master Account</Text>
                )}
              </TouchableOpacity>
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
  companyBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  companyBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
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
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
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
});
