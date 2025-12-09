import { Stack, router } from 'expo-router';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Key, Copy, Share2, Plus, AlertTriangle } from 'lucide-react-native';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { generateActivationCode } from '@/utils/activationCode';

type GeneratedCode = {
  code: string;
  companyName?: string;
  expiryDate?: Date;
};

export default function AdminPanelScreen() {
  const [companyName, setCompanyName] = useState('');
  const [expiryDays, setExpiryDays] = useState('365');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([]);

  const handleGenerateCode = async () => {
    setIsLoading(true);

    try {
      const code = generateActivationCode();
      
      const expiryDate = expiryDays ? 
        new Date(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000) : 
        null;

      await addDoc(collection(db, 'activation_codes'), {
        code,
        companyId: companyName.trim() ? `company_${Date.now()}` : undefined,
        companyName: companyName.trim() || undefined,
        status: 'active',
        expiryDate: expiryDate ? Timestamp.fromDate(expiryDate) : null,
        maxRedemptions: 1,
        currentRedemptions: 0,
        createdAt: serverTimestamp(),
      });

      setGeneratedCodes([
        {
          code,
          companyName: companyName.trim() || undefined,
          expiryDate: expiryDate || undefined,
        },
        ...generatedCodes,
      ]);

      Alert.alert(
        'Code Generated',
        `Activation code created successfully!\n\nCode: ${code}`,
        [{ text: 'OK' }]
      );

      setCompanyName('');
    } catch (error) {
      console.error('[AdminPanel] Error generating code:', error);
      Alert.alert('Error', 'Failed to generate activation code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    if (Platform.OS === 'web') {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          Alert.alert('Copied', 'Activation code copied to clipboard');
        } else {
          Alert.alert('Activation Code', code, [
            {
              text: 'Close',
              style: 'cancel',
            },
          ]);
        }
      } catch (err) {
        console.error('[AdminPanel] Copy failed:', err);
        Alert.alert('Activation Code', code, [
          {
            text: 'Close',
            style: 'cancel',
          },
        ]);
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const handleShareCode = async (codeData: GeneratedCode) => {
    const message = `Machine App Activation Code\n\nCode: ${codeData.code}\n${codeData.companyName ? `Company: ${codeData.companyName}\n` : ''}${codeData.expiryDate ? `Expires: ${codeData.expiryDate.toLocaleDateString()}\n` : ''}\nUse this code to activate your Machine App account.`;
    
    try {
      if (Platform.OS === 'web') {
        if ('share' in navigator) {
          try {
            await navigator.share({
              title: 'Machine App Activation Code',
              text: message,
            });
            return;
          } catch (shareError: any) {
            if (shareError.name === 'AbortError') {
              return;
            }
            console.log('[AdminPanel] Web Share API not available, falling back to clipboard');
          }
        }
        
        const textArea = document.createElement('textarea');
        textArea.value = message;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            Alert.alert(
              'Copied to Clipboard',
              'Activation code details copied. You can now paste and share via your preferred method.',
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Activation Code Details',
              message,
              [{ text: 'Close' }]
            );
          }
        } catch (clipError) {
          document.body.removeChild(textArea);
          console.error('[AdminPanel] Clipboard fallback error:', clipError);
          Alert.alert(
            'Activation Code Details',
            message,
            [{ text: 'Close' }]
          );
        }
      } else {
        await Share.share({
          message,
          title: 'Machine App Activation Code',
        });
      }
    } catch (error) {
      console.error('[AdminPanel] Share error:', error);
      Alert.alert(
        'Share Failed',
        'Could not share the code. Please try copying it instead.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient
        colors={['#dc2626', '#ef4444', '#f87171']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Admin Panel</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => router.back()}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>
            Generate activation codes for new companies
          </Text>
          <View style={styles.warningBadge}>
            <Text style={styles.warningText}>⚠️ Super User Access</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <Key size={24} color="#1e3a8a" />
              <Text style={styles.cardTitle}>Generate Activation Code</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Company Name (Optional)</Text>
                <TextInput
                  testID="admin-company-name-input"
                  style={styles.input}
                  placeholder="Enter company name"
                  placeholderTextColor="#94a3b8"
                  value={companyName}
                  onChangeText={setCompanyName}
                  editable={!isLoading}
                />
                <Text style={styles.hint}>
                  This will be pre-filled during account setup
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Expiry (Days)</Text>
                <TextInput
                  testID="admin-expiry-days-input"
                  style={styles.input}
                  placeholder="365"
                  placeholderTextColor="#94a3b8"
                  value={expiryDays}
                  onChangeText={setExpiryDays}
                  keyboardType="numeric"
                  editable={!isLoading}
                />
                <Text style={styles.hint}>
                  Number of days until code expires (leave empty for no expiry)
                </Text>
              </View>

              <TouchableOpacity
                testID="admin-generate-button"
                style={[styles.generateButton, isLoading && styles.buttonDisabled]}
                onPress={handleGenerateCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Plus size={20} color="#fff" />
                    <Text style={styles.generateButtonText}>Generate Code</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.diagnosticButton}
            onPress={() => router.push('/diagnose-site-data' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.diagnosticButtonContent}>
              <AlertTriangle size={24} color="#f59e0b" />
              <View style={styles.diagnosticButtonText}>
                <Text style={styles.diagnosticButtonTitle}>Site Data Diagnostic</Text>
                <Text style={styles.diagnosticButtonSubtitle}>Check for site isolation issues</Text>
              </View>
            </View>
          </TouchableOpacity>

          {generatedCodes.length > 0 && (
            <View style={styles.codesSection}>
              <Text style={styles.sectionTitle}>Generated Codes</Text>
              
              {generatedCodes.map((codeData, index) => (
                <View key={index} style={styles.codeCard}>
                  <View style={styles.codeHeader}>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeBadgeText}>NEW</Text>
                    </View>
                    {codeData.companyName && (
                      <Text style={styles.codeCompany}>{codeData.companyName}</Text>
                    )}
                  </View>
                  
                  <View style={styles.codeMain}>
                    <Text style={styles.codeText}>{codeData.code}</Text>
                  </View>
                  
                  {codeData.expiryDate && (
                    <Text style={styles.codeExpiry}>
                      Expires: {codeData.expiryDate.toLocaleDateString()}
                    </Text>
                  )}
                  
                  <View style={styles.codeActions}>
                    <TouchableOpacity
                      style={styles.codeActionButton}
                      onPress={() => handleCopyCode(codeData.code)}
                    >
                      <Copy size={18} color="#1e3a8a" />
                      <Text style={styles.codeActionText}>Copy</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.codeActionButton}
                      onPress={() => handleShareCode(codeData)}
                    >
                      <Share2 size={18} color="#1e3a8a" />
                      <Text style={styles.codeActionText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fecaca',
  },
  warningBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 24,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  generateButton: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  codesSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  codeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  codeCompany: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
    flex: 1,
  },
  codeMain: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1e3a8a',
    textAlign: 'center',
    letterSpacing: 2,
  },
  codeExpiry: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  codeActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  codeActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 8,
  },
  codeActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e3a8a',
  },
  diagnosticButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#fef3c7',
  },
  diagnosticButtonContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  diagnosticButtonText: {
    flex: 1,
    gap: 4,
  },
  diagnosticButtonTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  diagnosticButtonSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
});
