import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Calendar, MapPin, FileText, Send, LogOut } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { isOperatorRole } from '@/utils/roles';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

export default function EmployeeTimesheetScreen() {
  const { user, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoursWorked, setHoursWorked] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [location, setLocation] = useState('');


  const isOperator = isOperatorRole(user?.role);

  useFocusEffect(
    useCallback(() => {
      if (isOperator) {
        router.replace('/operator-home');
      }
    }, [isOperator])
  );



  const handleSubmitTimesheet = async () => {
    if (!hoursWorked.trim() || !workDescription.trim()) {
      Alert.alert('Error', 'Please enter hours worked and work description');
      return;
    }

    const hours = parseFloat(hoursWorked);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      Alert.alert('Error', 'Please enter valid hours (0-24)');
      return;
    }

    try {
      setIsSubmitting(true);

      const timesheetData = {
        employeeId: user?.userId || user?.id,
        employeeName: user?.name,
        employeeRole: user?.role,
        siteId: user?.siteId,
        siteName: user?.siteName,
        masterAccountId: user?.masterAccountId,
        hoursWorked: hours,
        workDescription: workDescription.trim(),
        location: location.trim() || user?.siteName || 'Not specified',
        submittedAt: serverTimestamp(),
        date: new Date().toISOString().split('T')[0],
        status: 'SUBMITTED',
      };

      await addDoc(collection(db, 'timesheets'), timesheetData);

      Alert.alert(
        'Success',
        'Timesheet submitted successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              setHoursWorked('');
              setWorkDescription('');
              setLocation('');
            }
          }
        ]
      );

    } catch (error) {
      console.error('[EmployeeTimesheet] Error submitting timesheet:', error);
      Alert.alert('Error', 'Failed to submit timesheet. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{ 
          headerShown: false
        }} 
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Timesheet</Text>
          <Text style={styles.headerSubtitle}>{user?.name}</Text>
        </View>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <LogOut size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Content - Non-operators only (operators redirect to operator-home) */}
      <View style={styles.content}>
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
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <MapPin size={18} color="#64748b" />
                  <Text style={styles.infoLabel}>Site:</Text>
                  <Text style={styles.infoValue}>{user?.siteName || 'Not assigned'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <FileText size={18} color="#64748b" />
                  <Text style={styles.infoLabel}>Role:</Text>
                  <Text style={styles.infoValue}>{user?.role || 'Worker'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Calendar size={18} color="#64748b" />
                  <Text style={styles.infoLabel}>Date:</Text>
                  <Text style={styles.infoValue}>{new Date().toLocaleDateString()}</Text>
                </View>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.sectionTitle}>Submit Timesheet</Text>

                <View style={styles.inputGroup}>
                  <View style={styles.inputHeader}>
                    <Clock size={20} color="#3b82f6" />
                    <Text style={styles.inputLabel}>Hours Worked *</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter hours (e.g., 8.5)"
                    placeholderTextColor="#94a3b8"
                    value={hoursWorked}
                    onChangeText={setHoursWorked}
                    keyboardType="decimal-pad"
                    editable={!isSubmitting}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.inputHeader}>
                    <FileText size={20} color="#3b82f6" />
                    <Text style={styles.inputLabel}>Work Description *</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe what you worked on today..."
                    placeholderTextColor="#94a3b8"
                    value={workDescription}
                    onChangeText={setWorkDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    editable={!isSubmitting}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.inputHeader}>
                    <MapPin size={20} color="#3b82f6" />
                    <Text style={styles.inputLabel}>Location (Optional)</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder={user?.siteName || "Enter location"}
                    placeholderTextColor="#94a3b8"
                    value={location}
                    onChangeText={setLocation}
                    editable={!isSubmitting}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                  onPress={handleSubmitTimesheet}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Send size={20} color="#fff" />
                      <Text style={styles.submitButtonText}>Submit Timesheet</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.helpText}>Required fields. Timesheet will be submitted to your supervisor for approval.</Text>
              </View>

              <View style={styles.spacer} />
            </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
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
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    flex: 1,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  spacer: {
    height: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#eff6ff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});
