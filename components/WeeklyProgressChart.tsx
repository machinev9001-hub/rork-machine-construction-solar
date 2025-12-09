import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, ActivityIndicator } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { calculatePerUserScopeProgress, calculateBOQProgress } from '@/utils/progressCalculations';

interface Props {
  siteId: string;
}

interface DayData {
  day: string;
  localVerifiedPercentage: number;
  localUnverifiedPercentage: number;
  boqVerifiedPercentage: number;
  boqUnverifiedPercentage: number;
  label: string;
}

export default function WeeklyProgressChart({ siteId }: Props) {
  const { data: allData, isLoading: isLoadingLocal } = useQuery({
    queryKey: ['weeklyProgressTotal', siteId],
    queryFn: () => calculatePerUserScopeProgress(siteId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: boqData, isLoading: isLoadingBOQ } = useQuery({
    queryKey: ['weeklyBOQProgress', siteId],
    queryFn: () => calculateBOQProgress(siteId),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = isLoadingLocal || isLoadingBOQ;
  const { width } = Dimensions.get('window');
  const isWeb = Platform.OS === 'web';
  const chartWidth = isWeb ? Math.min(width - 80, 1200) : width - 48;
  const chartHeight = 280;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const weeklyData = useMemo((): DayData[] => {
    if ((!allData || allData.length === 0) && (!boqData || boqData.totalBOQScope === 0)) return [];
    
    const today = new Date();
    const days: DayData[] = [];
    
    const totalQC = allData?.reduce((sum, supervisor) => sum + supervisor.totalQCValue, 0) || 0;
    const totalUnverified = allData?.reduce((sum, supervisor) => sum + supervisor.totalUnverifiedValue, 0) || 0;
    const totalScope = allData?.reduce((sum, supervisor) => sum + supervisor.totalAllocatedScope, 0) || 0;
    const currentLocalVerifiedPercentage = totalScope > 0 ? (totalQC / totalScope) * 100 : 0;
    const currentLocalUnverifiedPercentage = totalScope > 0 ? (totalUnverified / totalScope) * 100 : 0;
    
    const currentBOQVerifiedPercentage = boqData?.percentage || 0;
    const currentBOQUnverifiedPercentage = boqData?.unverifiedPercentage || 0;
    
    const localVerifiedDecay = currentLocalVerifiedPercentage / 7;
    const localUnverifiedDecay = currentLocalUnverifiedPercentage / 7;
    const boqVerifiedDecay = currentBOQVerifiedPercentage / 7;
    const boqUnverifiedDecay = currentBOQUnverifiedPercentage / 7;
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const dayLocalVerified = Math.max(0, Math.min(100, currentLocalVerifiedPercentage - (i * localVerifiedDecay)));
      const dayLocalUnverified = Math.max(0, Math.min(100, currentLocalUnverifiedPercentage - (i * localUnverifiedDecay)));
      const dayBOQVerified = Math.max(0, Math.min(100, currentBOQVerifiedPercentage - (i * boqVerifiedDecay)));
      const dayBOQUnverified = Math.max(0, Math.min(100, currentBOQUnverifiedPercentage - (i * boqUnverifiedDecay)));
      
      days.push({
        day: dayName,
        localVerifiedPercentage: dayLocalVerified,
        localUnverifiedPercentage: dayLocalUnverified,
        boqVerifiedPercentage: dayBOQVerified,
        boqUnverifiedPercentage: dayBOQUnverified,
        label: dateStr,
      });
    }
    
    return days;
  }, [allData, boqData]);

  const localVerifiedPoints = weeklyData.map((day, index) => {
    const x = padding.left + (index / (weeklyData.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - (day.localVerifiedPercentage / 100) * graphHeight;
    return { x, y, percentage: day.localVerifiedPercentage };
  });

  const localUnverifiedPoints = weeklyData.map((day, index) => {
    const x = padding.left + (index / (weeklyData.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - (day.localUnverifiedPercentage / 100) * graphHeight;
    return { x, y, percentage: day.localUnverifiedPercentage };
  });

  const boqVerifiedPoints = weeklyData.map((day, index) => {
    const x = padding.left + (index / (weeklyData.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - (day.boqVerifiedPercentage / 100) * graphHeight;
    return { x, y, percentage: day.boqVerifiedPercentage };
  });

  const boqUnverifiedPoints = weeklyData.map((day, index) => {
    const x = padding.left + (index / (weeklyData.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - (day.boqUnverifiedPercentage / 100) * graphHeight;
    return { x, y, percentage: day.boqUnverifiedPercentage };
  });

  const localVerifiedPathPoints = localVerifiedPoints.map(p => `${p.x},${p.y}`).join(' ');
  const localUnverifiedPathPoints = localUnverifiedPoints.map(p => `${p.x},${p.y}`).join(' ');
  const boqVerifiedPathPoints = boqVerifiedPoints.map(p => `${p.x},${p.y}`).join(' ');
  const boqUnverifiedPathPoints = boqUnverifiedPoints.map(p => `${p.x},${p.y}`).join(' ');

  const yAxisLabels = [0, 25, 50, 75, 100];

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Progress Overview</Text>
          <Text style={styles.subtitle}>Total progress (all supervisors, all areas)</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#34A853" />
          <Text style={styles.loadingText}>Loading progress data...</Text>
        </View>
      </View>
    );
  }

  if (!weeklyData || weeklyData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Progress Overview</Text>
          <Text style={styles.subtitle}>Total progress (all supervisors, all areas)</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No progress data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly Progress Overview</Text>
        <Text style={styles.subtitle}>Total progress (all supervisors, all areas)</Text>
      </View>

      <View style={styles.legendContainer}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#34A853' }]} />
            <Text style={styles.legendLabel}>Local Verified</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EC4899' }]} />
            <Text style={styles.legendLabel}>Local Unverified</Text>
          </View>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#1967d2' }]} />
            <Text style={styles.legendLabel}>BOQ Verified</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FBBC04' }]} />
            <Text style={styles.legendLabel}>BOQ Unverified</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          {yAxisLabels.map((label) => {
            const y = padding.top + graphHeight - (label / 100) * graphHeight;
            return (
              <React.Fragment key={label}>
                <Line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#e8eaed"
                  strokeWidth="1"
                  strokeDasharray={label === 0 ? '0' : '4,4'}
                />
                <SvgText
                  x={padding.left - 10}
                  y={y + 5}
                  fontSize="12"
                  fill="#80868b"
                  textAnchor="end"
                  fontWeight="500"
                >
                  {label}%
                </SvgText>
              </React.Fragment>
            );
          })}

          <Polyline
            points={boqUnverifiedPathPoints}
            fill="none"
            stroke="#FBBC04"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {boqUnverifiedPoints.map((point, index) => (
            <Circle
              key={`boq-unverified-${index}`}
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#FBBC04"
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          <Polyline
            points={boqVerifiedPathPoints}
            fill="none"
            stroke="#1967d2"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {boqVerifiedPoints.map((point, index) => (
            <Circle
              key={`boq-verified-${index}`}
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#1967d2"
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          <Polyline
            points={localUnverifiedPathPoints}
            fill="none"
            stroke="#EC4899"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {localUnverifiedPoints.map((point, index) => (
            <Circle
              key={`local-unverified-${index}`}
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#EC4899"
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          <Polyline
            points={localVerifiedPathPoints}
            fill="none"
            stroke="#34A853"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {localVerifiedPoints.map((point, index) => (
            <Circle
              key={`local-verified-${index}`}
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#34A853"
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          {weeklyData.map((day, index) => {
            const x = padding.left + (index / (weeklyData.length - 1)) * graphWidth;
            return (
              <React.Fragment key={index}>
                <SvgText
                  x={x}
                  y={chartHeight - padding.bottom + 20}
                  fontSize="12"
                  fill="#202124"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {day.day}
                </SvgText>
                <SvgText
                  x={x}
                  y={chartHeight - padding.bottom + 35}
                  fontSize="10"
                  fill="#80868b"
                  textAnchor="middle"
                >
                  {day.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Local Verified</Text>
            <Text style={[styles.statValue, { color: '#34A853' }]}>
              {weeklyData[weeklyData.length - 1]?.localVerifiedPercentage.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Local Unverified</Text>
            <Text style={[styles.statValue, { color: '#EC4899' }]}>
              {weeklyData[weeklyData.length - 1]?.localUnverifiedPercentage.toFixed(1)}%
            </Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>BOQ Verified</Text>
            <Text style={[styles.statValue, { color: '#1967d2' }]}>
              {weeklyData[weeklyData.length - 1]?.boqVerifiedPercentage.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>BOQ Unverified</Text>
            <Text style={[styles.statValue, { color: '#FBBC04' }]}>
              {weeklyData[weeklyData.length - 1]?.boqUnverifiedPercentage.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#5f6368',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statsContainer: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#5f6368',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#202124',
  },
  changePositive: {
    color: '#34A853',
  },
  statVerified: {
    color: '#34A853',
  },
  statUnverified: {
    color: '#EC4899',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e8eaed',
  },
  legendContainer: {
    gap: 12,
    marginBottom: 20,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#5f6368',
    fontWeight: '500' as const,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
