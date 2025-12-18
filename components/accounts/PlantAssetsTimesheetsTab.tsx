import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Truck, User, FileDown, ChevronDown, ChevronUp, AlertCircle, Calendar, FileText, CheckSquare, Square } from 'lucide-react-native';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useFocusEffect } from 'expo-router';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import FiltersBar, { FilterValues } from './FiltersBar';
import ExportRequestModal, { ExportRequest, ExportType } from './ExportRequestModal';
import ReportGenerationModal from './ReportGenerationModal';
import { getAgreedTimesheetsByDateRange } from '@/utils/agreedTimesheetManager';
import { generateTimesheetPDF, emailTimesheetPDF, downloadTimesheetPDF } from '@/utils/timesheetPdfGenerator';
import { calculateBillableHours, BillingConfigForCalculation, TimesheetForBilling } from '@/utils/billableHoursCalculator';

type ViewMode = 'plant' | 'man';

type VerifiedTimesheet = {
  id: string;
  date: string;
  operatorName: string;
  operatorId: string;
  verified: boolean;
  verifiedAt: string;
  verifiedBy: string;
  masterAccountId: string;
  siteId: string;
  type: 'plant_hours' | 'man_hours';
  actualHours?: number;
  billableHours?: number;
  billingRule?: string;
  assetRate?: number;
  totalCost?: number;
  
  openHours?: number;
  closeHours?: number;
  totalHours?: number;
  isBreakdown?: boolean;
  inclementWeather?: boolean;
  hasAttachment?: boolean;
  
  assetId?: string;
  assetType?: string;
  plantNumber?: string;
  registrationNumber?: string;
  ownerId?: string;
  ownerType?: string;
  ownerName?: string;
  
  startTime?: string;
  stopTime?: string;
  totalManHours?: number;
  normalHours?: number;
  overtimeHours?: number;
  sundayHours?: number;
  publicHolidayHours?: number;
  noLunchBreak?: boolean;
  
  hasOriginalEntry?: boolean;
  originalEntryData?: any;
  isAdjustment?: boolean;
  originalEntryId?: string;
  adjustedBy?: string;
  adjustedAt?: string;
  
  agreedHours?: number;
  agreedNormalHours?: number;
  agreedOvertimeHours?: number;
  agreedSundayHours?: number;
  agreedPublicHolidayHours?: number;
  agreedBy?: string;
  agreedAt?: string;
  agreedNotes?: string;
  hasAgreedEntry?: boolean;
  
  fuelAmount?: number;
  fuelMeterReading?: number;
  fuelMeterType?: 'HOUR_METER' | 'ODOMETER';
  fuelConsumption?: number;
};

type DateGroup = {
  date: string;
  originalEntry?: VerifiedTimesheet;
  adjustmentEntry?: VerifiedTimesheet;
  agreedEntry?: VerifiedTimesheet;
};

type TimesheetGroup = {
  key: string;
  title: string;
  subtitle: string;
  entries: VerifiedTimesheet[];
  dateGroups: DateGroup[];
  originalEntry?: VerifiedTimesheet;
  adjustmentEntry?: VerifiedTimesheet;
};

type Props = {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onExport: (request: ExportRequest) => Promise<void>;
};

