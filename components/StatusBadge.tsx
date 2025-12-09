import { View, Text, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { memo } from 'react';

type StatusBadgeProps = {
  Icon: LucideIcon;
  color: string;
  label: string;
};

function StatusBadgeComponent({ Icon, color, label }: StatusBadgeProps) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: `${color}20` }]}>
      <Icon size={16} color={color} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
}

export const StatusBadge = memo(StatusBadgeComponent);

const styles = StyleSheet.create({
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
});
