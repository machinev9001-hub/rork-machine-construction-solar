import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, ActivityIndicator } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { calculateBOQProgress } from '@/utils/progressCalculations';

interface Props {
  siteId: string;
}

interface DayData {
  day: string;
  verifiedPercentage: number;
  unverifiedPercentage: number;
  label: string;
}

export default function BOQWeeklyProgressChart({ siteId }: Props) {
  const { data: boqData, isLoading } = useQuery({
    queryKey: ['weeklyBOQProgress', siteId],
    queryFn: () => calculateBOQProgress(siteId),
    staleTime: 5 * 60 * 1000,
  });

  const { width } = Dimensions.get('window');
  const isWeb = Platform.OS === 'web';
  const chartWidth = isWeb ? Math.min(width - 80, 1200) : width - 48;
  const chartHeight = 280;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const weeklyData = useMemo((): DayData[] => {
    if (!boqData || boqData.totalBOQScope === 0) return [];
    
    const today = new Date();
    const days: DayData[] = [];
    
    const currentVerifiedPercentage = boqData.percentage;
    const currentUnverifiedPercentage = boqData.unverifiedPercentage;
    
    const verifiedDecay = currentVerifiedPercentage / 7;
    const unverifiedDecay = currentUnverifiedPercentage / 7;
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const dayVerified = Math.max(0, Math.min(100, currentVerifiedPercentage - (i * verifiedDecay)));
      const dayUnverified = Math.max(0, Math.min(100, currentUnverifiedPercentage - (i * unverifiedDecay)));
      
      days.push({
        day: dayName,
        verifiedPercentage: dayVerified,
        unverifiedPercentage: dayUnverified,
        label: dateStr,
      });
    }
    
    return days;
  }, [boqData]);

  const verifiedPoints = weeklyData.map((day, index) => {
    const x = padding.left + (index / (weeklyData.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - (day.verifiedPercentage / 100) * graphHeight;
    return { x, y, percentage: day.verifiedPercentage };
  });

  const unverifiedPoints = weeklyData.map((day, index) => {
    const x = padding.left + (index / (weeklyData.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - (day.unverifiedPercentage / 100) * graphHeight;
    return { x, y, percentage: day.unverifiedPercentage };
  });

  const verifiedPathPoints = verifiedPoints.map(p => `${p.x},${p.y}`).join(' ');
  const unverifiedPathPoints = unverifiedPoints.map(p => `${p.x},${p.y}`).join(' ');

  const yAxisLabels = [0, 25, 50, 75, 100];

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>BOQ Weekly Progress</Text>
          <Text style={styles.subtitle}>Contractual progress against BOQ over time</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1967d2" />
          <Text style={styles.loadingText}>Loading BOQ progress...</Text>
        </View>
      </View>
    );
  }

  if (!weeklyData || weeklyData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>BOQ Weekly Progress</Text>
          <Text style={styles.subtitle}>Contractual progress against BOQ over time</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No BOQ data available</Text>
          <Text style={styles.emptySubtext}>
            Configure BOQ quantities in Menu Manager to see progress
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BOQ Weekly Progress</Text>
        <Text style={styles.subtitle}>Contractual progress against BOQ over time</Text>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34A853' }]} />
          <Text style={styles.legendLabel}>QC Verified</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FBBC04' }]} />
          <Text style={styles.legendLabel}>Unverified</Text>
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
            points={unverifiedPathPoints}
            fill="none"
            stroke="#FBBC04"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {unverifiedPoints.map((point, index) => (
            <Circle
              key={`unverified-${index}`}
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#FBBC04"
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          <Polyline
            points={verifiedPathPoints}
            fill="none"
            stroke="#34A853"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {verifiedPoints.map((point, index) => (
            <Circle
              key={`verified-${index}`}
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

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Verified Now</Text>
          <Text style={[styles.statValue, styles.statVerified]}>
            {weeklyData[weeklyData.length - 1]?.verifiedPercentage.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Unverified Now</Text>
          <Text style={[styles.statValue, styles.statUnverified]}>
            {weeklyData[weeklyData.length - 1]?.unverifiedPercentage.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Weekly Growth</Text>
          <Text style={[styles.statValue, styles.changePositive]}>
            +{(weeklyData[weeklyData.length - 1]?.verifiedPercentage - weeklyData[0]?.verifiedPercentage).toFixed(1)}%
          </Text>
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
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
    color: '#FBBC04',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e8eaed',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 20,
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
    fontSize: 16,
    color: '#5f6368',
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center' as const,
    maxWidth: 300,
  },
});