export default function PlantAssetsTimesheetsTab({
  filters,
  onFiltersChange,
  onExport,
}: Props) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('plant');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('plantHours');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [timesheets, setTimesheets] = useState<VerifiedTimesheet[]>([]);
  const [groups, setGroups] = useState<TimesheetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showOriginalTimesheets, setShowOriginalTimesheets] = useState<Set<string>>(new Set());
  const [subcontractors, setSubcontractors] = useState<{ id: string; name: string }[]>([]);
  const [billingConfig, setBillingConfig] = useState<BillingConfigForCalculation | null>(null);
  const [plantAssets, setPlantAssets] = useState<{ id: string; type: string; plantNumber?: string; registrationNumber?: string; assetId: string }[]>([]);
  const [showSelector, setShowSelector] = useState(true);
  const [tempSubcontractor, setTempSubcontractor] = useState<string | null>(null);
  const [tempAsset, setTempAsset] = useState<string | null>(null);
  const [tempStartDate, setTempStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [tempEndDate, setTempEndDate] = useState<Date>(new Date());

  useFocusEffect(
    useCallback(() => {
      console.log('[PlantAssetsTimesheetsTab] Tab focused, loading subcontractors');
      if (user?.siteId && user?.masterAccountId) {
        loadSubcontractors();
        loadBillingConfig();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.siteId, user?.masterAccountId])
  );

  useEffect(() => {
    if (tempSubcontractor) {
      loadPlantAssets(tempSubcontractor);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempSubcontractor]);

  useEffect(() => {
    loadVerifiedTimesheets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.siteId, user?.masterAccountId, viewMode, filters]);

  useEffect(() => {
    groupTimesheets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timesheets]);

  const loadSubcontractors = useCallback(async () => {
    if (!user?.siteId || !user?.masterAccountId) return;

    try {
      const subcontractorsRef = collection(db, 'subcontractors');
      const q = query(
        subcontractorsRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId),
        where('status', '==', 'Active')
      );
      const snapshot = await getDocs(q);
      const subs = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Unknown',
      }));
      console.log('[PlantAssetsTimesheetsTab] Loaded subcontractors:', subs.length);
      setSubcontractors(subs);
    } catch (error) {
      console.error('[PlantAssetsTimesheetsTab] Error loading subcontractors:', error);
    }
  }, [user?.siteId, user?.masterAccountId]);

  const loadBillingConfig = useCallback(async () => {
    if (!user?.masterAccountId || !user?.siteId) return;

    try {
      const billingConfigRef = collection(db, 'billingConfigs');
      const q = query(
        billingConfigRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const configData = snapshot.docs[0].data();
        const config: BillingConfigForCalculation = {
          weekdays: {
            minHours: configData.machineHours?.weekdayMinimum ?? 0,
          },
          saturday: {
            minHours: configData.machineHours?.saturdayMinimum ?? 0,
          },
          sunday: {
            minHours: configData.machineHours?.saturdayMinimum ?? 0,
          },
          publicHolidays: {
            minHours: 0,
          },
          rainDays: {
            enabled: true,
            minHours: configData.machineHours?.rainDayHours ?? 0,
          },
          breakdown: {
            enabled: true,
          },
        };
        console.log('[PlantAssetsTimesheetsTab] Loaded billing config:', config);
        setBillingConfig(config);
      } else {
        console.log('[PlantAssetsTimesheetsTab] No billing config found');
        setBillingConfig(null);
      }
    } catch (error) {
      console.error('[PlantAssetsTimesheetsTab] Error loading billing config:', error);
      setBillingConfig(null);
    }
  }, [user?.masterAccountId, user?.siteId]);

  const loadPlantAssets = async (subcontractorId: string) => {
    if (!user?.siteId || !user?.masterAccountId) return;

    try {
      const assetsRef = collection(db, 'plantAssets');
      const q = query(
        assetsRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId),
        where('ownerId', '==', subcontractorId),
        where('ownerType', '==', 'subcontractor')
      );
      const snapshot = await getDocs(q);
      const assets = snapshot.docs.map(doc => ({
        id: doc.id,
        type: doc.data().type || 'Unknown',
        plantNumber: doc.data().plantNumber,
        registrationNumber: doc.data().registrationNumber,
        assetId: doc.data().assetId || doc.id,
      }));
      console.log('[PlantAssetsTimesheetsTab] Loaded plant assets:', assets.length);
      if (assets.length > 0) {
        console.log('[PlantAssetsTimesheetsTab] Sample asset:', JSON.stringify(assets[0], null, 2));
      }
      setPlantAssets(assets);
    } catch (error) {
      console.error('[PlantAssetsTimesheetsTab] Error loading plant assets:', error);
    }
  };

  const loadVerifiedTimesheets = async () => {
    if (!user?.siteId || !user?.masterAccountId) {
      console.log('[PlantAssetsTimesheetsTab] No siteId or masterAccountId');
      setLoading(false);
      return;
    }

    console.log('[PlantAssetsTimesheetsTab] ===== LOADING AGREED TIMESHEETS (APPROVED FOR BILLING) =====');
    console.log('[PlantAssetsTimesheetsTab] masterAccountId:', user.masterAccountId);
    console.log('[PlantAssetsTimesheetsTab] siteId:', user.siteId);
    console.log('[PlantAssetsTimesheetsTab] viewMode:', viewMode);
    console.log('[PlantAssetsTimesheetsTab] filters:', filters);
    setLoading(true);

    try {
      const fromDateStr = filters.fromDate?.toISOString().split('T')[0] || '2020-01-01';
      const toDateStr = filters.toDate?.toISOString().split('T')[0] || '2099-12-31';

      console.log('[PlantAssetsTimesheetsTab] Fetching agreed timesheets from', fromDateStr, 'to', toDateStr);
      
      const agreedTimesheets = await getAgreedTimesheetsByDateRange(
        user.masterAccountId,
        fromDateStr,
        toDateStr
      );

      console.log('[PlantAssetsTimesheetsTab] Query returned', agreedTimesheets.length, 'agreed timesheets');
      
      const uniqueAssetIds = [...new Set(agreedTimesheets.filter(at => at.timesheetType === 'plant_asset').map(at => at.assetId))];
      const ratesMap = new Map<string, { dryRate?: number; wetRate?: number; dailyRate?: number }>();
      
      if (uniqueAssetIds.length > 0) {
        console.log('[PlantAssetsTimesheetsTab] Fetching rates for', uniqueAssetIds.length, 'assets');
        const plantAssetsRef = collection(db, 'plantAssets');
        const plantAssetsQuery = query(
          plantAssetsRef,
          where('masterAccountId', '==', user.masterAccountId),
          where('assetId', 'in', uniqueAssetIds.slice(0, 10))
        );
        const plantAssetsSnapshot = await getDocs(plantAssetsQuery);
        
        plantAssetsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.assetId) {
            ratesMap.set(data.assetId, {
              dryRate: data.dryRate,
              wetRate: data.wetRate,
              dailyRate: data.dailyRate,
            });
          }
        });
        console.log('[PlantAssetsTimesheetsTab] Loaded rates for', ratesMap.size, 'assets');
      }
      
      const fuelLogsMap = new Map<string, any>();
      if (agreedTimesheets.length > 0) {
        const assetIds = [...new Set(agreedTimesheets.filter(at => at.timesheetType === 'plant_asset').map(at => at.assetId))];
        
        if (assetIds.length > 0) {
          console.log('[PlantAssetsTimesheetsTab] Fetching fuel logs for', assetIds.length, 'assets');
          const fuelLogsRef = collection(db, 'fuelLogs');
          const fuelLogsQuery = query(
            fuelLogsRef,
            where('masterAccountId', '==', user.masterAccountId),
            where('assetId', 'in', assetIds.slice(0, 10)),
            where('date', '>=', fromDateStr),
            where('date', '<=', toDateStr)
          );
          const fuelSnapshot = await getDocs(fuelLogsQuery);
          
          fuelSnapshot.forEach(doc => {
            const data = doc.data();
            const key = `${data.assetId}-${data.date}`;
            if (!fuelLogsMap.has(key)) {
              fuelLogsMap.set(key, data);
            }
          });
          console.log('[PlantAssetsTimesheetsTab] Loaded', fuelLogsMap.size, 'fuel logs');
        }
      }
      
      const getActualHoursBasedOnPriority = (agreedTimesheet: any): number => {
        if (agreedTimesheet.agreedByRole === 'Admin' || agreedTimesheet.agreedByRole === 'admin') {
          return agreedTimesheet.agreedHours;
        }
        if (agreedTimesheet.agreedByRole === 'Plant Manager' && agreedTimesheet.originalHours !== undefined) {
          return agreedTimesheet.agreedHours;
        }
        if (agreedTimesheet.originalHours !== undefined) {
          return agreedTimesheet.originalHours;
        }
        return agreedTimesheet.agreedHours;
      };
      
      let loadedTimesheets: VerifiedTimesheet[] = agreedTimesheets.map(at => {
        const isPlant = at.timesheetType === 'plant_asset';
        const hasAdjustment = at.originalHours !== at.agreedHours;
        
        const fuelLogKey = `${at.assetId}-${at.date}`;
        const fuelLog = fuelLogsMap.get(fuelLogKey);
        
        let fuelConsumption: number | undefined;
        if (fuelLog && isPlant && at.agreedHours > 0) {
          if (fuelLog.meterType === 'HOUR_METER') {
            fuelConsumption = fuelLog.fuelAmount / at.agreedHours;
          } else {
            fuelConsumption = fuelLog.fuelAmount / (fuelLog.meterReading || 1);
          }
        }
        
        let billableHours: number | undefined;
        let billingRule: string | undefined;
        let assetRate: number | undefined;
        let totalCost: number | undefined;
        
        const actualHours = getActualHoursBasedOnPriority(at);
        
        if (isPlant && billingConfig && actualHours > 0) {
          const timesheetForBilling: TimesheetForBilling = {
            startTime: 0,
            endTime: actualHours,
            date: at.date,
            openHours: 0,
            closeHours: actualHours,
            totalHours: actualHours,
          };
          const result = calculateBillableHours(timesheetForBilling, billingConfig);
          billableHours = result.billableHours;
          billingRule = result.appliedRule;
          
          if (at.assetId) {
            const rates = ratesMap.get(at.assetId);
            if (rates) {
              assetRate = rates.dryRate || rates.wetRate || rates.dailyRate;
              if (assetRate && billableHours) {
                totalCost = billableHours * assetRate;
              }
            }
          }
        }
        
        const baseEntry: VerifiedTimesheet = {
          id: at.id,
          date: at.date,
          operatorName: at.operatorName || '',
          operatorId: at.operatorId || '',
          verified: true,
          verifiedAt: at.agreedAt ? (at.agreedAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
          verifiedBy: at.agreedBy,
          masterAccountId: at.masterAccountId,
          siteId: at.siteId || '',
          type: isPlant ? 'plant_hours' : 'man_hours',
          
          actualHours: getActualHoursBasedOnPriority(at),
          billableHours,
          billingRule,
          assetRate,
          totalCost,
          
          totalHours: isPlant ? getActualHoursBasedOnPriority(at) : undefined,
          openHours: isPlant ? 0 : undefined,
          closeHours: isPlant ? getActualHoursBasedOnPriority(at) : undefined,
          
          assetId: at.assetId,
          assetType: at.assetType,
          plantNumber: at.assetId,
          registrationNumber: undefined,
          ownerId: at.subcontractorId,
          ownerType: 'subcontractor',
          ownerName: at.subcontractorName,
          
          totalManHours: !isPlant ? getActualHoursBasedOnPriority(at) : undefined,
          normalHours: at.agreedNormalHours,
          overtimeHours: at.agreedOvertimeHours,
          sundayHours: at.agreedSundayHours,
          publicHolidayHours: at.agreedPublicHolidayHours,
          
          agreedHours: at.agreedHours,
          agreedNormalHours: at.agreedNormalHours,
          agreedOvertimeHours: at.agreedOvertimeHours,
          agreedSundayHours: at.agreedSundayHours,
          agreedPublicHolidayHours: at.agreedPublicHolidayHours,
          agreedBy: at.agreedBy,
          agreedAt: at.agreedAt ? (at.agreedAt as Timestamp).toDate().toISOString() : undefined,
          agreedNotes: at.adminNotes,
          hasAgreedEntry: true,
          
          fuelAmount: fuelLog?.fuelAmount,
          fuelMeterReading: fuelLog?.meterReading,
          fuelMeterType: fuelLog?.meterType,
          fuelConsumption,
        };
        
        if (hasAdjustment) {
          const originalEntry: VerifiedTimesheet = {
            ...baseEntry,
            id: `${at.id}-original`,
            totalHours: isPlant ? at.originalHours : undefined,
            closeHours: isPlant ? at.originalHours : undefined,
            totalManHours: !isPlant ? at.originalHours : undefined,
            normalHours: at.originalNormalHours,
            overtimeHours: at.originalOvertimeHours,
            sundayHours: at.originalSundayHours,
            publicHolidayHours: at.originalPublicHolidayHours,
            agreedHours: undefined,
            agreedNormalHours: undefined,
            agreedOvertimeHours: undefined,
            agreedSundayHours: undefined,
            agreedPublicHolidayHours: undefined,
            agreedNotes: undefined,
            hasAgreedEntry: false,
          };
          
          baseEntry.hasOriginalEntry = true;
          baseEntry.originalEntryData = originalEntry;
        }
        
        return baseEntry;
      });

      loadedTimesheets.sort((a, b) => {
        const timeA = new Date(a.verifiedAt).getTime();
        const timeB = new Date(b.verifiedAt).getTime();
        return timeB - timeA;
      });

      console.log('[PlantAssetsTimesheetsTab] Before filtering:', loadedTimesheets.length, 'timesheets');

      if (viewMode === 'plant') {
        loadedTimesheets = loadedTimesheets.filter(t => t.type === 'plant_hours');
      } else {
        loadedTimesheets = loadedTimesheets.filter(t => t.type === 'man_hours');
      }
      console.log('[PlantAssetsTimesheetsTab] After type filter:', loadedTimesheets.length, 'timesheets');

      if (filters.assetId) {
        console.log('[PlantAssetsTimesheetsTab] Filtering by assetId:', filters.assetId);
        loadedTimesheets = loadedTimesheets.filter(t => t.assetId === filters.assetId);
        console.log('[PlantAssetsTimesheetsTab] After asset filter:', loadedTimesheets.length, 'timesheets');
      }

      if (filters.subcontractorId) {
        console.log('[PlantAssetsTimesheetsTab] Filtering by subcontractorId:', filters.subcontractorId);
        loadedTimesheets = loadedTimesheets.filter(t => t.ownerId === filters.subcontractorId);
        console.log('[PlantAssetsTimesheetsTab] After subcontractor filter:', loadedTimesheets.length, 'timesheets');
      }

      if (filters.siteId) {
        console.log('[PlantAssetsTimesheetsTab] Filtering by siteId:', filters.siteId);
        loadedTimesheets = loadedTimesheets.filter(t => t.siteId === filters.siteId);
        console.log('[PlantAssetsTimesheetsTab] After siteId filter:', loadedTimesheets.length, 'timesheets');
      }

      console.log('[PlantAssetsTimesheetsTab] Final filtered count:', loadedTimesheets.length, 'timesheets');
      if (loadedTimesheets.length > 0) {
        console.log('[PlantAssetsTimesheetsTab] First timesheet sample:', JSON.stringify(loadedTimesheets[0], null, 2));
      }
      
      setTimesheets(loadedTimesheets);
    } catch (error) {
      console.error('[PlantAssetsTimesheetsTab] ❌ Error loading agreed timesheets:', error);
      console.error('[PlantAssetsTimesheetsTab] Error details:', JSON.stringify(error, null, 2));
      setTimesheets([]);
    } finally {
      setLoading(false);
    }
  };

  const groupTimesheets = () => {
    const groupMap = new Map<string, TimesheetGroup>();

    timesheets.forEach(timesheet => {
      let key: string;
      let title: string;
      let subtitle: string;

      if (viewMode === 'plant') {
        key = `${timesheet.assetId || timesheet.plantNumber}`;
        title = `${timesheet.assetType || 'Unknown Asset'}`;
        subtitle = timesheet.plantNumber || timesheet.registrationNumber || timesheet.assetId || 'N/A';
      } else {
        key = timesheet.operatorId || timesheet.operatorName;
        title = timesheet.operatorName;
        subtitle = `Operator ID: ${timesheet.operatorId || 'N/A'}`;
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          title,
          subtitle,
          entries: [],
          dateGroups: [],
        });
      }

      const group = groupMap.get(key)!;
      group.entries.push(timesheet);
    });

    groupMap.forEach(group => {
      const dateMap = new Map<string, DateGroup>();
      
      group.entries.forEach(entry => {
        if (!dateMap.has(entry.date)) {
          dateMap.set(entry.date, {
            date: entry.date,
          });
        }
        
        const dateGroup = dateMap.get(entry.date)!;
        
        if (entry.hasOriginalEntry && entry.originalEntryData) {
          dateGroup.originalEntry = entry.originalEntryData as VerifiedTimesheet;
          dateGroup.adjustmentEntry = entry;
        } else if (!dateGroup.adjustmentEntry) {
          dateGroup.adjustmentEntry = entry;
        }
      });
      
      group.dateGroups = Array.from(dateMap.values()).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });

    setGroups(Array.from(groupMap.values()));
  };

  const toggleGroupExpansion = (key: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const toggleShowOriginals = (key: string) => {
    setShowOriginalTimesheets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleExport = () => {
    setExportType(viewMode === 'plant' ? 'plantHours' : 'workerTimesheets');
    setExportModalVisible(true);
  };

  const handleGenerateReport = () => {
    setReportModalVisible(true);
  };

  const handleReportGenerate = async (options: {
    scope: 'all' | 'selected';
    deliveryMethod: 'download' | 'email';
    recipientEmail?: string;
  }) => {
    console.log('[PlantAssetsTimesheetsTab] ===== GENERATING REPORT =====');
    console.log('[PlantAssetsTimesheetsTab] Options:', JSON.stringify(options));
    console.log('[PlantAssetsTimesheetsTab] Total groups:', groups.length);
    console.log('[PlantAssetsTimesheetsTab] Selected groups size:', selectedGroups.size);
    console.log('[PlantAssetsTimesheetsTab] Selected groups:', Array.from(selectedGroups));
    console.log('[PlantAssetsTimesheetsTab] View mode:', viewMode);
    console.log('[PlantAssetsTimesheetsTab] Groups data:', JSON.stringify(groups.slice(0, 2), null, 2));

    try {
      const subcontractorName = filters.subcontractorId 
        ? subcontractors.find(s => s.id === filters.subcontractorId)?.name
        : undefined;

      console.log('[PlantAssetsTimesheetsTab] Subcontractor name:', subcontractorName);
      console.log('[PlantAssetsTimesheetsTab] Calling generateTimesheetPDF...');

      const { uri, fileName } = await generateTimesheetPDF({
        groups,
        reportType: viewMode,
        subcontractorName,
        dateRange: {
          from: filters.fromDate || new Date(new Date().setDate(1)),
          to: filters.toDate || new Date(),
        },
        selectedOnly: options.scope === 'selected',
        selectedGroups: options.scope === 'selected' ? selectedGroups : undefined,
      });

      console.log('[PlantAssetsTimesheetsTab] PDF generated successfully:');
      console.log('[PlantAssetsTimesheetsTab] URI:', uri);
      console.log('[PlantAssetsTimesheetsTab] Filename:', fileName);

      if (options.deliveryMethod === 'email') {
        console.log('[PlantAssetsTimesheetsTab] Opening email composer...');
        await emailTimesheetPDF(uri, fileName, {
          recipientEmail: options.recipientEmail,
        });
      } else {
        console.log('[PlantAssetsTimesheetsTab] Downloading/sharing report...');
        await downloadTimesheetPDF(uri, fileName);
      }

      console.log('[PlantAssetsTimesheetsTab] ===== REPORT GENERATION COMPLETE =====');
    } catch (error) {
      console.error('[PlantAssetsTimesheetsTab] ❌ Error generating report:', error);
      console.error('[PlantAssetsTimesheetsTab] Error details:', JSON.stringify(error, null, 2));
      Alert.alert(
        'Error',
        `Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}. Check console for details.`
      );
      throw error;
    }
  };

  const renderTimesheetRow = (timesheet: VerifiedTimesheet, isOriginal: boolean = false, rowBg: string) => {
    const rowLabel = isOriginal ? 'ORIG' : 'PM';
    const rowLabelColor = isOriginal ? '#64748b' : '#3b82f6';
    
    if (viewMode === 'plant') {
      return (
        <View style={[styles.timesheetRow, { backgroundColor: rowBg }]}>
          <View style={styles.dateCell}>
            <Text style={styles.cellText}>{new Date(timesheet.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</Text>
            <View style={[styles.rowBadge, { backgroundColor: rowLabelColor }]}>
              <Text style={styles.rowBadgeText}>{rowLabel}</Text>
            </View>
          </View>
          <Text style={[styles.operatorCell, styles.cellText]} numberOfLines={2}>{timesheet.operatorName}</Text>
          <Text style={[styles.hoursCell, styles.cellText]}>{timesheet.openHours}</Text>
          <Text style={[styles.hoursCell, styles.cellText]}>{timesheet.closeHours}</Text>
          <Text style={[styles.hoursCell, styles.cellText]}>
            {timesheet.actualHours?.toFixed(1)}h
          </Text>
          <Text style={[styles.hoursCell, styles.cellText, styles.boldText, { color: '#10b981' }]}>
            {timesheet.billableHours?.toFixed(1)}h
          </Text>
          <Text style={[styles.hoursCell, styles.cellText]}>
            {timesheet.assetRate ? `R${timesheet.assetRate.toFixed(2)}` : '-'}
          </Text>
          <Text style={[styles.hoursCell, styles.cellText, styles.boldText, { color: '#1e3a8a' }]}>
            {timesheet.totalCost ? `R${timesheet.totalCost.toFixed(2)}` : '-'}
          </Text>
          <Text style={[styles.hoursCell, styles.cellText]}>
            {timesheet.fuelAmount ? timesheet.fuelAmount.toFixed(1) : '-'}
          </Text>
          <Text style={[styles.hoursCell, styles.cellText]}>
            {timesheet.fuelMeterReading ? `${timesheet.fuelMeterReading.toFixed(0)}${timesheet.fuelMeterType === 'HOUR_METER' ? 'h' : 'km'}` : '-'}
          </Text>
          <Text style={[styles.hoursCell, styles.cellText]}>
            {timesheet.fuelConsumption ? timesheet.fuelConsumption.toFixed(2) : '-'}
          </Text>
          <Text style={[styles.verifiedCell, styles.cellText, styles.smallText]}>
            {new Date(timesheet.verifiedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </Text>
        </View>
      );
    } else {
      return (
        <View style={[styles.timesheetRow, { backgroundColor: rowBg }]}>
          <View style={styles.dateCell}>
            <Text style={styles.cellText}>{new Date(timesheet.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</Text>
            <View style={[styles.rowBadge, { backgroundColor: rowLabelColor }]}>
              <Text style={styles.rowBadgeText}>{rowLabel}</Text>
            </View>
          </View>
          <Text style={[styles.timeCell, styles.cellText]}>{timesheet.startTime}</Text>
          <Text style={[styles.timeCell, styles.cellText]}>{timesheet.stopTime}</Text>
          <Text style={[styles.hoursCell, styles.cellText, styles.boldText]}>
            {timesheet.totalManHours?.toFixed(1)}h
          </Text>
          <Text style={[styles.hoursCell, styles.cellText]}>
            {timesheet.normalHours?.toFixed(1)}h
          </Text>
          <Text style={[styles.hoursCell, styles.cellText]}>
            {timesheet.overtimeHours?.toFixed(1)}h
          </Text>
          <Text style={[styles.verifiedCell, styles.cellText, styles.smallText]}>
            {new Date(timesheet.verifiedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </Text>
        </View>
      );
    }
  };

  const toggleGroupSelection = (key: string) => {
    setSelectedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const renderGroup = ({ item }: { item: TimesheetGroup }) => {
    const isExpanded = expandedGroups.has(item.key);
    const showOriginals = showOriginalTimesheets.has(item.key);
    const hasAdjustments = item.dateGroups.some(dg => dg.originalEntry);
    const isSelected = selectedGroups.has(item.key);
    
    const totals = item.dateGroups.reduce((acc, dateGroup) => {
      const entry = dateGroup.adjustmentEntry || dateGroup.originalEntry;
      if (entry && viewMode === 'plant') {
        return {
          actualHours: acc.actualHours + (entry.actualHours || 0),
          billableHours: acc.billableHours + (entry.billableHours || 0),
          totalCost: acc.totalCost + (entry.totalCost || 0),
        };
      }
      return acc;
    }, { actualHours: 0, billableHours: 0, totalCost: 0 });

    return (
      <View style={styles.groupCard}>
        <View style={styles.groupHeader}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => toggleGroupSelection(item.key)}
            activeOpacity={0.7}
          >
            {isSelected ? (
              <CheckSquare size={24} color="#10b981" />
            ) : (
              <Square size={24} color="#94a3b8" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.groupHeaderContent}
            onPress={() => toggleGroupExpansion(item.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.groupTitle}>{item.title}</Text>
            <Text style={styles.groupSubtitle}>{item.subtitle}</Text>
            <View style={styles.groupMeta}>
              <Text style={styles.groupMetaText}>
                {item.dateGroups.length} days
              </Text>
              {hasAdjustments && (
                <View style={styles.adjustmentIndicator}>
                  <AlertCircle size={14} color="#f59e0b" />
                  <Text style={styles.adjustmentText}>Has Adjustments</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => toggleGroupExpansion(item.key)}
            activeOpacity={0.7}
          >
            {isExpanded ? (
              <ChevronUp size={24} color="#64748b" />
            ) : (
              <ChevronDown size={24} color="#64748b" />
            )}
          </TouchableOpacity>
        </View>

        {isExpanded && (
          <View style={styles.groupContent}>
            {hasAdjustments && (
              <TouchableOpacity
                style={styles.showOriginalsButton}
                onPress={() => toggleShowOriginals(item.key)}
              >
                {showOriginals ? (
                  <ChevronUp size={18} color="#3b82f6" />
                ) : (
                  <ChevronDown size={18} color="#3b82f6" />
                )}
                <Text style={styles.showOriginalsText}>
                  {showOriginals ? 'Hide' : 'Show'} Original Operator Entries
                </Text>
              </TouchableOpacity>
            )}
            
            <ScrollView horizontal showsHorizontalScrollIndicator={true} persistentScrollbar={true}>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={styles.dateHeaderCell}>Date</Text>
                  {viewMode === 'plant' ? (
                    <>
                      <Text style={styles.operatorHeaderCell}>Operator</Text>
                      <Text style={styles.hoursHeaderCell}>Open</Text>
                      <Text style={styles.hoursHeaderCell}>Close</Text>
                      <Text style={styles.hoursHeaderCell}>Actual</Text>
                      <Text style={styles.hoursHeaderCell}>Billable</Text>
                      <Text style={styles.hoursHeaderCell}>Rate</Text>
                      <Text style={styles.hoursHeaderCell}>Cost</Text>
                      <Text style={styles.hoursHeaderCell}>Fuel (L)</Text>
                      <Text style={styles.hoursHeaderCell}>Meter</Text>
                      <Text style={styles.hoursHeaderCell}>L/h</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.timeHeaderCell}>Start</Text>
                      <Text style={styles.timeHeaderCell}>Stop</Text>
                      <Text style={styles.hoursHeaderCell}>Total</Text>
                      <Text style={styles.hoursHeaderCell}>Normal</Text>
                      <Text style={styles.hoursHeaderCell}>Overtime</Text>
                    </>
                  )}
                  <Text style={styles.verifiedHeaderCell}>Verified</Text>
                </View>

                {item.dateGroups.map((dateGroup, index) => {
                  const rowBg = index % 2 === 0 ? '#f8fafc' : '#ffffff';
                  const hasOriginal = !!dateGroup.originalEntry;
                  
                  return (
                    <View key={dateGroup.date}>
                      {showOriginals && hasOriginal && dateGroup.originalEntry && (
                        renderTimesheetRow(dateGroup.originalEntry, true, rowBg)
                      )}
                      {dateGroup.adjustmentEntry && (
                        renderTimesheetRow(dateGroup.adjustmentEntry, false, rowBg)
                      )}
                    </View>
                  );
                })}
                
                {viewMode === 'plant' && (
                  <View style={[styles.timesheetRow, styles.summaryRow]}>
                    <View style={styles.dateCell}>
                      <Text style={[styles.cellText, styles.boldText]}>TOTALS</Text>
                    </View>
                    <Text style={[styles.operatorCell, styles.cellText]} />
                    <Text style={[styles.hoursCell, styles.cellText]} />
                    <Text style={[styles.hoursCell, styles.cellText]} />
                    <Text style={[styles.hoursCell, styles.cellText, styles.boldText]}>
                      {totals.actualHours.toFixed(1)}h
                    </Text>
                    <Text style={[styles.hoursCell, styles.cellText, styles.boldText, { color: '#10b981' }]}>
                      {totals.billableHours.toFixed(1)}h
                    </Text>
                    <Text style={[styles.hoursCell, styles.cellText]} />
                    <Text style={[styles.hoursCell, styles.cellText, styles.boldText, { color: '#1e3a8a' }]}>
                      {totals.totalCost > 0 ? `R${totals.totalCost.toFixed(2)}` : '-'}
                    </Text>
                    <Text style={[styles.hoursCell, styles.cellText]} />
                    <Text style={[styles.hoursCell, styles.cellText]} />
                    <Text style={[styles.hoursCell, styles.cellText]} />
                    <Text style={[styles.verifiedCell, styles.cellText]} />
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const handleApplyFilters = () => {
    onFiltersChange({
      ...filters,
      subcontractorId: tempSubcontractor || undefined,
      assetId: tempAsset || undefined,
      fromDate: tempStartDate,
      toDate: tempEndDate,
    });
    setShowSelector(false);
  };

  const handleClearSelection = () => {
    setTempSubcontractor(null);
    setTempAsset(null);
    setPlantAssets([]);
    onFiltersChange({});
    setShowSelector(true);
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleDateChange = (type: 'start' | 'end', dateString: string) => {
    const date = new Date(dateString);
    if (type === 'start') {
      setTempStartDate(date);
    } else {
      setTempEndDate(date);
    }
  };

  if (showSelector) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.selectorContainer}>
          <View style={styles.selectorSection}>
            <Text style={styles.selectorLabel}>Select Subcontractor:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subList}>
              {subcontractors.map(sub => (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.subButton,
                    tempSubcontractor === sub.id && styles.subButtonActive,
                  ]}
                  onPress={() => setTempSubcontractor(sub.id)}
                >
                  <Text
                    style={[
                      styles.subButtonText,
                      tempSubcontractor === sub.id && styles.subButtonTextActive,
                    ]}
                  >
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {tempSubcontractor && (
            <View style={styles.selectorSection}>
              <View style={styles.dateRangeContainer}>
                <View style={styles.dateRangeHeader}>
                  <Calendar size={20} color="#1e3a8a" />
                  <Text style={styles.dateRangeTitle}>Date Range</Text>
                </View>
                
                <View style={styles.datePickersRow}>
                  <View style={styles.datePickerBlock}>
                    <Text style={styles.datePickerLabel}>Start Date</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={tempStartDate.toISOString().split('T')[0]}
                        onChange={(e: any) => handleDateChange('start', e.target.value)}
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
                      <TouchableOpacity style={styles.dateButton}>
                        <Calendar size={18} color="#64748b" />
                        <Text style={styles.dateButtonText}>{formatDate(tempStartDate)}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.datePickerBlock}>
                    <Text style={styles.datePickerLabel}>End Date</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={tempEndDate.toISOString().split('T')[0]}
                        onChange={(e: any) => handleDateChange('end', e.target.value)}
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
                      <TouchableOpacity style={styles.dateButton}>
                        <Calendar size={18} color="#64748b" />
                        <Text style={styles.dateButtonText}>{formatDate(tempEndDate)}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              <Text style={styles.selectorLabel}>Select Plant Asset:</Text>
              {plantAssets.length > 0 ? (
                <FlatList
                  data={plantAssets}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.assetCard,
                        tempAsset === item.assetId && styles.assetCardActive,
                      ]}
                      onPress={() => setTempAsset(item.assetId)}
                    >
                      <View style={styles.assetCardContent}>
                        <Text style={styles.assetType}>{item.type}</Text>
                        <Text style={styles.assetNumber}>
                          {item.plantNumber || item.registrationNumber || item.assetId}
                        </Text>
                      </View>
                      {tempAsset === item.assetId && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.emptyAssets}>
                  <Text style={styles.emptyText}>No plant assets found for this subcontractor</Text>
                </View>
              )}

              {tempAsset && (
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={handleApplyFilters}
                >
                  <Text style={styles.applyButtonText}>View Timesheets</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backToSelectorButton}
        onPress={handleClearSelection}
      >
        <ChevronDown size={24} color="#1e3a8a" style={{ transform: [{ rotate: '90deg' }] }} />
        <Text style={styles.backToSelectorText}>Back to Assets</Text>
      </TouchableOpacity>
      <FiltersBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        subcontractors={subcontractors}
        showAssetFilters
      />

      {selectedGroups.size > 0 && (
        <View style={styles.selectionBanner}>
          <CheckSquare size={18} color="#10b981" />
          <Text style={styles.selectionBannerText}>
            {selectedGroups.size} {viewMode === 'plant' ? 'asset' : 'operator'}{selectedGroups.size > 1 ? 's' : ''} selected
          </Text>
          <TouchableOpacity 
            onPress={() => setSelectedGroups(new Set())}
            style={styles.clearSelectionButton}
          >
            <Text style={styles.clearSelectionText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.controls}>
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'plant' && styles.toggleButtonActive]}
            onPress={() => setViewMode('plant')}
            testID="view-plant"
          >
            <Truck size={18} color={viewMode === 'plant' ? '#3b82f6' : '#64748b'} />
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === 'plant' && styles.toggleButtonTextActive,
              ]}
            >
              Plant Hours ({groups.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'man' && styles.toggleButtonActive]}
            onPress={() => setViewMode('man')}
            testID="view-man"
          >
            <User size={18} color={viewMode === 'man' ? '#10b981' : '#64748b'} />
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === 'man' && styles.toggleButtonTextActive,
              ]}
            >
              Man Hours ({groups.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.generateReportButton}
            onPress={handleGenerateReport}
            testID="generate-report-button"
          >
            <FileText size={18} color="#ffffff" />
            <Text style={styles.generateReportButtonText}>Generate Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            testID="export-button"
          >
            <FileDown size={18} color="#ffffff" />
            <Text style={styles.exportButtonText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading approved billing timesheets...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyState}>
          {viewMode === 'plant' ? (
            <Truck size={48} color="#cbd5e1" />
          ) : (
            <User size={48} color="#cbd5e1" />
          )}
          <Text style={styles.emptyTitle}>No approved timesheets for billing</Text>
          <Text style={styles.emptyText}>
            {viewMode === 'plant'
              ? 'No plant hours timesheets have been approved from EPH yet'
              : 'No man hours timesheets have been approved from EPH yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.key}
          renderItem={renderGroup}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ExportRequestModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        onSubmit={onExport}
        exportType={exportType}
        prefilledFilters={filters}
      />

      <ReportGenerationModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onGenerate={handleReportGenerate}
        hasSelection={selectedGroups.size > 0}
        selectedCount={selectedGroups.size}
        totalCount={groups.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  viewModeToggle: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  toggleButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  toggleButtonTextActive: {
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  generateReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#10b981',
    borderRadius: 8,
  },
  generateReportButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  listContent: {
    padding: 16,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  checkboxContainer: {
    padding: 4,
  },
  groupHeaderContent: {
    flex: 1,
  },
  expandButton: {
    padding: 4,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  groupSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupMetaText: {
    fontSize: 12,
    color: '#64748b',
  },
  adjustmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adjustmentText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#f59e0b',
  },
  groupContent: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  dateHeaderCell: {
    width: 120,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#ffffff',
    textTransform: 'uppercase' as const,
  },
  operatorHeaderCell: {
    width: 160,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#ffffff',
    textTransform: 'uppercase' as const,
  },
  hoursHeaderCell: {
    width: 100,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#ffffff',
    textTransform: 'uppercase' as const,
  },
  timeHeaderCell: {
    width: 120,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#ffffff',
    textTransform: 'uppercase' as const,
  },
  verifiedHeaderCell: {
    width: 120,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#ffffff',
    textTransform: 'uppercase' as const,
  },
  timesheetRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  showOriginalsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  showOriginalsText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  dateCell: {
    width: 120,
    justifyContent: 'center',
  },
  operatorCell: {
    width: 160,
    justifyContent: 'center',
  },
  hoursCell: {
    width: 100,
    justifyContent: 'center',
  },
  timeCell: {
    width: 120,
    justifyContent: 'center',
  },
  verifiedCell: {
    width: 120,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 13,
    color: '#475569',
  },
  boldText: {
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  smallText: {
    fontSize: 11,
  },
  rowBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  rowBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  summaryRow: {
    backgroundColor: '#f1f5f9',
    borderTopWidth: 2,
    borderTopColor: '#1e3a8a',
    borderBottomWidth: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  selectorContainer: {
    flex: 1,
  },
  selectorSection: {
    padding: 16,
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 12,
  },
  subList: {
    flexDirection: 'row',
    marginBottom: 16,
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
  dateRangeContainer: {
    marginBottom: 16,
  },
  dateRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  assetCardActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  assetCardContent: {
    flex: 1,
  },
  assetType: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  assetNumber: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  selectedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  emptyAssets: {
    padding: 32,
    alignItems: 'center',
  },
  applyButton: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  backToSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backToSelectorText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e3a8a',
    marginLeft: 4,
  },
  selectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#d1fae5',
    borderBottomWidth: 1,
    borderBottomColor: '#10b981',
  },
  selectionBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#065f46',
  },
  clearSelectionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  clearSelectionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#10b981',
  },
});
