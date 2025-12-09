import { Stack } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { RefreshCw } from 'lucide-react-native';

export default function DebugProgressScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runDiagnostics = async () => {
    if (!user?.siteId) {
      setResults({ error: 'No siteId available' });
      return;
    }

    setLoading(true);
    try {
      const diagnostics: any = {
        siteId: user.siteId,
        timestamp: new Date().toISOString(),
      };

      // 1. Check tasks
      const tasksRef = collection(db, 'tasks');
      const tasksQuery = query(tasksRef, where('siteId', '==', user.siteId), limit(100));
      const tasksSnapshot = await getDocs(tasksQuery);
      diagnostics.tasksCount = tasksSnapshot.size;
      diagnostics.taskIds = tasksSnapshot.docs.map(d => d.id).slice(0, 5);

      if (tasksSnapshot.size === 0) {
        setResults(diagnostics);
        setLoading(false);
        return;
      }

      // 2. Check activities for first task
      const firstTaskId = tasksSnapshot.docs[0].id;
      const activitiesRef = collection(db, 'activities');
      const activitiesQuery = query(activitiesRef, where('taskId', '==', firstTaskId), limit(50));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      
      diagnostics.activitiesCount = activitiesSnapshot.size;
      diagnostics.sampleActivities = activitiesSnapshot.docs.slice(0, 3).map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          taskId: data.taskId,
          supervisorInputBy: data.supervisorInputBy || null,
          scopeValue: data.scopeValue || 0,
          qcValue: data.qcValue || 0,
          supervisorInputValue: data.supervisorInputValue || 0,
          cablingHandoff: data.cablingHandoff || false,
          terminationHandoff: data.terminationHandoff || false,
          subMenuKey: data.subMenuKey || null,
        };
      });

      // 3. Check how many activities have supervisorInputBy
      const activitiesWithSupervisor = activitiesSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.supervisorInputBy && data.supervisorInputBy.trim().length > 0;
      });
      diagnostics.activitiesWithSupervisorCount = activitiesWithSupervisor.length;

      // 4. Check how many activities have scope
      const activitiesWithScope = activitiesSnapshot.docs.filter(doc => {
        const data = doc.data();
        const scopeValue = typeof data.scopeValue === 'number' 
          ? data.scopeValue 
          : (data.scopeValue?.value || 0);
        return scopeValue > 0;
      });
      diagnostics.activitiesWithScopeCount = activitiesWithScope.length;

      // 5. Check handoff activities
      const handoffActivities = activitiesSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.cablingHandoff || data.terminationHandoff;
      });
      diagnostics.handoffActivitiesCount = handoffActivities.length;

      // 6. Check users
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('siteId', '==', user.siteId), limit(100));
      const usersSnapshot = await getDocs(usersQuery);
      diagnostics.usersCount = usersSnapshot.size;
      diagnostics.supervisorUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        name: doc.data().name,
        role: doc.data().role,
      }));

      // 7. Find qualifying activities
      const qualifyingActivities = activitiesSnapshot.docs.filter(doc => {
        const data = doc.data();
        const scopeValue = typeof data.scopeValue === 'number' 
          ? data.scopeValue 
          : (data.scopeValue?.value || 0);
        const isHandoff = data.cablingHandoff || data.terminationHandoff;
        const hasSupervisor = data.supervisorInputBy && data.supervisorInputBy.trim().length > 0;
        
        return !isHandoff && scopeValue > 0 && hasSupervisor;
      });
      diagnostics.qualifyingActivitiesCount = qualifyingActivities.length;
      diagnostics.qualifyingActivitiesSample = qualifyingActivities.slice(0, 3).map(doc => {
        const data = doc.data();
        return {
          name: data.name,
          supervisorInputBy: data.supervisorInputBy,
          scopeValue: typeof data.scopeValue === 'number' 
            ? data.scopeValue 
            : (data.scopeValue?.value || 0),
        };
      });

      setResults(diagnostics);
    } catch (error: any) {
      setResults({ error: error.message, stack: error.stack });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Progress Debug',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#202124',
        }}
      />
      
      <View style={styles.header}>
        <Text style={styles.title}>Progress Dashboard Debug</Text>
        <Text style={styles.subtitle}>Diagnose why dashboard shows 0 users</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={runDiagnostics}
        disabled={loading}
      >
        <RefreshCw size={20} color="#ffffff" />
        <Text style={styles.buttonText}>
          {loading ? 'Running...' : 'Run Diagnostics'}
        </Text>
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      )}

      {results && (
        <ScrollView style={styles.results}>
          <Text style={styles.resultsText}>
            {JSON.stringify(results, null, 2)}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#5f6368',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    margin: 20,
    padding: 16,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  results: {
    flex: 1,
    margin: 20,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  resultsText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#202124',
  },
});
