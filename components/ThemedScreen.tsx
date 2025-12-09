import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppTheme } from '@/constants/colors';

type ThemedScreenProps = {
  children: ReactNode;
  padding?: number;
};

export function ThemedScreen({ children, padding = 0 }: ThemedScreenProps) {
  return (
    <View style={[styles.container, padding > 0 && { padding }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
});
