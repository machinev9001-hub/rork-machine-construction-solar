import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, FileText, Mail, Download, CheckSquare, Square } from 'lucide-react-native';

type ReportScope = 'all' | 'selected';
type DeliveryMethod = 'download' | 'email';

type Props = {
  visible: boolean;
  onClose: () => void;
  onGenerate: (options: {
    scope: ReportScope;
    deliveryMethod: DeliveryMethod;
    recipientEmail?: string;
  }) => Promise<void>;
  hasSelection: boolean;
  selectedCount: number;
  totalCount: number;
};

export default function ReportGenerationModal({
  visible,
  onClose,
  onGenerate,
  hasSelection,
  selectedCount,
  totalCount,
}: Props) {
  const [scope, setScope] = useState<ReportScope>('all');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('download');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    console.log('[ReportGenerationModal] Generate button pressed');
    console.log('[ReportGenerationModal] Scope:', scope);
    console.log('[ReportGenerationModal] Has Selection:', hasSelection);
    console.log('[ReportGenerationModal] Delivery Method:', deliveryMethod);

    if (deliveryMethod === 'email' && !recipientEmail.trim()) {
      console.log('[ReportGenerationModal] Email required but not provided');
      Alert.alert('Email Required', 'Please enter a recipient email address');
      return;
    }

    if (scope === 'selected' && !hasSelection) {
      console.log('[ReportGenerationModal] No selection made');
      Alert.alert(
        'No Selection',
        'Please select at least one asset/operator by tapping the checkbox next to them, then try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log('[ReportGenerationModal] Starting PDF generation...');
    setGenerating(true);
    try {
      await onGenerate({
        scope,
        deliveryMethod,
        recipientEmail: deliveryMethod === 'email' ? recipientEmail.trim() : undefined,
      });
      console.log('[ReportGenerationModal] PDF generation completed');
      handleClose();
    } catch (error) {
      console.error('[ReportGenerationModal] Generate error:', error);
      Alert.alert(
        'Generation Failed',
        'Failed to generate the report. Please check the console for details.',
        [{ text: 'OK' }]
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    setScope('all');
    setDeliveryMethod('download');
    setRecipientEmail('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <FileText size={24} color="#1e3a8a" />
              <Text style={styles.title}>Generate Timesheet Report</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Report Scope</Text>
              <Text style={styles.sectionDescription}>
                Choose which assets/operators to include in the report
              </Text>

              <TouchableOpacity
                style={[styles.option, scope === 'all' && styles.optionActive]}
                onPress={() => setScope('all')}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  {scope === 'all' ? (
                    <CheckSquare size={24} color="#1e3a8a" />
                  ) : (
                    <Square size={24} color="#94a3b8" />
                  )}
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>All Assets</Text>
                    <Text style={styles.optionDescription}>
                      Include all {totalCount} items in the report
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, scope === 'selected' && styles.optionActive]}
                onPress={() => setScope('selected')}
                activeOpacity={0.7}
                disabled={!hasSelection}
              >
                <View style={styles.optionLeft}>
                  {scope === 'selected' ? (
                    <CheckSquare size={24} color="#1e3a8a" />
                  ) : (
                    <Square size={24} color={hasSelection ? '#94a3b8' : '#cbd5e1'} />
                  )}
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, !hasSelection && styles.optionDisabled]}>
                      Selected Only
                    </Text>
                    <Text style={[styles.optionDescription, !hasSelection && styles.optionDisabled]}>
                      {hasSelection
                        ? `Include only ${selectedCount} selected item${selectedCount > 1 ? 's' : ''}`
                        : 'No items selected'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Method</Text>
              <Text style={styles.sectionDescription}>
                How would you like to receive the report?
              </Text>

              <TouchableOpacity
                style={[styles.option, deliveryMethod === 'download' && styles.optionActive]}
                onPress={() => setDeliveryMethod('download')}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <Download size={24} color={deliveryMethod === 'download' ? '#1e3a8a' : '#94a3b8'} />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Download/Share PDF</Text>
                    <Text style={styles.optionDescription}>
                      Save to device or share via other apps
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, deliveryMethod === 'email' && styles.optionActive]}
                onPress={() => setDeliveryMethod('email')}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <Mail size={24} color={deliveryMethod === 'email' ? '#1e3a8a' : '#94a3b8'} />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Email PDF</Text>
                    <Text style={styles.optionDescription}>
                      Send report via email
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {deliveryMethod === 'email' && (
                <View style={styles.emailInputContainer}>
                  <Text style={styles.inputLabel}>Recipient Email</Text>
                  <TextInput
                    style={styles.input}
                    value={recipientEmail}
                    onChangeText={setRecipientEmail}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={generating}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.generateButton, generating && styles.generateButtonDisabled]}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.generateButtonText}>Generating...</Text>
                </>
              ) : (
                <>
                  <FileText size={20} color="#ffffff" />
                  <Text style={styles.generateButtonText}>Generate Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  optionActive: {
    borderColor: '#1e3a8a',
    backgroundColor: '#eff6ff',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  optionDisabled: {
    color: '#cbd5e1',
  },
  emailInputContainer: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#1e3a8a',
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
});
