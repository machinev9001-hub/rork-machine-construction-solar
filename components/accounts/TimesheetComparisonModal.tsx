import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { X, ArrowRight } from 'lucide-react-native';

type TimesheetEntry = {
  id: string;
  date: string;
  operatorName: string;
  assetType?: string;
  plantNumber?: string;
  totalHours?: number;
  openHours?: string | number;
  closeHours?: string | number;
  isBreakdown?: boolean;
  isRainDay?: boolean;
  isStrikeDay?: boolean;
  isPublicHoliday?: boolean;
  notes?: string;
};

type ComparisonData = {
  plantManager: TimesheetEntry;
  adminEdited?: TimesheetEntry;
  subcontractorEdited?: TimesheetEntry;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  comparison: ComparisonData | null;
};

export default function TimesheetComparisonModal({
  visible,
  onClose,
  comparison,
}: Props) {
  if (!comparison) return null;

  const renderComparisonRow = (label: string, pmValue: any, adminValue: any, subValue?: any) => {
    const hasAdminChange = adminValue !== undefined && adminValue !== pmValue;
    const hasSubChange = subValue !== undefined && subValue !== pmValue && subValue !== adminValue;

    return (
      <View style={styles.comparisonRow}>
        <Text style={styles.comparisonLabel}>{label}</Text>
        <View style={styles.comparisonValues}>
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>PM</Text>
            <Text style={styles.valueText}>{pmValue?.toString() || '—'}</Text>
          </View>
          
          {adminValue !== undefined && (
            <>
              <ArrowRight size={16} color="#94a3b8" />
              <View style={[styles.valueBox, hasAdminChange && styles.valueBoxHighlight]}>
                <Text style={styles.valueLabel}>Admin</Text>
                <Text style={[styles.valueText, hasAdminChange && styles.valueTextHighlight]}>
                  {adminValue?.toString() || '—'}
                </Text>
              </View>
            </>
          )}

          {subValue !== undefined && (
            <>
              <ArrowRight size={16} color="#94a3b8" />
              <View style={[styles.valueBox, hasSubChange && styles.valueBoxSubHighlight]}>
                <Text style={styles.valueLabel}>Sub</Text>
                <Text style={[styles.valueText, hasSubChange && styles.valueTextSubHighlight]}>
                  {subValue?.toString() || '—'}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderConditionRow = (label: string, pmValue: boolean, adminValue?: boolean, subValue?: boolean) => {
    return (
      <View style={styles.comparisonRow}>
        <Text style={styles.comparisonLabel}>{label}</Text>
        <View style={styles.comparisonValues}>
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>PM</Text>
            <Text style={styles.valueText}>{pmValue ? '✓' : '—'}</Text>
          </View>
          
          {adminValue !== undefined && (
            <>
              <ArrowRight size={16} color="#94a3b8" />
              <View style={[styles.valueBox, adminValue !== pmValue && styles.valueBoxHighlight]}>
                <Text style={styles.valueLabel}>Admin</Text>
                <Text style={[styles.valueText, adminValue !== pmValue && styles.valueTextHighlight]}>
                  {adminValue ? '✓' : '—'}
                </Text>
              </View>
            </>
          )}

          {subValue !== undefined && (
            <>
              <ArrowRight size={16} color="#94a3b8" />
              <View style={[styles.valueBox, subValue !== adminValue && styles.valueBoxSubHighlight]}>
                <Text style={styles.valueLabel}>Sub</Text>
                <Text style={[styles.valueText, subValue !== adminValue && styles.valueTextSubHighlight]}>
                  {subValue ? '✓' : '—'}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Timesheet Comparison</Text>
              <Text style={styles.subtitle}>
                {new Date(comparison.plantManager.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <Text style={styles.subtitle}>
                {comparison.plantManager.assetType} - {comparison.plantManager.plantNumber}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#eff6ff' }]} />
                <Text style={styles.legendText}>Plant Manager Original</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#fef3c7' }]} />
                <Text style={styles.legendText}>Admin Edited</Text>
              </View>
              {comparison.subcontractorEdited && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#dbeafe' }]} />
                  <Text style={styles.legendText}>Subcontractor Edit</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hours Information</Text>
              {renderComparisonRow(
                'Total Hours',
                comparison.plantManager.totalHours?.toFixed(1),
                comparison.adminEdited?.totalHours?.toFixed(1),
                comparison.subcontractorEdited?.totalHours?.toFixed(1)
              )}
              {renderComparisonRow(
                'Open Hours',
                comparison.plantManager.openHours,
                comparison.adminEdited?.openHours,
                comparison.subcontractorEdited?.openHours
              )}
              {renderComparisonRow(
                'Close Hours',
                comparison.plantManager.closeHours,
                comparison.adminEdited?.closeHours,
                comparison.subcontractorEdited?.closeHours
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Conditions</Text>
              {renderConditionRow(
                'Breakdown',
                comparison.plantManager.isBreakdown || false,
                comparison.adminEdited?.isBreakdown,
                comparison.subcontractorEdited?.isBreakdown
              )}
              {renderConditionRow(
                'Rain Day',
                comparison.plantManager.isRainDay || false,
                comparison.adminEdited?.isRainDay,
                comparison.subcontractorEdited?.isRainDay
              )}
              {renderConditionRow(
                'Strike Day',
                comparison.plantManager.isStrikeDay || false,
                comparison.adminEdited?.isStrikeDay,
                comparison.subcontractorEdited?.isStrikeDay
              )}
              {renderConditionRow(
                'Public Holiday',
                comparison.plantManager.isPublicHoliday || false,
                comparison.adminEdited?.isPublicHoliday,
                comparison.subcontractorEdited?.isPublicHoliday
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.notesContainer}>
                <View style={styles.noteBlock}>
                  <Text style={styles.noteLabel}>Plant Manager:</Text>
                  <Text style={styles.noteText}>
                    {comparison.plantManager.notes || 'No notes'}
                  </Text>
                </View>
                {comparison.adminEdited?.notes && (
                  <View style={styles.noteBlock}>
                    <Text style={styles.noteLabel}>Admin:</Text>
                    <Text style={styles.noteText}>
                      {comparison.adminEdited.notes}
                    </Text>
                  </View>
                )}
                {comparison.subcontractorEdited?.notes && (
                  <View style={styles.noteBlock}>
                    <Text style={styles.noteLabel}>Subcontractor:</Text>
                    <Text style={styles.noteText}>
                      {comparison.subcontractorEdited.notes}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeButtonFooter} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
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
    maxWidth: 600,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  legendText: {
    fontSize: 12,
    color: '#64748b',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  comparisonRow: {
    marginBottom: 16,
  },
  comparisonLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 8,
  },
  comparisonValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  valueBoxHighlight: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  valueBoxSubHighlight: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  valueLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  valueTextHighlight: {
    color: '#92400e',
  },
  valueTextSubHighlight: {
    color: '#1e40af',
  },
  notesContainer: {
    gap: 12,
  },
  noteBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#64748b',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  closeButtonFooter: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#1e3a8a',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
});
