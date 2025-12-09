import { Stack, router } from 'expo-router';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, X } from 'lucide-react-native';

const HARDCODED_ADMIN_PIN = '3002';

export default function AdminPinVerifyScreen() {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (!pin.trim()) {
      Alert.alert('Error', 'Please enter the admin PIN');
      return;
    }

    setIsVerifying(true);

    await new Promise(resolve => setTimeout(resolve, 500));

    if (pin === HARDCODED_ADMIN_PIN) {
      console.log('[AdminPinVerify] PIN verified successfully');
      setIsVerifying(false);
      router.replace('/admin-panel');
    } else {
      console.log('[AdminPinVerify] Invalid PIN entered');
      setIsVerifying(false);
      setPin('');
      Alert.alert('Access Denied', 'Invalid admin PIN');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient
        colors={['#dc2626', '#ef4444', '#f87171']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => router.back()}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.main}>
            <View style={styles.iconContainer}>
              <Lock size={48} color="#fff" />
            </View>
            
            <Text style={styles.title}>Admin Access</Text>
            <Text style={styles.subtitle}>
              Enter the super user PIN to continue
            </Text>

            <View style={styles.form}>
              <TextInput
                testID="admin-pin-input"
                style={styles.input}
                placeholder="Enter PIN"
                placeholderTextColor="#94a3b8"
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="numeric"
                maxLength={6}
                autoFocus
                editable={!isVerifying}
                returnKeyType="done"
                onSubmitEditing={handleVerify}
              />

              <TouchableOpacity
                testID="admin-verify-button"
                style={[styles.verifyButton, isVerifying && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <ActivityIndicator color="#dc2626" />
                ) : (
                  <Text style={styles.verifyButtonText}>Verify</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.warningBadge}>
              <Text style={styles.warningText}>⚠️ Authorized Access Only</Text>
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
    backgroundColor: '#dc2626',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#fecaca',
    textAlign: 'center',
    marginTop: -12,
  },
  form: {
    width: '100%',
    gap: 16,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: '#1e293b',
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '600' as const,
  },
  verifyButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#dc2626',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  warningBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
    textAlign: 'center',
  },
});
