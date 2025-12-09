import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { X, FileDown, AlertCircle } from 'lucide-react-native';

export type ExportType =
  | 'plantHours'
  | 'workerTimesheets'
  | 'activityActuals'
  | 'boqComparison'
  | 'faceAudit'
  | 'qcInspections'
  | 'supervisorPerformance';

export type ExportFormat = 'csv' | 'json' | 'xlsx';

export type GroupBy = 'none' | 'subcontractor' | 'asset' | 'supervisor' | 'activityGroup';

export type ExportRequest = {
  type: ExportType;
  format: ExportFormat;
  groupBy: GroupBy;
  includeAttachments: boolean;
  filters: {
    companyId?: string;
    siteId?: string;
    fromDate?: Date;
    toDate?: Date;
    assetIds?: string[];
    workerIds?: string[];
    taskIds?: string[];
    subcontractorIds?: string[];
  };
  notifyEmails?: string[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (request: ExportRequest) => Promise<void>;
  exportType: ExportType;
  prefilledFilters?: Partial<ExportRequest['filters']>;
  estimatedRows?: number;
  isLargeExport?: boolean;
};

const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  plantHours: 'Plant Hours',
  workerTimesheets: 'Worker Timesheets',
  activityActuals: 'Activity Actuals',
  boqComparison: 'BOQ Comparison',
  faceAudit: 'Face Clock Audit',
  qcInspections: 'QC Inspections',
  supervisorPerformance: 'Supervisor Performance',
};

const FORMAT_OPTIONS: ExportFormat[] = ['csv', 'json', 'xlsx'];

const GROUP_BY_OPTIONS: Record<ExportType, GroupBy[]> = {
  plantHours: ['none', 'subcontractor', 'asset'],
  workerTimesheets: ['none', 'subcontractor'],
  activityActuals: ['none', 'supervisor', 'activityGroup'],
  boqComparison: ['none', 'activityGroup'],
  faceAudit: ['none', 'supervisor'],
  qcInspections: ['none', 'supervisor'],
  supervisorPerformance: ['none'],
};

export default function ExportRequestModal({
  visible,
  onClose,
  onSubmit,
  exportType,
  prefilledFilters = {},
  estimatedRows = 0,
  isLargeExport = false,
}: Props) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({
        type: exportType,
        format,
        groupBy,
        includeAttachments,
        filters: prefilledFilters,
      });
      onClose();
    } catch (error) {
      console.error('[ExportRequestModal] Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableGroupByOptions = GROUP_BY_OPTIONS[exportType] || ['none'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <FileDown size={24} color="#1e3a8a" />
              <Text style={styles.title}>Create Export</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              testID="close-modal"
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.label}>Export Type</Text>
              <View style={styles.card}>
                <Text style={styles.cardValue}>
                  {EXPORT_TYPE_LABELS[exportType]}
                </Text>
              </View>
            </View>

            {isLargeExport && (
              <View style={styles.warningBox}>
                <AlertCircle size={20} color="#f59e0b" />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Large Export</Text>
                  <Text style={styles.warningText}>
                    This export contains approximately {estimatedRows.toLocaleString()} rows.
                    It will be processed server-side and you&apos;ll be notified when ready.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Format</Text>
              <View style={styles.optionsRow}>
                {FORMAT_OPTIONS.map((fmt) => (
                  <TouchableOpacity
                    key={fmt}
                    style={[
                      styles.optionButton,
                      format === fmt && styles.optionButtonActive,
                    ]}
                    onPress={() => setFormat(fmt)}
                    testID={`format-${fmt}`}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        format === fmt && styles.optionTextActive,
                      ]}
                    >
                      {fmt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Group By</Text>
              <View style={styles.optionsColumn}>
                {availableGroupByOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionButtonFull,
                      groupBy === option && styles.optionButtonActive,
                    ]}
                    onPress={() => setGroupBy(option)}
                    testID={`groupby-${option}`}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        groupBy === option && styles.optionTextActive,
                      ]}
                    >
                      {option === 'none' ? 'Single File' : option.replace(/([A-Z])/g, ' $1').trim()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Include Attachments</Text>
                <Switch
                  value={includeAttachments}
                  onValueChange={setIncludeAttachments}
                  testID="include-attachments-switch"
                />
              </View>
              <Text style={styles.helperText}>
                Include image and document attachments in the export (may increase file size significantly)
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
              testID="cancel-button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              testID="submit-button"
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <FileDown size={20} color="#ffffff" />
                  <Text style={styles.submitButtonText}>Create Export</Text>
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
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#1e293b',
  },
  warningBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400e',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 18,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionsColumn: {
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  optionButtonFull: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  optionTextActive: {
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
});
