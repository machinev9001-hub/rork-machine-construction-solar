import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ArrowLeft, Search, AlertTriangle, CheckCircle, Wrench } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { diagnoseSiteIsolation, showSiteDistribution, getUniqueMasterAccounts } from '@/scripts/diagnose-site-isolation';
import { fixAllSiteIsolationIssues } from '@/scripts/fix-site-isolation';

export default function DiagnoseSiteDataScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [hasRun, setHasRun] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setHasRun(false);
    
    try {
      console.log('[DiagnoseSiteData] Starting diagnostic...');
      const diagnosticResults = await diagnoseSiteIsolation();
      setResults(diagnosticResults);
      setHasRun(true);
      
      // Also show distribution in console
      showSiteDistribution(diagnosticResults);
      
      const masterAccounts = getUniqueMasterAccounts(diagnosticResults);
      console.log('\n📊 Unique Master Accounts found:', masterAccounts);
      
      Alert.alert(
        'Diagnostic Complete',
        'Check the console for detailed results. The summary is shown on screen.'
      );
    } catch (error) {
      console.error('[DiagnoseSiteData] Error running diagnostic:', error);
      Alert.alert('Error', 'Failed to run diagnostic. Check console for details.');
    } finally {
      setIsRunning(false);
    }
  };

  const getTotalIssues = () => {
    if (!results) return 0;
    
    let total = 0;
    Object.values(results).forEach((data: any) => {
      if (data.noSiteId) {
        total += data.noSiteId;
      }
    });
    return total;
  };

  const totalIssues = getTotalIssues();

  const runFix = async () => {
    if (!user?.siteId || !user?.masterAccountId) {
      Alert.alert('Error', 'Missing site or master account information');
      return;
    }

    Alert.alert(
      'Fix Site Isolation Issues',
      `This will add siteId "${user.siteId}" to ${totalIssues} records.\n\nThis action cannot be undone. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fix Issues',
          style: 'destructive',
          onPress: async () => {
            setIsFixing(true);
            try {
              console.log('[DiagnoseSiteData] Starting fix...');
              const fixResults = await fixAllSiteIsolationIssues(
                user.siteId!,
                user.masterAccountId!
              );
              
              let totalFixed = 0;
              let totalErrors = 0;
              fixResults.forEach((result) => {
                totalFixed += result.totalFixed;
                totalErrors += result.errors.length;
              });

              if (totalErrors === 0) {
                Alert.alert(
                  'Success',
                  `Fixed ${totalFixed} records successfully!`,
                  [
                    {
                      text: 'Run Diagnostic Again',
                      onPress: () => runDiagnostic(),
                    },
                  ]
                );
              } else {
                Alert.alert(
                  'Partially Complete',
                  `Fixed ${totalFixed} records, but ${totalErrors} errors occurred. Check console for details.`
                );
              }
            } catch (error) {
              console.error('[DiagnoseSiteData] Error running fix:', error);
              Alert.alert('Error', 'Failed to fix issues. Check console for details.');
            } finally {
              setIsFixing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={isRunning}
        >
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Site Isolation Diagnostic</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Search size={32} color="#3b82f6" />
          <Text style={styles.infoTitle}>Site Data Diagnostic Tool</Text>
          <Text style={styles.infoText}>
            This tool checks all site-specific collections (subcontractors, employees, plant assets, etc.) 
            and identifies records that are missing siteId or may be incorrectly associated.
          </Text>
          <Text style={styles.infoNote}>
            Current Site ID: <Text style={styles.infoNoteBold}>{user?.siteId || 'Not Set'}</Text>
          </Text>
          <Text style={styles.infoNote}>
            Current Site Name: <Text style={styles.infoNoteBold}>{user?.siteName || 'Not Set'}</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.runButton, isRunning && styles.runButtonDisabled]}
          onPress={runDiagnostic}
          disabled={isRunning}
          activeOpacity={0.7}
        >
          {isRunning ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.runButtonText}>Running Diagnostic...</Text>
            </>
          ) : (
            <>
              <Search size={20} color="#fff" />
              <Text style={styles.runButtonText}>Run Diagnostic</Text>
            </>
          )}
        </TouchableOpacity>

        {hasRun && totalIssues > 0 && (
          <TouchableOpacity
            style={[styles.fixButton, isFixing && styles.fixButtonDisabled]}
            onPress={runFix}
            disabled={isFixing || isRunning}
            activeOpacity={0.7}
          >
            {isFixing ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.fixButtonText}>Fixing Issues...</Text>
              </>
            ) : (
              <>
                <Wrench size={20} color="#fff" />
                <Text style={styles.fixButtonText}>Fix All Issues</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {hasRun && results && (
          <>
            <View style={[styles.summaryCard, totalIssues > 0 ? styles.summaryCardWarning : styles.summaryCardSuccess]}>
              {totalIssues > 0 ? (
                <AlertTriangle size={32} color="#f59e0b" />
              ) : (
                <CheckCircle size={32} color="#10b981" />
              )}
              <Text style={styles.summaryTitle}>
                {totalIssues > 0 ? 'Issues Found' : 'All Clear!'}
              </Text>
              <Text style={styles.summaryValue}>{totalIssues}</Text>
              <Text style={styles.summaryDescription}>
                {totalIssues > 0 
                  ? 'records without proper site isolation' 
                  : 'All records have proper siteId'}
              </Text>
            </View>

            <View style={styles.resultsSection}>
              <Text style={styles.sectionTitle}>Collection Details</Text>
              
              {Object.entries(results).map(([collectionName, data]: [string, any]) => (
                <View key={collectionName} style={styles.collectionCard}>
                  <View style={styles.collectionHeader}>
                    <Text style={styles.collectionName}>{collectionName}</Text>
                    {data.noSiteId > 0 ? (
                      <View style={styles.warningBadge}>
                        <AlertTriangle size={14} color="#f59e0b" />
                        <Text style={styles.warningText}>{data.noSiteId} issues</Text>
                      </View>
                    ) : (
                      <View style={styles.successBadge}>
                        <CheckCircle size={14} color="#10b981" />
                        <Text style={styles.successText}>OK</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.collectionStats}>
                    <Text style={styles.statText}>Total Records: {data.total}</Text>
                    <Text style={styles.statText}>Records without siteId: {data.noSiteId}</Text>
                    
                    {data.siteGroups && Object.keys(data.siteGroups).length > 0 && (
                      <>
                        <Text style={[styles.statText, styles.statTextBold]}>Distribution:</Text>
                        {Object.entries(data.siteGroups).map(([siteId, count]: [string, any]) => (
                          <Text key={siteId} style={styles.statTextIndent}>
                            • {siteId}: {count} records
                            {siteId === user?.siteId && <Text style={styles.currentSiteIndicator}> (current site)</Text>}
                          </Text>
                        ))}
                      </>
                    )}
                  </View>

                  {data.noSiteId > 0 && data.noSiteIdRecords && (
                    <View style={styles.issuesList}>
                      <Text style={styles.issuesTitle}>Records with issues:</Text>
                      {data.noSiteIdRecords.slice(0, 5).map((record: any, index: number) => (
                        <View key={record.id} style={styles.issueItem}>
                          <Text style={styles.issueId}>ID: {record.id}</Text>
                          {record.name && <Text style={styles.issueName}>Name: {record.name}</Text>}
                          {record.type && <Text style={styles.issueName}>Type: {record.type}</Text>}
                          {record.masterAccountId && (
                            <Text style={styles.issueDetail}>
                              Master Account: {record.masterAccountId}
                            </Text>
                          )}
                        </View>
                      ))}
                      {data.noSiteIdRecords.length > 5 && (
                        <Text style={styles.moreIssues}>
                          ...and {data.noSiteIdRecords.length - 5} more
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>

            {totalIssues > 0 && (
              <View style={styles.actionCard}>
                <Text style={styles.actionTitle}>Next Steps</Text>
                <Text style={styles.actionText}>
                  1. Review the records listed above{'\n'}
                  2. Check console logs for full details{'\n'}
                  3. Manually update records in Firebase Console, or{'\n'}
                  4. Contact support for data cleanup assistance
                </Text>
              </View>
            )}
          </>
        )}

        {hasRun && !results && (
          <View style={styles.errorCard}>
            <AlertTriangle size={32} color="#ef4444" />
            <Text style={styles.errorText}>Failed to run diagnostic. Check console for errors.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  infoNote: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  infoNoteBold: {
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  runButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  runButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  fixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  fixButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  fixButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  summaryCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
  },
  summaryCardSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  summaryCardWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde047',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  summaryValue: {
    fontSize: 48,
    fontWeight: '800' as const,
    color: '#1e293b',
  },
  summaryDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  resultsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  collectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#f59e0b',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  successText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#10b981',
  },
  collectionStats: {
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#64748b',
  },
  statTextBold: {
    fontWeight: '600' as const,
    color: '#475569',
    marginTop: 4,
  },
  statTextIndent: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 12,
  },
  currentSiteIndicator: {
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  issuesList: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde047',
    gap: 8,
  },
  issuesTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400e',
    marginBottom: 4,
  },
  issueItem: {
    paddingLeft: 8,
    gap: 2,
  },
  issueId: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#78350f',
  },
  issueName: {
    fontSize: 12,
    color: '#92400e',
  },
  issueDetail: {
    fontSize: 11,
    color: '#a16207',
  },
  moreIssues: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#92400e',
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  actionCard: {
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#93c5fd',
    gap: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1e40af',
  },
  actionText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 22,
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    fontSize: 15,
    color: '#991b1b',
    textAlign: 'center',
  },
});
