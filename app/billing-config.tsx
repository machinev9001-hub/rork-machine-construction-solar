import { Stack, useFocusEffect } from 'expo-router';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  FlatList,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DollarSign, Save, Clock, Calendar, FileText, CloudRain, Wrench, AlertTriangle, ChevronDown, ChevronUp, CalendarDays, ClipboardList } from 'lucide-react-native';
import { collection, getDocs, query, where, orderBy, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset, Subcontractor } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { HeaderTitleWithSync } from '@/components/HeaderSyncStatus';

type BillingMethod = 'PER_HOUR' | 'MINIMUM_BILLING';

type DayTypeConfig = {
  enabled: boolean;
  billingMethod: BillingMethod;
  minHours?: number;
  rateMultiplier: number;
  customRate?: number;
};

type BillingConfig = {
  weekdays: DayTypeConfig;
  saturday: DayTypeConfig;
  sunday: DayTypeConfig;
  publicHolidays: DayTypeConfig;
  rainDays: {
    enabled: boolean;
    minHours: number;
    thresholdHours: number;
  };
};

type TabType = 'config' | 'eph' | 'timesheets';

type EPHRecord = {
  assetId: string;
  assetType: string;
  plantNumber?: string;
  registrationNumber?: string;
  rate: number;
  rateType: 'wet' | 'dry';
  normalHours: number;
  saturdayHours: number;
  sundayHours: number;
  publicHolidayHours: number;
  breakdownHours: number;
  rainDayHours: number;
  strikeDayHours: number;
  totalBillableHours: number;
  estimatedCost: number;
};

type TimesheetEntry = {
  id: string;
  date: string;
  dayOfWeek: string;
  openHours: string;
  closeHours: string;
  closingHours?: string;
  totalHours: number;
  operatorName: string;
  isRainDay: boolean;
  isStrikeDay: boolean;
  isBreakdown: boolean;
  isPublicHoliday: boolean;
  notes?: string;
  verifiedAt?: string;
  hasOriginalEntry?: boolean;
  originalEntryData?: Partial<TimesheetEntry>;
  originalEntryId?: string;
  adjustedBy?: string;
  adjustedAt?: string;
  isAdjustment?: boolean;
};

type TimesheetDisplayRow = {
  id: string;
  isoDate: string;
  dateLabel: string;
  weekdayLabel: string;
  operatorName: string;
  openHours: string;
  closeHours: string;
  totalHours: number;
  isOriginal: boolean;
  badgeLabel: 'ORIG' | 'PM';
  adjustedBy?: string;
  adjustedAt?: string;
  notes?: string;
  isRainDay: boolean;
  isStrikeDay: boolean;
  isBreakdown: boolean;
  isPublicHoliday: boolean;
};

type TimesheetDisplayGroup = {
  date: string;
  rows: TimesheetDisplayRow[];
  hasAdjustments: boolean;
};

const toTimeString = (value?: string | number | null): string => {
  if (value === null || value === undefined) {
    return '00:00';
  }
  return String(value);
};

const buildDisplayRow = (
  entry: Partial<TimesheetEntry> & { id?: string },
  type: 'original' | 'adjusted'
): TimesheetDisplayRow => {
  const isoDate = entry.date ?? new Date().toISOString();
  const dateObj = new Date(isoDate);

  return {
    id: entry.id ?? `${isoDate}-${type}-${Math.random().toString(36).slice(2, 8)}`,
    isoDate,
    dateLabel: dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    weekdayLabel: dateObj.toLocaleDateString('en-GB', { weekday: 'short' }),
    operatorName: entry.operatorName ?? 'Unknown',
    openHours: toTimeString(entry.openHours),
    closeHours: toTimeString(entry.closeHours ?? entry.closingHours),
    totalHours: Number(entry.totalHours ?? 0),
    isOriginal: type === 'original',
    badgeLabel: type === 'original' ? 'ORIG' : 'PM',
    adjustedBy: entry.adjustedBy,
    adjustedAt: entry.adjustedAt,
    notes: entry.notes,
    isRainDay: Boolean(entry.isRainDay),
    isStrikeDay: Boolean(entry.isStrikeDay),
    isBreakdown: Boolean(entry.isBreakdown),
    isPublicHoliday: Boolean(entry.isPublicHoliday),
  };
};

const buildTimesheetGroups = (entries: TimesheetEntry[]): TimesheetDisplayGroup[] => {
  const groupMap = new Map<string, TimesheetDisplayGroup>();

  entries.forEach((entry) => {
    const key = entry.date;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        date: key,
        rows: [],
        hasAdjustments: false,
      });
    }

    const group = groupMap.get(key)!;

    if (entry.hasOriginalEntry && entry.originalEntryData) {
      const originalRow = buildDisplayRow(
        {
          ...entry.originalEntryData,
          id: entry.originalEntryId ?? `${entry.id}-orig`,
          date: entry.date,
        },
        'original'
      );
      group.rows.push(originalRow);
      group.hasAdjustments = true;
    }

    const isAdjustment = Boolean(entry.hasOriginalEntry || entry.isAdjustment || entry.adjustedBy);
    const rowType: 'original' | 'adjusted' = isAdjustment ? 'adjusted' : 'original';
    group.rows.push(buildDisplayRow(entry, rowType));
    if (isAdjustment) {
      group.hasAdjustments = true;
    }
  });

  const groups = Array.from(groupMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  groups.forEach((group) => {
    group.rows.sort((a, b) => {
      if (a.isOriginal === b.isOriginal) {
        return 0;
      }
      return a.isOriginal ? -1 : 1;
    });
  });

  return groups;
};

