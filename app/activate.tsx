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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Key } from 'lucide-react-native';
import { validateActivationCode } from '@/utils/activationCode';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVATION_STORAGE_KEY = '@activation_data';

export default function ActivateScreen() {
  const [activationCode, setActivationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatActivationCode = (text: string) => {
    const cleaned = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const segments = cleaned.match(/.{1,4}/g) || [];
    return segments.join('-').substring(0, 19);
  };

  const handleActivate = async () => {
    const code = activationCode.trim();
    
    if (!code) {
      Alert.alert('Error', 'Please enter an activation code');
      return;
    }

    if (code.replace(/-/g, '').length < 16) {
      Alert.alert('Error', 'Please enter a complete activation code');
      return;
    }

    setIsLoading(true);

    try {
      const result = await validateActivationCode(code);

      if (!result.isValid) {
        Alert.alert('Invalid Code', result.error || 'This activation code is not valid');
        return;
      }

      await AsyncStorage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify({
        codeId: result.activationCode?.id,
        code: result.activationCode?.code,
        companyName: result.activationCode?.companyName,
        companyId: result.activationCode?.companyId,
        validatedAt: new Date().toISOString(),
      }));

      router.push('/setup-master-pin');
    } catch (error) {
      console.error('[Activate] Error:', error);
      Alert.alert('Error', 'Unable to validate activation code. Please check your connection.');
    } finally {
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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              disabled={isLoading}
            >
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Key size={48} color="#fff" strokeWidth={2} />
              </View>
              <Text style={styles.title}>Activate Your Account</Text>
              <Text style={styles.subtitle}>
                Enter the activation code provided to you to get started
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Activation Code</Text>
                <TextInput
                  testID="activate-code-input"
                  style={styles.input}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  placeholderTextColor="#94a3b8"
                  value={activationCode}
                  onChangeText={(text) => setActivationCode(formatActivationCode(text))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={19}
                  editable={!isLoading}
                />
                <Text style={styles.hint}>
                  Enter the 16-character code provided by your administrator
                </Text>
              </View>

              <TouchableOpacity
                testID="activate-button"
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleActivate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#1e3a8a" />
                ) : (
                  <Text style={styles.buttonText}>Continue</Text>
                )}
              </TouchableOpacity>

              <View style={styles.helpContainer}>
                <Text style={styles.helpText}>
                  Don&apos;t have an activation code?
                </Text>
                <Text style={styles.helpText}>
                  Contact your system administrator or support team.
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
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
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
    fontSize: 18,
    color: '#1e293b',
    fontWeight: '600' as const,
    letterSpacing: 2,
    textAlign: 'center',
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
  helpContainer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 4,
  },
  helpText: {
    fontSize: 13,
    color: '#cbd5e1',
    textAlign: 'center',
  },
});
