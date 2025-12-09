import { useMemo } from 'react';
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { AppTheme, getRoleAccentColor } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export const useTheme = () => {
  const { user } = useAuth();
  const roleAccentColor = getRoleAccentColor(user?.role);

  const commonStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: AppTheme.background,
    } as ViewStyle,
    headerBorder: {
      height: 2,
      width: '100%',
      backgroundColor: roleAccentColor,
    } as ViewStyle,
    scrollView: {
      flex: 1,
    } as ViewStyle,
    scrollContent: {
      padding: 16,
    } as ViewStyle,
    card: {
      backgroundColor: AppTheme.cardBg,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 3,
    } as ViewStyle,
    cardTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: AppTheme.background,
      marginBottom: 8,
    } as TextStyle,
    cardText: {
      fontSize: 14,
      color: AppTheme.background,
      marginBottom: 4,
    } as TextStyle,
    headerText: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: AppTheme.text,
    } as TextStyle,
    headerSubtext: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: AppTheme.textSecondary,
    } as TextStyle,
    button: {
      backgroundColor: roleAccentColor,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    } as ViewStyle,
    buttonText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: AppTheme.background,
    } as TextStyle,
    badge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      alignSelf: 'flex-start' as const,
    } as ViewStyle,
    badgeText: {
      fontSize: 12,
      fontWeight: '600' as const,
    } as TextStyle,
  }), [roleAccentColor]);

  return {
    theme: AppTheme,
    roleAccentColor,
    commonStyles,
    user,
  };
};