export default function BillingConfigScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('config');
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<string | null>(null);
  const [plantAssets, setPlantAssets] = useState<PlantAsset[]>([]);
  const [ephData, setEphData] = useState<EPHRecord[]>([]);
  const [selectedAssetForTimesheets, setSelectedAssetForTimesheets] = useState<PlantAsset | null>(null);
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [selectedEphAssetForTimesheets, setSelectedEphAssetForTimesheets] = useState<string | null>(null);
  
  const [config, setConfig] = useState<BillingConfig>({
    weekdays: {
      enabled: true,
      billingMethod: 'PER_HOUR',
      minHours: 0,
      rateMultiplier: 1.0,
    },
    saturday: {
      enabled: true,
      billingMethod: 'MINIMUM_BILLING',
      minHours: 8,
      rateMultiplier: 1.5,
    },
    sunday: {
      enabled: true,
      billingMethod: 'MINIMUM_BILLING',
      minHours: 8,
      rateMultiplier: 1.5,
    },
    publicHolidays: {
      enabled: true,
      billingMethod: 'MINIMUM_BILLING',
      minHours: 8,
      rateMultiplier: 2.0,
    },
    rainDays: {
      enabled: true,
      minHours: 4.5,
      thresholdHours: 1,
    },
  });
  const [timesheetGroups, setTimesheetGroups] = useState<TimesheetDisplayGroup[]>([]);
  const [showOriginalRows, setShowOriginalRows] = useState(false);

  const totalTimesheetHours = useMemo(() => {
    return timesheets.reduce((sum, entry) => sum + entry.totalHours, 0);
  }, [timesheets]);

  const hasAnyAdjustments = useMemo(() => {
    return timesheetGroups.some(group => group.hasAdjustments);
  }, [timesheetGroups]);

  const loadSubcontractors = useCallback(async () => {
    if (!user?.masterAccountId || !user?.siteId) {
      console.log('[Timesheets] Skipping subcontractor load: missing user context');
      setSubcontractors([]);
      return;
    }

    try {
      const q = query(
        collection(db, 'subcontractors'),
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId),
        where('status', '==', 'Active'),
        orderBy('name')
      );
      const snapshot = await getDocs(q);
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subcontractor));
      setSubcontractors(subs);
      console.log('[Timesheets] Loaded subcontractors:', subs.length);
    } catch (error) {
      console.error('Error loading subcontractors:', error);
    }
  }, [user?.masterAccountId, user?.siteId]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Timesheets] Screen focused - refreshing subcontractor list');
      loadSubcontractors();
    }, [loadSubcontractors])
  );

  useEffect(() => {
    if (activeTab === 'timesheets') {
      console.log('[Timesheets] Timesheets tab active - ensuring subcontractors loaded');
      loadSubcontractors();
    }
  }, [activeTab, loadSubcontractors]);

  const generateEPHReport = useCallback(
    async (assets: PlantAsset[], subcontractorId: string) => {
      console.log('Generating EPH report for date range:', startDate.toISOString(), 'to', endDate.toISOString());
      console.log('Assets to process:', assets.length);

      try {
        const ephRecords: EPHRecord[] = await Promise.all(
          assets.map(async (asset) => {
            console.log('[EPH] Processing asset:', asset.assetId, asset.type, asset.plantNumber);
            const timesheetQuery = query(
              collection(db, 'verifiedTimesheets'),
              where('masterAccountId', '==', user?.masterAccountId),
              where('assetId', '==', asset.assetId),
              where('type', '==', 'plant_hours'),
              where('date', '>=', startDate.toISOString().split('T')[0]),
              where('date', '<=', endDate.toISOString().split('T')[0])
            );

            const timesheetSnapshot = await getDocs(timesheetQuery);
            console.log('[EPH] Found', timesheetSnapshot.docs.length, 'verified timesheets for asset:', asset.assetId);
            let normalHours = 0;
            let saturdayHours = 0;
            let sundayHours = 0;
            let publicHolidayHours = 0;
            let breakdownHours = 0;
            let rainDayHours = 0;
            let strikeDayHours = 0;

            timesheetSnapshot.forEach((doc) => {
              const data = doc.data();
              const hours = data.totalHours || 0;
              const date = new Date(data.date);
              const dayOfWeek = date.getDay();
              const isBreakdown = data.isBreakdown || false;
              const isRainDay = data.isRainDay || false;
              const isStrikeDay = data.isStrikeDay || false;
              const isPublicHoliday = data.isPublicHoliday || false;

              if (isBreakdown) {
                breakdownHours += hours;
              } else if (isRainDay) {
                rainDayHours += hours;
              } else if (isStrikeDay) {
                strikeDayHours += hours;
              } else if (isPublicHoliday) {
                publicHolidayHours += hours;
              } else if (dayOfWeek === 6) {
                saturdayHours += hours;
              } else if (dayOfWeek === 0) {
                sundayHours += hours;
              } else {
                normalHours += hours;
              }
            });

            const rate = asset.dryRate || asset.wetRate || 0;
            const rateType = asset.dryRate ? 'dry' : 'wet';
            const totalBillableHours =
              normalHours +
              saturdayHours +
              sundayHours +
              publicHolidayHours +
              breakdownHours +
              rainDayHours +
              strikeDayHours;

            return {
              assetId: asset.id || '',
              assetType: asset.type,
              plantNumber: asset.plantNumber,
              registrationNumber: asset.registrationNumber,
              rate,
              rateType: rateType as 'wet' | 'dry',
              normalHours,
              saturdayHours,
              sundayHours,
              publicHolidayHours,
              breakdownHours,
              rainDayHours,
              strikeDayHours,
              totalBillableHours,
              estimatedCost: totalBillableHours * rate,
            };
          })
        );

        setEphData(ephRecords);
      } catch (error) {
        console.error('Error generating EPH report:', error);
      }
    },
    [endDate, startDate, user?.masterAccountId]
  );

  const loadPlantAssets = useCallback(
    async (subcontractorId: string) => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'plantAssets'),
          where('masterAccountId', '==', user?.masterAccountId),
          where('siteId', '==', user?.siteId),
          where('ownerId', '==', subcontractorId),
          where('ownerType', '==', 'subcontractor')
        );
        const snapshot = await getDocs(q);
        const assets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlantAsset));
        setPlantAssets(assets);
        await generateEPHReport(assets, subcontractorId);
      } catch (error) {
        console.error('Error loading plant assets:', error);
      } finally {
        setLoading(false);
      }
    },
    [generateEPHReport, user?.masterAccountId, user?.siteId]
  );

  const updateDayConfig = (
    dayType: keyof Omit<BillingConfig, 'rainDays'>,
    field: keyof DayTypeConfig,
    value: any
  ) => {
    setConfig(prev => ({
      ...prev,
      [dayType]: {
        ...prev[dayType],
        [field]: value,
      },
    }));
  };

  const updateRainDayConfig = (field: keyof BillingConfig['rainDays'], value: any) => {
    setConfig(prev => ({
      ...prev,
      rainDays: {
        ...prev.rainDays,
        [field]: value,
      },
    }));
  };

  const loadBillingConfig = useCallback(async () => {
    if (!user?.masterAccountId) return;
    
    try {
      const configDoc = await getDoc(
        doc(db, 'masterAccounts', user.masterAccountId, 'billingConfig', 'default')
      );
      
      if (configDoc.exists()) {
        const data = configDoc.data();
        setConfig(data as BillingConfig);
        console.log('Loaded billing config from Firestore');
      } else {
        console.log('No saved billing config found, using defaults');
      }
    } catch (error) {
      console.error('Error loading billing config:', error);
    }
  }, [user?.masterAccountId]);

  useEffect(() => {
    loadBillingConfig();
  }, [loadBillingConfig]);

  const handleSave = async () => {
    console.log('[BILLING] Save button pressed');
    console.log('[BILLING] User:', user);
    console.log('[BILLING] MasterAccountId:', user?.masterAccountId);
    console.log('[BILLING] Config to save:', config);
    
    if (!user?.masterAccountId) {
      console.error('[BILLING] ERROR: No master account ID found');
      alert('Error: No master account ID found. Please log in again.');
      return;
    }

    try {
      const docPath = `masterAccounts/${user.masterAccountId}/billingConfig/default`;
      console.log('[BILLING] Saving to path:', docPath);
      
      await setDoc(
        doc(db, 'masterAccounts', user.masterAccountId, 'billingConfig', 'default'),
        config
      );
      
      console.log('[BILLING] ✅ Billing config saved successfully');
      alert('Billing configuration saved successfully!');
    } catch (error) {
      console.error('[BILLING] ❌ Error saving billing config:', error);
      alert(`Failed to save billing configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleDateChange = (type: 'start' | 'end', date: Date) => {
    if (type === 'start') {
      setStartDate(date);
      setShowStartDatePicker(false);
    } else {
      setEndDate(date);
      setShowEndDatePicker(false);
    }
    
    if (selectedSubcontractor && plantAssets.length > 0) {
      generateEPHReport(plantAssets, selectedSubcontractor);
    }
  };

  const handleRefreshReport = () => {
    if (selectedSubcontractor) {
      loadPlantAssets(selectedSubcontractor);
    }
  };

  const renderDayTypeCard = (
    title: string,
    dayType: keyof Omit<BillingConfig, 'rainDays'>,
    icon: string
  ) => {
    const dayConfig = config[dayType] as DayTypeConfig;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardIcon}>{icon}</Text>
            <Text style={styles.cardTitle}>{title}</Text>
          </View>
          <Switch
            value={dayConfig.enabled}
            onValueChange={(value) => updateDayConfig(dayType, 'enabled', value)}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor={dayConfig.enabled ? '#ffffff' : '#f3f4f6'}
          />
        </View>

        {dayConfig.enabled && (
          <View style={styles.cardContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Billing Method</Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    dayConfig.billingMethod === 'PER_HOUR' && styles.methodButtonActive,
                  ]}
                  onPress={() =>
                    updateDayConfig(dayType, 'billingMethod', 'PER_HOUR')
                  }
                >
                  <Clock
                    size={18}
                    color={
                      dayConfig.billingMethod === 'PER_HOUR' ? '#ffffff' : '#64748b'
                    }
                  />
                  <Text
                    style={[
                      styles.methodButtonText,
                      dayConfig.billingMethod === 'PER_HOUR' &&
                        styles.methodButtonTextActive,
                    ]}
                  >
                    Per Hour
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    dayConfig.billingMethod === 'MINIMUM_BILLING' &&
                      styles.methodButtonActive,
                  ]}
                  onPress={() =>
                    updateDayConfig(dayType, 'billingMethod', 'MINIMUM_BILLING')
                  }
                >
                  <Calendar
                    size={18}
                    color={
                      dayConfig.billingMethod === 'MINIMUM_BILLING'
                        ? '#ffffff'
                        : '#64748b'
                    }
                  />
                  <Text
                    style={[
                      styles.methodButtonText,
                      dayConfig.billingMethod === 'MINIMUM_BILLING' &&
                        styles.methodButtonTextActive,
                    ]}
                  >
                    Minimum Billing
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {dayConfig.billingMethod === 'MINIMUM_BILLING' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Minimum Hours</Text>
                <TextInput
                  style={styles.input}
                  value={dayConfig.minHours?.toString() || '0'}
                  onChangeText={(text) =>
                    updateDayConfig(
                      dayType,
                      'minHours',
                      parseFloat(text) || 0
                    )
                  }
                  keyboardType="numeric"
                  placeholder="Enter minimum hours"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Rate Multiplier</Text>
              <View style={styles.inputWithIcon}>
                <Text style={styles.inputIcon}>×</Text>
                <TextInput
                  style={[styles.input, styles.inputWithIconField]}
                  value={dayConfig.rateMultiplier?.toString() || '1.0'}
                  onChangeText={(text) =>
                    updateDayConfig(
                      dayType,
                      'rateMultiplier',
                      parseFloat(text) || 1.0
                    )
                  }
                  keyboardType="decimal-pad"
                  placeholder="1.0"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <Text style={styles.helperText}>
                {dayConfig.rateMultiplier === 1.0
                  ? 'Standard rate'
                  : dayConfig.rateMultiplier > 1.0
                  ? `${((dayConfig.rateMultiplier - 1) * 100).toFixed(0)}% premium`
                  : dayConfig.rateMultiplier === 0
                  ? 'No billing'
                  : `${((1 - dayConfig.rateMultiplier) * 100).toFixed(0)}% reduced`}
              </Text>
            </View>


          </View>
        )}
      </View>
    );
  };

  const renderRainDayConfig = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <CloudRain size={24} color="#3b82f6" style={{ marginRight: 12 }} />
          <Text style={styles.cardTitle}>Rain Day Configuration</Text>
        </View>
        <Switch
          value={config.rainDays.enabled}
          onValueChange={(value) => updateRainDayConfig('enabled', value)}
          trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
          thumbColor={config.rainDays.enabled ? '#ffffff' : '#f3f4f6'}
        />
      </View>

      {config.rainDays.enabled && (
        <View style={styles.cardContent}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Minimum Billing Hours (Rain Day)</Text>
            <TextInput
              style={styles.input}
              value={config.rainDays.minHours.toString()}
              onChangeText={(text) => updateRainDayConfig('minHours', parseFloat(text) || 0)}
              keyboardType="decimal-pad"
              placeholder="4.5"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.helperText}>
              Minimum hours paid if meter reading exceeds threshold
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Threshold Hours</Text>
            <TextInput
              style={styles.input}
              value={config.rainDays.thresholdHours.toString()}
              onChangeText={(text) => updateRainDayConfig('thresholdHours', parseFloat(text) || 0)}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.helperText}>
              If meter reading exceeds this, minimum billing applies. If meter reading exceeds minimum hours, actual hours × rate is paid.
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const toggleCardExpansion = (assetId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  const loadTimesheetsForAsset = async (asset: PlantAsset) => {
    setLoading(true);
    console.log('Loading timesheets for asset:', asset.assetId, 'from', startDate.toISOString(), 'to', endDate.toISOString());
    try {
      const timesheetQuery = query(
        collection(db, 'verifiedTimesheets'),
        where('masterAccountId', '==', user?.masterAccountId),
        where('assetId', '==', asset.assetId),
        where('type', '==', 'plant_hours'),
        where('date', '>=', startDate.toISOString().split('T')[0]),
        where('date', '<=', endDate.toISOString().split('T')[0])
      );

      console.log('[Timesheets] Executing query for asset:', asset.assetId);
      const snapshot = await getDocs(timesheetQuery);
      console.log('[Timesheets] Found', snapshot.docs.length, 'verified timesheets');
      
      const entries: TimesheetEntry[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = new Date(data.date);
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
        
        return {
          id: doc.id,
          date: data.date,
          dayOfWeek,
          openHours: toTimeString(data.openHours),
          closeHours: toTimeString(data.closeHours),
          totalHours: Number(data.totalHours || 0),
          operatorName: data.operatorName || 'Unknown',
          isRainDay: Boolean(data.isRainDay || data.inclementWeather),
          isStrikeDay: Boolean(data.isStrikeDay),
          isBreakdown: Boolean(data.isBreakdown),
          isPublicHoliday: Boolean(data.isPublicHoliday),
          notes: data.notes,
          verifiedAt: data.verifiedAt,
          hasOriginalEntry: data.hasOriginalEntry,
          originalEntryData: data.originalEntryData,
          originalEntryId: data.originalEntryId,
          adjustedBy: data.adjustedBy,
          adjustedAt: data.adjustedAt,
          isAdjustment: data.isAdjustment,
        };
      });

      entries.sort((a, b) => a.date.localeCompare(b.date));
      const grouped = buildTimesheetGroups(entries);
      setTimesheets(entries);
      setTimesheetGroups(grouped);
      setShowOriginalRows(false);
      console.log('[Timesheets] Built display groups:', grouped.length);
    } catch (error) {
      console.error('Error loading timesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTimesheetsView = () => (
    <View style={styles.timesheetsContainer}>
      {!selectedAssetForTimesheets ? (
        <View>
          <View style={styles.timesheetSelector}>
            <Text style={styles.timesheetSelectorLabel}>Select Subcontractor:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subList}>
              {subcontractors.map(sub => (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.subButton,
                    selectedSubcontractor === sub.id && styles.subButtonActive,
                  ]}
                  onPress={() => {
                    setSelectedSubcontractor(sub.id!);
                    loadPlantAssets(sub.id!);
                  }}
                >
                  <Text
                    style={[
                      styles.subButtonText,
                      selectedSubcontractor === sub.id && styles.subButtonTextActive,
                    ]}
                  >
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.dateRangeContainer}>
            <View style={styles.dateRangeHeader}>
              <CalendarDays size={20} color="#1e3a8a" />
              <Text style={styles.dateRangeTitle}>Date Range</Text>
            </View>
            
            <View style={styles.datePickersRow}>
              <View style={styles.datePickerBlock}>
                <Text style={styles.datePickerLabel}>Start Date</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={startDate.toISOString().split('T')[0]}
                    onChange={(e: any) => handleDateChange('start', new Date(e.target.value))}
                    style={{
                      height: 48,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      borderRadius: 8,
                      paddingLeft: 12,
                      paddingRight: 12,
                      fontSize: 15,
                      color: '#1e293b',
                      backgroundColor: '#ffffff',
                      fontFamily: 'system-ui',
                    }}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartDatePicker(!showStartDatePicker)}
                  >
                    <Calendar size={18} color="#64748b" />
                    <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.datePickerBlock}>
                <Text style={styles.datePickerLabel}>End Date</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={endDate.toISOString().split('T')[0]}
                    onChange={(e: any) => handleDateChange('end', new Date(e.target.value))}
                    style={{
                      height: 48,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      borderRadius: 8,
                      paddingLeft: 12,
                      paddingRight: 12,
                      fontSize: 15,
                      color: '#1e293b',
                      backgroundColor: '#ffffff',
                      fontFamily: 'system-ui',
                    }}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndDatePicker(!showEndDatePicker)}
                  >
                    <Calendar size={18} color="#64748b" />
                    <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {plantAssets.length > 0 && (
            <View style={styles.assetListContainer}>
              <Text style={styles.assetListTitle}>Select Plant Asset:</Text>
              <FlatList
                data={plantAssets}
                keyExtractor={(item) => item.id || ''}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.assetListCard}
                    onPress={() => {
                      setSelectedAssetForTimesheets(item);
                      loadTimesheetsForAsset(item);
                    }}
                  >
                    <View style={styles.assetListIcon}>
                      <FileText size={24} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assetListType}>{item.type}</Text>
                      <Text style={styles.assetListNumber}>
                        {item.plantNumber || item.registrationNumber || item.assetId}
                      </Text>
                    </View>
                    <ChevronDown size={24} color="#64748b" style={{ transform: [{ rotate: '-90deg' }] }} />
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: 16 }}
              />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.timesheetDataContainer}>
          <View style={styles.timesheetHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setSelectedAssetForTimesheets(null);
                setTimesheets([]);
              }}
            >
              <ChevronDown size={24} color="#1e3a8a" style={{ transform: [{ rotate: '90deg' }] }} />
              <Text style={styles.backButtonText}>Back to Assets</Text>
            </TouchableOpacity>

            <View style={styles.selectedAssetHeader}>
              <Text style={styles.selectedAssetTitle}>{selectedAssetForTimesheets.type}</Text>
              <Text style={styles.selectedAssetSubtitle}>
                {selectedAssetForTimesheets.plantNumber || selectedAssetForTimesheets.registrationNumber || selectedAssetForTimesheets.assetId}
              </Text>
              <Text style={styles.selectedAssetDateRange}>
                {formatDate(startDate)} - {formatDate(endDate)}
              </Text>
            </View>
          </View>

          {selectedEphAssetForTimesheets && (
            <View style={styles.ephLinkBanner}>
              <Text style={styles.ephLinkText}>📊 Viewing timesheets for EPH Report</Text>
              <TouchableOpacity
                onPress={() => {
                  setActiveTab('eph');
                  setSelectedEphAssetForTimesheets(null);
                }}
              >
                <Text style={styles.ephLinkBackText}>Back to EPH</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading timesheets...</Text>
            </View>
          ) : timesheets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No timesheets found for this asset in the selected date range</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.timesheetContent}
              contentContainerStyle={styles.timesheetContentContainer}
              testID="timesheet-detail-scroll"
            >
              <View style={styles.metricsRow}>
                <View style={styles.metricCard} testID="timesheet-metric-entries">
                  <Text style={styles.metricLabel}>Entries</Text>
                  <Text style={styles.metricValue}>{timesheets.length}</Text>
                </View>
                <View style={styles.metricCard} testID="timesheet-metric-range">
                  <Text style={styles.metricLabel}>Visible Range</Text>
                  <Text style={styles.metricValue}>
                    {timesheetGroups.length > 0
                      ? `${new Date(timesheetGroups[timesheetGroups.length - 1].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${new Date(timesheetGroups[0].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                      : '—'}
                  </Text>
                </View>
                <TouchableOpacity
                  testID="timesheet-toggle-original-rows"
                  onPress={() => setShowOriginalRows(prev => !prev)}
                  disabled={!hasAnyAdjustments}
                  style={[
                    styles.toggleOriginalButton,
                    showOriginalRows && styles.toggleOriginalButtonActive,
                    !hasAnyAdjustments && styles.toggleOriginalButtonDisabled,
                  ]}
                >
                  <ChevronDown
                    size={18}
                    color={showOriginalRows ? '#1e3a8a' : '#0f172a'}
                    style={{ transform: [{ rotate: showOriginalRows ? '180deg' : '0deg' }] }}
                  />
                  <Text
                    style={[
                      styles.toggleOriginalButtonText,
                      showOriginalRows && styles.toggleOriginalButtonTextActive,
                      !hasAnyAdjustments && styles.toggleOriginalButtonTextDisabled,
                    ]}
                  >
                    {showOriginalRows ? 'Hide Operator Lines' : 'Show Operator Lines'}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={styles.horizontalScroller}
                contentContainerStyle={styles.horizontalScrollerContent}
                testID="timesheet-horizontal-scroll"
              >
                <View style={styles.dataTable}>
                  <View style={styles.dataHeaderRow}>
                    <Text style={[styles.dataHeaderCell, styles.dateCell]}>Date</Text>
                    <Text style={[styles.dataHeaderCell, styles.dayCell]}>Day</Text>
                    <Text style={[styles.dataHeaderCell, styles.badgeCell]}>Entry</Text>
                    <Text style={[styles.dataHeaderCell, styles.operatorCell]}>Operator</Text>
                    <Text style={[styles.dataHeaderCell, styles.timeCell]}>Open</Text>
                    <Text style={[styles.dataHeaderCell, styles.timeCell]}>Close</Text>
                    <Text style={[styles.dataHeaderCell, styles.hoursCell]}>Hours</Text>
                    <Text style={[styles.dataHeaderCell, styles.statusCell]}>Rain</Text>
                    <Text style={[styles.dataHeaderCell, styles.statusCell]}>Strike</Text>
                    <Text style={[styles.dataHeaderCell, styles.statusCell]}>Break</Text>
                    <Text style={[styles.dataHeaderCell, styles.statusCell]}>Holiday</Text>
                    <Text style={[styles.dataHeaderCell, styles.notesCell]}>Notes</Text>
                  </View>

                  {timesheetGroups.map((group, groupIndex) => {
                    const visibleRows =
                      !group.hasAdjustments || showOriginalRows
                        ? group.rows
                        : group.rows.filter(row => !row.isOriginal);

                    if (visibleRows.length === 0) {
                      return null;
                    }

                    const groupDate = new Date(group.date);
                    const groupHours = visibleRows.reduce((sum, row) => sum + row.totalHours, 0);
                    const backgroundColor = groupIndex % 2 === 0 ? '#f8fafc' : '#ffffff';

                    return (
                      <View
                        key={group.date}
                        style={[styles.groupWrapper, { backgroundColor }]}
                        testID={`timesheet-group-${group.date}`}
                      >
                        <View style={styles.groupHeaderRow}>
                          <View style={styles.groupHeaderLeft}>
                            <Text style={styles.groupHeaderTextPrimary}>
                              {groupDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </Text>
                            <Text style={styles.groupHeaderTextSecondary}>
                              {groupDate.toLocaleDateString('en-GB', { weekday: 'long' })}
                            </Text>
                          </View>
                          <View style={styles.groupMeta}>
                            <Text style={styles.groupHours}>{groupHours.toFixed(2)}h</Text>
                            {group.hasAdjustments && (
                              <View style={styles.adjustmentPill}>
                                <Text style={styles.adjustmentPillText}>Has Adjustments</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {visibleRows.map((row) => (
                          <View key={row.id} style={styles.dataRow} testID={`timesheet-row-${row.id}`}>
                            <Text style={[styles.cell, styles.dateCell]}>{row.dateLabel}</Text>
                            <Text style={[styles.cell, styles.dayCell]}>{row.weekdayLabel}</Text>
                            <View style={[styles.cell, styles.badgeCell]}>
                              <View
                                style={[
                                  styles.entryBadge,
                                  row.isOriginal ? styles.entryBadgeOriginal : styles.entryBadgeAdjusted,
                                ]}
                              >
                                <Text style={styles.entryBadgeText}>{row.badgeLabel}</Text>
                              </View>
                            </View>
                            <Text style={[styles.cell, styles.operatorCell]} numberOfLines={1}>
                              {row.operatorName}
                            </Text>
                            <Text style={[styles.cell, styles.timeCell]}>{row.openHours}</Text>
                            <Text style={[styles.cell, styles.timeCell]}>{row.closeHours}</Text>
                            <Text style={[styles.cell, styles.hoursCell]}>{row.totalHours.toFixed(2)}h</Text>
                            <View style={[styles.cell, styles.statusCell]}>
                              {row.isRainDay ? (
                                <CloudRain size={16} color="#2563eb" />
                              ) : (
                                <Text style={styles.statusPlaceholder}>—</Text>
                              )}
                            </View>
                            <View style={[styles.cell, styles.statusCell]}>
                              {row.isStrikeDay ? (
                                <AlertTriangle size={16} color="#ef4444" />
                              ) : (
                                <Text style={styles.statusPlaceholder}>—</Text>
                              )}
                            </View>
                            <View style={[styles.cell, styles.statusCell]}>
                              {row.isBreakdown ? (
                                <Wrench size={16} color="#f59e0b" />
                              ) : (
                                <Text style={styles.statusPlaceholder}>—</Text>
                              )}
                            </View>
                            <View style={[styles.cell, styles.statusCell]}>
                              {row.isPublicHoliday ? (
                                <Text style={styles.statusHoliday}>🎉</Text>
                              ) : (
                                <Text style={styles.statusPlaceholder}>—</Text>
                              )}
                            </View>
                            <Text style={[styles.cell, styles.notesCell]} numberOfLines={1}>
                              {row.notes ?? '—'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.summaryBar}>
                <Text style={styles.summaryLabel}>Total Hours</Text>
                <Text style={styles.summaryValue}>{totalTimesheetHours.toFixed(2)}h</Text>
              </View>

              {selectedEphAssetForTimesheets && (
                <View style={styles.timesheetAttachmentInfo}>
                  <Text style={styles.attachmentInfoText}>
                    ✅ These timesheets are included in the EPH report for this asset
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );

  const handleViewTimesheets = (assetId: string) => {
    setSelectedEphAssetForTimesheets(assetId);
    setActiveTab('timesheets');
    const asset = plantAssets.find(a => a.id === assetId);
    if (asset) {
      setSelectedAssetForTimesheets(asset);
      loadTimesheetsForAsset(asset);
    }
  };

  const renderEPHRecord = ({ item }: { item: EPHRecord }) => {
    const isExpanded = expandedCards.has(item.assetId);

    return (
      <TouchableOpacity 
        style={styles.ephCard} 
        onPress={() => toggleCardExpansion(item.assetId)}
        activeOpacity={0.7}
      >
        <View style={styles.ephHeader}>
          <View style={styles.ephHeaderLeft}>
            <Text style={styles.ephAssetType}>{item.assetType}</Text>
            <Text style={styles.ephAssetNumber}>
              {item.plantNumber || item.registrationNumber || item.assetId}
            </Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={24} color="#64748b" />
          ) : (
            <ChevronDown size={24} color="#64748b" />
          )}
        </View>

        <View style={styles.ephMinimalInfo}>
          <View style={styles.ephInfoRow}>
            <Text style={styles.ephInfoLabel}>Rate:</Text>
            <View style={styles.ephRateContainer}>
              <Text style={styles.ephRateBadge}>{item.rateType.toUpperCase()}</Text>
              <Text style={styles.ephInfoValue}>R{item.rate.toFixed(2)}/hr</Text>
            </View>
          </View>
          <View style={styles.ephDivider} />
          <View style={styles.ephInfoRow}>
            <Text style={styles.ephTotalLabel}>Total Billable Hours:</Text>
            <Text style={styles.ephTotalValue}>{item.totalBillableHours}h</Text>
          </View>
          <View style={styles.ephInfoRow}>
            <Text style={styles.ephTotalLabel}>Estimated Cost:</Text>
            <Text style={styles.ephCostValue}>R{item.estimatedCost.toFixed(2)}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.ephExpandedContent}>
            <View style={styles.ephDivider} />
            <Text style={styles.ephBreakdownTitle}>Hours Breakdown</Text>
            <View style={styles.ephGrid}>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Normal Hours:</Text>
                <Text style={styles.ephValue}>{item.normalHours}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Saturday:</Text>
                <Text style={styles.ephValue}>{item.saturdayHours}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Sunday:</Text>
                <Text style={styles.ephValue}>{item.sundayHours}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Public Holidays:</Text>
                <Text style={styles.ephValue}>{item.publicHolidayHours}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Breakdown:</Text>
                <Text style={styles.ephValue}>{item.breakdownHours}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Rain Days:</Text>
                <Text style={styles.ephValue}>{item.rainDayHours}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Strike Days:</Text>
                <Text style={styles.ephValue}>{item.strikeDayHours}h</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.viewTimesheetsButton}
              onPress={() => handleViewTimesheets(item.assetId)}
            >
              <ClipboardList size={18} color="#1e3a8a" />
              <Text style={styles.viewTimesheetsButtonText}>View Timesheets</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitleWithSync title="Billing Management" />,
          headerStyle: {
            backgroundColor: '#1e3a8a',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
          headerRight: () => activeTab === 'config' ? (
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Save size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          ) : null,
        }}
      />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'config' && styles.tabActive]}
          onPress={() => setActiveTab('config')}
        >
          <DollarSign size={20} color={activeTab === 'config' ? '#1e3a8a' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'config' && styles.tabTextActive]}>
            Billing Config
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'eph' && styles.tabActive]}
          onPress={() => setActiveTab('eph')}
        >
          <FileText size={20} color={activeTab === 'eph' ? '#1e3a8a' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'eph' && styles.tabTextActive]}>
            EPH Report
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'timesheets' && styles.tabActive]}
          onPress={() => setActiveTab('timesheets')}
        >
          <ClipboardList size={20} color={activeTab === 'timesheets' ? '#1e3a8a' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'timesheets' && styles.tabTextActive]}>
            Timesheets
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'config' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
        >
          <View style={styles.infoCard}>
            <DollarSign size={24} color="#3b82f6" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Billing Rules</Text>
              <Text style={styles.infoText}>
                Configure billing methods and rates for different day types. Weekdays,
                weekends, and public holidays are automatically determined. Event-based
                conditions (rain days, strike days, breakdowns) are marked by operators in
                the timesheet.
              </Text>
            </View>
          </View>

          {renderDayTypeCard('Weekdays', 'weekdays', '📅')}
          {renderDayTypeCard('Saturday', 'saturday', '🏖️')}
          {renderDayTypeCard('Sunday', 'sunday', '☀️')}
          {renderDayTypeCard('Public Holidays', 'publicHolidays', '🎉')}
          {renderRainDayConfig()}
        </ScrollView>
      ) : activeTab === 'timesheets' ? (
        renderTimesheetsView()
      ) : (
        <View style={styles.ephContainer}>
          <View style={styles.ephSelector}>
            <Text style={styles.ephSelectorLabel}>Select Subcontractor:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subList}>
              {subcontractors.map(sub => (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.subButton,
                    selectedSubcontractor === sub.id && styles.subButtonActive,
                  ]}
                  onPress={() => {
                    setSelectedSubcontractor(sub.id!);
                    loadPlantAssets(sub.id!);
                  }}
                >
                  <Text
                    style={[
                      styles.subButtonText,
                      selectedSubcontractor === sub.id && styles.subButtonTextActive,
                    ]}
                  >
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.dateRangeContainer}>
            <View style={styles.dateRangeHeader}>
              <CalendarDays size={20} color="#1e3a8a" />
              <Text style={styles.dateRangeTitle}>Billing Period</Text>
            </View>
            
            <View style={styles.datePickersRow}>
              <View style={styles.datePickerBlock}>
                <Text style={styles.datePickerLabel}>Start Date</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={startDate.toISOString().split('T')[0]}
                    onChange={(e: any) => handleDateChange('start', new Date(e.target.value))}
                    style={{
                      height: 48,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      borderRadius: 8,
                      paddingLeft: 12,
                      paddingRight: 12,
                      fontSize: 15,
                      color: '#1e293b',
                      backgroundColor: '#ffffff',
                      fontFamily: 'system-ui',
                    }}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartDatePicker(!showStartDatePicker)}
                  >
                    <Calendar size={18} color="#64748b" />
                    <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.datePickerBlock}>
                <Text style={styles.datePickerLabel}>End Date</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={endDate.toISOString().split('T')[0]}
                    onChange={(e: any) => handleDateChange('end', new Date(e.target.value))}
                    style={{
                      height: 48,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      borderRadius: 8,
                      paddingLeft: 12,
                      paddingRight: 12,
                      fontSize: 15,
                      color: '#1e293b',
                      backgroundColor: '#ffffff',
                      fontFamily: 'system-ui',
                    }}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndDatePicker(!showEndDatePicker)}
                  >
                    <Calendar size={18} color="#64748b" />
                    <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {selectedSubcontractor && (
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleRefreshReport}
              >
                <Text style={styles.refreshButtonText}>Generate Report</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading plant assets...</Text>
            </View>
          ) : ephData.length > 0 ? (
            <FlatList
              data={ephData}
              renderItem={renderEPHRecord}
              keyExtractor={(item) => item.assetId}
              contentContainerStyle={[
                styles.ephList,
                { paddingBottom: insets.bottom + 20 },
              ]}
            />
          ) : selectedSubcontractor ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No plant assets found for this subcontractor</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Select a subcontractor to view EPH report</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e3a8a',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  cardContent: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  inputWithIcon: {
    position: 'relative' as const,
  },
  inputIcon: {
    position: 'absolute' as const,
    left: 12,
    top: 14,
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#64748b',
    zIndex: 1,
  },
  inputWithIconField: {
    paddingLeft: 32,
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    fontStyle: 'italic' as const,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  methodButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  methodButtonTextActive: {
    color: '#ffffff',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1e3a8a',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  tabTextActive: {
    color: '#1e3a8a',
  },
  ephContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  ephSelector: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  ephSelectorLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 12,
  },
  subList: {
    flexDirection: 'row',
  },
  subButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  subButtonActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  subButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
  },
  subButtonTextActive: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  ephList: {
    padding: 16,
  },
  ephCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ephHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  ephHeaderLeft: {
    flex: 1,
  },
  ephAssetType: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  ephAssetNumber: {
    fontSize: 14,
    color: '#64748b',
  },
  ephMinimalInfo: {
    gap: 10,
  },
  ephInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ephInfoLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#475569',
  },
  ephInfoValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1e3a8a',
  },
  ephRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ephRateBadge: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ephDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
  },
  ephExpandedContent: {
    marginTop: 8,
  },
  ephBreakdownTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  ephGrid: {
    gap: 8,
  },
  ephRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ephLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  ephValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
  },

  ephTotalLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#475569',
  },
  ephTotalValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1e3a8a',
  },
  ephCostValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#16a34a',
  },
  dateRangeContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dateRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dateRangeTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  datePickersRow: {
    flexDirection: 'row',
    gap: 12,
  },
  datePickerBlock: {
    flex: 1,
  },
  datePickerLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  dateButtonText: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500' as const,
  },
  refreshButton: {
    marginTop: 16,
    backgroundColor: '#1e3a8a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  timesheetsContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  timesheetSelector: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  timesheetSelectorLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 12,
  },
  assetListContainer: {
    padding: 16,
  },
  assetListTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 12,
  },
  assetListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  assetListIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  assetListType: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  assetListNumber: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  timesheetDataContainer: {
    flex: 1,
  },
  timesheetHeader: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e3a8a',
    marginLeft: 4,
  },
  selectedAssetHeader: {
    alignItems: 'center',
  },
  selectedAssetTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  selectedAssetSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  selectedAssetDateRange: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  timesheetContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  timesheetContentContainer: {
    paddingBottom: 32,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginTop: 6,
  },
  toggleOriginalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    width: '100%',
    minHeight: 56,
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#94a3b8',
    backgroundColor: '#ffffff',
  },
  toggleOriginalButtonActive: {
    borderColor: '#1e3a8a',
    backgroundColor: '#e0e7ff',
  },
  toggleOriginalButtonDisabled: {
    opacity: 0.4,
  },
  toggleOriginalButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0f172a',
  },
  toggleOriginalButtonTextActive: {
    color: '#1e3a8a',
  },
  toggleOriginalButtonTextDisabled: {
    color: '#94a3b8',
  },
  horizontalScroller: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  horizontalScrollerContent: {
    flexGrow: 1,
  },
  dataTable: {
    minWidth: 1160,
  },
  dataHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  dataHeaderCell: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#e2e8f0',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  groupWrapper: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupHeaderLeft: {
    flexShrink: 1,
  },
  groupHeaderTextPrimary: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0f172a',
  },
  groupHeaderTextSecondary: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupHours: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1e3a8a',
  },
  adjustmentPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  adjustmentPillText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#92400e',
    textTransform: 'uppercase' as const,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  cell: {
    fontSize: 13,
    color: '#0f172a',
  },
  dateCell: {
    width: 120,
    fontWeight: '600' as const,
  },
  dayCell: {
    width: 120,
    color: '#475569',
  },
  badgeCell: {
    width: 100,
  },
  entryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  entryBadgeOriginal: {
    backgroundColor: '#e2e8f0',
  },
  entryBadgeAdjusted: {
    backgroundColor: '#dbeafe',
  },
  entryBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#0f172a',
  },
  operatorCell: {
    width: 200,
  },
  timeCell: {
    width: 120,
  },
  hoursCell: {
    width: 120,
    fontWeight: '700' as const,
    color: '#16a34a',
  },
  statusCell: {
    width: 100,
    alignItems: 'center',
  },
  statusPlaceholder: {
    fontSize: 16,
    color: '#cbd5f5',
  },
  statusHoliday: {
    fontSize: 18,
  },
  notesCell: {
    width: 200,
    color: '#475569',
  },
  summaryBar: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#e2e8f0',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#facc15',
  },
  viewTimesheetsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  viewTimesheetsButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e3a8a',
  },
  ephLinkBanner: {
    backgroundColor: '#eff6ff',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ephLinkText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e3a8a',
  },
  ephLinkBackText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#3b82f6',
    textDecorationLine: 'underline' as const,
  },
  timesheetAttachmentInfo: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#d1fae5',
  },
  attachmentInfoText: {
    fontSize: 13,
    color: '#15803d',
    textAlign: 'center',
    fontWeight: '500' as const,
  },
});
