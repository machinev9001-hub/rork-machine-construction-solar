import { Stack, router } from 'expo-router';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Home, Settings } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import OperatorManHoursTimesheet from '@/components/OperatorManHoursTimesheet';

export default function OperatorManHoursScreen() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{ 
          title: 'Man Hours',
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTintColor: '#0f172a',
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerBackVisible: true,
          headerBackTitle: 'Back',
        }} 
      />

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <OperatorManHoursTimesheet
            operatorId={user?.userId || user?.id || ''}
            operatorName={user?.name || ''}
            masterAccountId={user?.masterAccountId || ''}
            companyId={user?.companyIds?.[0]}
            siteId={user?.siteId}
            siteName={user?.siteName}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.push('/operator-home')}
        >
          <Home size={24} color="#64748b" strokeWidth={2} />
          <Text style={styles.navButtonText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.push('/operator-home')}
        >
          <Settings size={24} color="#64748b" strokeWidth={2} />
          <Text style={styles.navButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  navButtonText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500' as const,
  },
});
