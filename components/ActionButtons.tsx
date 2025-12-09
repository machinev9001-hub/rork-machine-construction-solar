import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { memo } from 'react';

type ActionButton = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  color: string;
  disabled?: boolean;
};

type ActionButtonsProps = {
  buttons: ActionButton[];
};

function ActionButtonsComponent({ buttons }: ActionButtonsProps) {
  return (
    <View style={styles.actionButtons}>
      {buttons.map((button, index) => {
        const Icon = button.icon;
        return (
          <TouchableOpacity
            key={index}
            style={[styles.actionButton, { backgroundColor: button.color }]}
            activeOpacity={0.8}
            onPress={button.onPress}
            disabled={button.disabled}
          >
            <Icon size={18} color="#fff" />
            <Text style={styles.actionButtonText}>{button.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const ActionButtons = memo(ActionButtonsComponent);

const styles = StyleSheet.create({
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
