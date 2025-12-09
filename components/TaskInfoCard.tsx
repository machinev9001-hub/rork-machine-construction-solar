import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

type TaskInfoCardProps = {
  taskName: string;
  totalProgress: string;
  pvArea: string;
  blockArea: string;
  specialArea?: string;
  location?: string;
  notes?: string;
};

export const TaskInfoCard = React.memo<TaskInfoCardProps>(({
  taskName,
  totalProgress,
  pvArea,
  blockArea,
  specialArea,
  location,
  notes,
}) => {
  const [notesExpanded, setNotesExpanded] = useState(true);

  return (
    <View style={styles.container}>
      <View style={styles.compactInfoCard}>
        <View style={styles.topRow}>
          <View style={styles.leftContent}>
            <Text style={styles.header}>{taskName}</Text>
            <View style={styles.compactDetails}>
              <Text style={styles.compactDetailText}>
                PV Area: <Text style={styles.compactDetailValue}>{pvArea || '—'}</Text>
              </Text>
              <Text style={styles.compactDetailText}>
                Block Number: <Text style={styles.compactDetailValue}>{blockArea || '—'}</Text>
              </Text>
            </View>
          </View>
          <View style={styles.progressBox}>
            <Text style={styles.progressLabel}>Total Task Progress</Text>
            <Text style={styles.progressValue}>{totalProgress}</Text>
          </View>
        </View>
        {(specialArea || location) && (
          <>
            {specialArea && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Special Area:</Text>
                <Text style={styles.infoValue}>{specialArea}</Text>
              </View>
            )}
            {location && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Location:</Text>
                <Text style={styles.infoValue}>{location}</Text>
              </View>
            )}
          </>
        )}
        {notes && (
          <TouchableOpacity
            style={styles.expandNotesButton}
            onPress={() => setNotesExpanded(!notesExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.expandNotesText}>Notes</Text>
            {notesExpanded ? (
              <ChevronUp size={16} color="#4285F4" />
            ) : (
              <ChevronDown size={16} color="#4285F4" />
            )}
          </TouchableOpacity>
        )}
      </View>
      
      {notesExpanded && notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesContent}>{notes}</Text>
        </View>
      )}
    </View>
  );
});

TaskInfoCard.displayName = 'TaskInfoCard';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  compactInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leftContent: {
    flex: 1,
    marginRight: 12,
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 8,
  },
  compactDetails: {
    gap: 4,
  },
  compactDetailText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  compactDetailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3b82f6',
  },
  progressBox: {
    alignItems: 'flex-end',
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  progressValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3b82f6',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
  },
  infoValueInline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
  },
  expandNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  expandNotesText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4285F4',
  },
  notesSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notesContent: {
    fontSize: 13,
    color: '#5f6368',
    lineHeight: 20,
  },
});
