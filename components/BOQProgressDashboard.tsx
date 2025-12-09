import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { CheckCircle2, Clock, Database, AlertCircle } from 'lucide-react-native';
import { BOQProgress } from '@/utils/progressCalculations';
import BOQWeeklyProgressChart from './BOQWeeklyProgressChart';

interface Props {
  data: BOQProgress;
  siteId: string;
}

export default function BOQProgressDashboard({ data, siteId }: Props) {
  const hasData = data.totalBOQScope > 0;
  const hasSomeActivitiesWithoutBOQ = data.activitiesWithoutBOQ > 0;

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Database size={28} color="#1967d2" strokeWidth={2} />
          <Text style={styles.headerTitle}>BOQ Progress</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Contractual progress against Bill of Quantities
        </Text>
      </View>

      {!hasData ? (
        <View style={styles.emptyState}>
          <Database size={48} color="#9ca3af" strokeWidth={1.5} />
          <Text style={styles.emptyStateText}>No BOQ data defined</Text>
          <Text style={styles.emptyStateSubtext}>
            Configure BOQ quantities in the Menu Manager for activities to see contractual progress
          </Text>
        </View>
      ) : (
        <>
          <BOQWeeklyProgressChart siteId={siteId} />

          {hasSomeActivitiesWithoutBOQ && (
            <View style={styles.warningBanner}>
              <AlertCircle size={20} color="#f59e0b" strokeWidth={2} />
              <View style={styles.warningTextContainer}>
                <Text style={styles.warningText}>
                  {data.activitiesWithoutBOQ} {data.activitiesWithoutBOQ === 1 ? 'activity' : 'activities'} without BOQ
                </Text>
                <Text style={styles.warningSubtext}>
                  These are tracked by supervisor scope only
                </Text>
              </View>
            </View>
          )}

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Overall BOQ Progress</Text>
              <View style={styles.activitiesBadge}>
                <Text style={styles.activitiesBadgeText}>
                  {data.activitiesWithBOQ} {data.activitiesWithBOQ === 1 ? 'activity' : 'activities'}
                </Text>
              </View>
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressRow}>
                <View style={styles.progressColumn}>
                  <View style={styles.progressHeader}>
                    <CheckCircle2 size={16} color="#34A853" strokeWidth={2} />
                    <Text style={styles.progressLabel}>QC Verified</Text>
                  </View>
                  <Text style={styles.progressValue}>{data.percentage.toFixed(2)}%</Text>
                  <View style={styles.progressBarBackground}>
                    <View 
                      style={[
                        styles.progressBarFill,
                        styles.progressBarQC,
                        { width: `${Math.min(data.percentage, 100)}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressStats}>
                    {data.totalQCValue.toFixed(2)} / {data.totalBOQScope.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.progressDivider} />

                <View style={styles.progressColumn}>
                  <View style={styles.progressHeader}>
                    <Clock size={16} color="#FBBC04" strokeWidth={2} />
                    <Text style={styles.progressLabel}>Unverified</Text>
                  </View>
                  <Text style={styles.progressValue}>{data.unverifiedPercentage.toFixed(2)}%</Text>
                  <View style={styles.progressBarBackground}>
                    <View 
                      style={[
                        styles.progressBarFill,
                        styles.progressBarUnverified,
                        { width: `${Math.min(data.unverifiedPercentage, 100)}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressStats}>
                    {data.totalUnverifiedValue.toFixed(2)} / {data.totalBOQScope.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.activitiesHeader}>
            <Text style={styles.activitiesTitle}>Activity Breakdown</Text>
            <Text style={styles.activitiesSubtitle}>Progress by activity type</Text>
          </View>

          <View style={styles.cardsContainer}>
            {Object.entries(data.byMainMenu)
              .filter(([_, menuData]) => menuData.boqScope > 0)
              .sort(([_, a], [__, b]) => b.percentage - a.percentage)
              .map(([mainMenu, menuData]) => (
                <View key={mainMenu} style={styles.activityCard}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityName}>
                      {mainMenu.charAt(0).toUpperCase() + mainMenu.slice(1)}
                    </Text>
                    <View style={styles.activityBadge}>
                      <Text style={styles.activityBadgeText}>
                        {menuData.activitiesCount} {menuData.activitiesCount === 1 ? 'activity' : 'activities'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressSection}>
                    <View style={styles.progressRow}>
                      <View style={styles.progressColumn}>
                        <View style={styles.progressHeader}>
                          <CheckCircle2 size={14} color="#34A853" strokeWidth={2} />
                          <Text style={[styles.progressLabel, styles.progressLabelSmall]}>QC Verified</Text>
                        </View>
                        <Text style={styles.progressValueSmall}>{menuData.percentage.toFixed(2)}%</Text>
                        <View style={styles.progressBarBackground}>
                          <View 
                            style={[
                              styles.progressBarFill,
                              styles.progressBarQC,
                              { width: `${Math.min(menuData.percentage, 100)}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.progressStatsSmall}>
                          {menuData.qc.toFixed(2)} / {menuData.boqScope.toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.progressDivider} />

                      <View style={styles.progressColumn}>
                        <View style={styles.progressHeader}>
                          <Clock size={14} color="#FBBC04" strokeWidth={2} />
                          <Text style={[styles.progressLabel, styles.progressLabelSmall]}>Unverified</Text>
                        </View>
                        <Text style={styles.progressValueSmall}>{menuData.unverifiedPercentage.toFixed(2)}%</Text>
                        <View style={styles.progressBarBackground}>
                          <View 
                            style={[
                              styles.progressBarFill,
                              styles.progressBarUnverified,
                              { width: `${Math.min(menuData.unverifiedPercentage, 100)}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.progressStatsSmall}>
                          {menuData.unverified.toFixed(2)} / {menuData.boqScope.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#202124',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#5f6368',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400e',
    marginBottom: 2,
  },
  warningSubtext: {
    fontSize: 12,
    color: '#78350f',
  },
  summaryCard: {
    backgroundColor: '#e8f0fe',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: '#d2e3fc',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1967d2',
  },
  activitiesBadge: {
    backgroundColor: '#1967d2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activitiesBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  activitiesHeader: {
    marginBottom: 16,
  },
  activitiesTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 4,
  },
  activitiesSubtitle: {
    fontSize: 13,
    color: '#5f6368',
  },
  cardsContainer: {
    gap: 16,
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  activityName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#202124',
  },
  activityBadge: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activityBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  progressSection: {
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 20,
  },
  progressColumn: {
    flex: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#5f6368',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  progressLabelSmall: {
    fontSize: 10,
  },
  progressValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 12,
  },
  progressValueSmall: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 10,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#e8eaed',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressBarQC: {
    backgroundColor: '#34A853',
  },
  progressBarUnverified: {
    backgroundColor: '#FBBC04',
  },
  progressStats: {
    fontSize: 12,
    color: '#80868b',
    fontWeight: '500' as const,
  },
  progressStatsSmall: {
    fontSize: 11,
    color: '#80868b',
    fontWeight: '500' as const,
  },
  progressDivider: {
    width: 1,
    backgroundColor: '#e8eaed',
    marginVertical: 8,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#5f6368',
    marginTop: 16,
    textAlign: 'center' as const,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center' as const,
    maxWidth: 300,
  },
});
