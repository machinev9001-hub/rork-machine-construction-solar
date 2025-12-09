import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { ChecklistItem } from '@/types';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';

type AssetChecklistCardProps = {
  checklist: ChecklistItem[];
  onToggleItem: (itemId: string) => void;
  onAddItem: (label: string) => void;
  onDeleteItem: (itemId: string) => void;
  disabled?: boolean;
  userName?: string;
};

export function AssetChecklistCard({
  checklist,
  onToggleItem,
  onAddItem,
  onDeleteItem,
  disabled = false,
  userName,
}: AssetChecklistCardProps) {
  const [newItemLabel, setNewItemLabel] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  const sortedChecklist = [...checklist].sort((a, b) => a.order - b.order);
  const completedCount = checklist.filter((item) => item.completed).length;
  const totalCount = checklist.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Onboarding Checklist</Text>
          <Text style={styles.progressText}>
            {completedCount} of {totalCount} completed ({progressPercentage}%)
          </Text>
        </View>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
      </View>

      <View style={styles.checklistItems}>
        {sortedChecklist.map((item) => (
          <View key={item.id} style={styles.checklistItemWrapper}>
            <TouchableOpacity
              style={[
                styles.checklistItem,
                item.completed && styles.checklistItemCompleted,
              ]}
              onPress={() => onToggleItem(item.id)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <View style={styles.checkboxContainer}>
                {item.completed ? (
                  <CheckCircle2 size={24} color="#10b981" strokeWidth={2} />
                ) : (
                  <Circle size={24} color="#94a3b8" strokeWidth={2} />
                )}
              </View>
              <View style={styles.itemContent}>
                <Text
                  style={[
                    styles.itemLabel,
                    item.completed && styles.itemLabelCompleted,
                  ]}
                >
                  {item.label}
                </Text>
                {item.completed && item.completedAt && (
                  <Text style={styles.itemMeta}>
                    Completed {new Date(item.completedAt.toDate?.() || item.completedAt).toLocaleDateString()}
                    {item.completedBy && userName && ` by ${userName}`}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert(
                  'Delete Item',
                  'Are you sure you want to delete this checklist item?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => onDeleteItem(item.id),
                    },
                  ]
                );
              }}
              disabled={disabled}
            >
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {isAddingItem ? (
        <View style={styles.addItemForm}>
          <TextInput
            style={styles.addItemInput}
            placeholder="Enter checklist item name..."
            value={newItemLabel}
            onChangeText={setNewItemLabel}
            autoFocus
            multiline
            editable={!disabled}
          />
          <View style={styles.addItemButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsAddingItem(false);
                setNewItemLabel('');
              }}
              disabled={disabled}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                !newItemLabel.trim() && styles.confirmButtonDisabled,
              ]}
              onPress={() => {
                if (newItemLabel.trim()) {
                  onAddItem(newItemLabel.trim());
                  setNewItemLabel('');
                  setIsAddingItem(false);
                }
              }}
              disabled={disabled || !newItemLabel.trim()}
            >
              <Text style={styles.confirmButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddingItem(true)}
          disabled={disabled}
        >
          <Plus size={20} color="#3b82f6" strokeWidth={2} />
          <Text style={styles.addButtonText}>Add Custom Item</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  progressText: {
    fontSize: 13,
    color: '#64748b',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  checklistItems: {
    gap: 12,
  },
  checklistItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checklistItemCompleted: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  checkboxContainer: {
    paddingTop: 2,
  },
  itemContent: {
    flex: 1,
    gap: 4,
  },
  itemLabel: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500' as const,
  },
  itemLabelCompleted: {
    color: '#64748b',
    textDecorationLine: 'line-through' as const,
  },
  itemMeta: {
    fontSize: 12,
    color: '#10b981',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderStyle: 'dashed' as const,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  addItemForm: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  addItemInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 60,
  },
  addItemButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  confirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  confirmButtonDisabled: {
    backgroundColor: '#cbd5e1',
    borderColor: '#94a3b8',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
