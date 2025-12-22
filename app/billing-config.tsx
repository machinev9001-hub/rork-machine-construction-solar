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
import { DollarSign, Save, Clock, Calendar, FileText, CloudRain, Wrench, AlertTriangle, ChevronDown, ChevronUp, CalendarDays, ClipboardList, Edit3, CheckSquare, Square, Send, GitCompare } from 'lucide-react-native';
import { Alert } from 'react-native';
import { collection, getDocs, query, where, orderBy, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset, Subcontractor } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { HeaderTitleWithSync } from '@/components/HeaderSyncStatus';
import AgreedHoursModal from '@/components/accounts/AgreedHoursModal';
import ReportGenerationModal from '@/components/accounts/ReportGenerationModal';
import EditEPHHoursModal from '@/components/accounts/EditEPHHoursModal';
import TimesheetComparisonModal from '@/components/accounts/TimesheetComparisonModal';
import SendConfirmationModal from '@/components/accounts/SendConfirmationModal';
import { agreePlantAssetTimesheet, getAgreedTimesheetByOriginalId, directApproveEPHTimesheets } from '@/utils/agreedTimesheetManager';
import { generateTimesheetPDF, downloadTimesheetPDF, emailTimesheetPDF } from '@/utils/timesheetPdfGenerator';
import { createPendingEdit, getAllPendingEditsByAssetId, supersedePendingEdit, EPHPendingEdit } from '@/utils/ephPendingEditsManager';
import { sendEPHToSubcontractor } from '@/utils/ephEmailService';
import { calculateBillableHours, BillingConfigForCalculation, BillableHoursResult } from '@/utils/billableHoursCalculator';

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
  breakdown: {
    enabled: boolean;
  };
};

type TabType = 'config' | 'eph' | 'timesheets';
type TimesheetsSubTab = 'machine' | 'man';
type ConfigSubTab = 'machine' | 'man';

type EPHRecord = {
  assetId: string;
  assetType: string;
  plantNumber?: string;
  registrationNumber?: string;
  rate: number;
  rateType: 'wet' | 'dry';
  // Actual/Normal hours (raw clock hours)
  actualNormalHours: number;
  actualSaturdayHours: number;
  actualSundayHours: number;
  actualPublicHolidayHours: number;
  actualBreakdownHours: number;
  actualRainDayHours: number;
  actualStrikeDayHours: number;
  totalActualHours: number;
  // Billable hours (calculated based on billing config rules)
  billableNormalHours: number;
  billableSaturdayHours: number;
  billableSundayHours: number;
  billablePublicHolidayHours: number;
  billableBreakdownHours: number;
  billableRainDayHours: number;
  billableStrikeDayHours: number;
  totalBillableHours: number;
  estimatedCost: number;
  rawTimesheets: TimesheetEntry[];
  billingResults: BillableHoursResult[];
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
  operatorNotes?: string;
  additionalNotes?: string;
  adminNotes?: string;
  billingNotes?: string;
  comment?: string;
  comments?: string;
  extraNotes?: string;
  rawNotes?: string;
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
  sourceEntryId: string;
  timestamp: number;
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

const sanitizeNotes = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const normalized = trimmed
    .replace(/,/g, '.')
    .replace(/:/g, '.')
    .replace(/\s+/g, '')
    .toLowerCase();
  if (/^(\d+(\.\d+)?)(h|hr|hrs|hour|hours)?$/.test(normalized)) {
    return undefined;
  }
  const lowerTrimmed = trimmed.toLowerCase();
  const hourPatterns = [
    /^\d+[.,:]?\d*\s*(h|hr|hrs|hour|hours)$/,
    /^(h|hr|hrs|hour|hours)\s*[.,:]?\s*\d+[.,:]?\d*$/,
    /^\d+[.,:]?\d*$/,
  ];
  for (const pattern of hourPatterns) {
    if (pattern.test(lowerTrimmed)) {
      return undefined;
    }
  }
  return trimmed;
};

const noteFieldCandidates: (keyof TimesheetEntry)[] = [
  'notes',
  'operatorNotes',
  'additionalNotes',
  'adminNotes',
  'billingNotes',
  'comment',
  'comments',
  'extraNotes',
  'rawNotes',
];

const resolveDisplayNotes = (entry?: Partial<TimesheetEntry>): string | undefined => {
  if (!entry) {
    return undefined;
  }

  for (const field of noteFieldCandidates) {
    const value = entry[field];
    if (typeof value === 'string') {
      const sanitized = sanitizeNotes(value);
      if (sanitized) {
        return sanitized;
      }
    }
  }

  if (entry.originalEntryData) {
    return resolveDisplayNotes(entry.originalEntryData);
  }

  return undefined;
};

const buildDisplayRow = (
  entry: Partial<TimesheetEntry> & { id?: string },
  type: 'original' | 'adjusted',
  sourceEntryId: string,
  timestamp: number,
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
    notes: resolveDisplayNotes(entry),
    isRainDay: Boolean(entry.isRainDay),
    isStrikeDay: Boolean(entry.isStrikeDay),
    isBreakdown: Boolean(entry.isBreakdown),
    isPublicHoliday: Boolean(entry.isPublicHoliday),
    sourceEntryId,
    timestamp,
  };
};

const buildTimesheetGroups = (entries: TimesheetEntry[]): TimesheetDisplayGroup[] => {
  const groupMap = new Map<string, TimesheetDisplayGroup>();

  console.log('[buildTimesheetGroups] Processing', entries.length, 'entries');

  entries.forEach((entry, idx) => {
    const key = entry.date;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        date: key,
        rows: [],
        hasAdjustments: false,
      });
    }

    const group = groupMap.get(key)!;
    const sourceEntryId = getSourceEntryId(entry);
    const entryTimestamp = getEntryTimestamp(entry);
    const isPMEntry = Boolean(entry.hasOriginalEntry || entry.isAdjustment || entry.adjustedBy);

    console.log(`[buildTimesheetGroups] Entry ${idx}:`, {
      id: entry.id?.substring(0, 8),
      isPMEntry,
      hasOriginalEntry: entry.hasOriginalEntry,
      isAdjustment: entry.isAdjustment,
      adjustedBy: entry.adjustedBy,
      hasOriginalData: !!entry.originalEntryData,
      originalHours: entry.originalEntryData?.totalHours,
      currentHours: entry.totalHours,
    });

    if (isPMEntry && entry.originalEntryData) {
      console.log(`[buildTimesheetGroups] Creating ORIG row from originalEntryData for entry ${idx}`);
      const originalRow = buildDisplayRow(
        {
          ...entry.originalEntryData,
          id: entry.originalEntryId ?? `${entry.id}-orig`,
          date: entry.date,
        },
        'original',
        sourceEntryId,
        entryTimestamp - 1,
      );
      group.rows.push(originalRow);
      console.log(`[buildTimesheetGroups] Added ORIG row:`, {
        badge: originalRow.badgeLabel,
        hours: originalRow.totalHours,
        operator: originalRow.operatorName,
      });
    }

    const rowType: 'original' | 'adjusted' = isPMEntry ? 'adjusted' : 'original';
    const mainRow = buildDisplayRow(entry, rowType, sourceEntryId, entryTimestamp);
    group.rows.push(mainRow);
    console.log(`[buildTimesheetGroups] Added ${rowType.toUpperCase()} row:`, {
      badge: mainRow.badgeLabel,
      hours: mainRow.totalHours,
      operator: mainRow.operatorName,
    });
  });

  const groups = Array.from(groupMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  groups.forEach((group) => {
    const dateOperatorPairs = new Map<string, { original?: TimesheetDisplayRow; pm?: TimesheetDisplayRow }>();
    
    group.rows.forEach((row) => {
      const pairKey = `${row.isoDate}-${row.sourceEntryId}`;
      if (!dateOperatorPairs.has(pairKey)) {
        dateOperatorPairs.set(pairKey, {});
      }
      const pair = dateOperatorPairs.get(pairKey)!;
      
      if (row.badgeLabel === 'ORIG') {
        if (!pair.original || row.timestamp > pair.original.timestamp) {
          pair.original = row;
        }
      } else {
        if (!pair.pm || row.timestamp > pair.pm.timestamp) {
          pair.pm = row;
        }
      }
    });

    const dedupedRows: TimesheetDisplayRow[] = [];
    dateOperatorPairs.forEach((pair) => {
      if (pair.original) {
        dedupedRows.push(pair.original);
      }
      if (pair.pm) {
        dedupedRows.push(pair.pm);
      }
    });

    dedupedRows.sort((a, b) => {
      if (a.isOriginal === b.isOriginal) {
        return b.timestamp - a.timestamp;
      }
      return a.isOriginal ? -1 : 1;
    });

    group.rows = dedupedRows;
    group.hasAdjustments = dedupedRows.some(row => !row.isOriginal);
  });

  return groups;
};

const getEntryTimestamp = (entry: TimesheetEntry): number => {
  const timestamps = [entry.adjustedAt, entry.verifiedAt, entry.date];
  for (const value of timestamps) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const getSourceEntryId = (entry: Partial<TimesheetEntry>): string => {
  if (entry.originalEntryId) {
    return entry.originalEntryId;
  }
  if (entry.id) {
    return entry.id;
  }
  const dateKey = entry.date ?? new Date().toISOString();
  const operator = entry.operatorName ?? 'unknown';
  const open = toTimeString(entry.openHours);
  const close = toTimeString(entry.closeHours ?? entry.closingHours);
  return `${dateKey}-${operator}-${open}-${close}`;
};

const deduplicateTimesheetEntries = (entries: TimesheetEntry[]): TimesheetEntry[] => {
  const pairingMap = new Map<string, { plantManager?: TimesheetEntry; operator?: TimesheetEntry }>();
  const processedIds = new Set<string>();

  entries.forEach((entry) => {
    if (processedIds.has(entry.id)) {
      return;
    }

    const isPMEntry = entry.hasOriginalEntry || entry.isAdjustment || Boolean(entry.adjustedBy);
    const dateOperatorKey = `${entry.date}-${entry.operatorName}`;

    if (!pairingMap.has(dateOperatorKey)) {
      pairingMap.set(dateOperatorKey, {});
    }

    const pair = pairingMap.get(dateOperatorKey)!;

    if (isPMEntry) {
      if (!pair.plantManager || getEntryTimestamp(entry) > getEntryTimestamp(pair.plantManager)) {
        if (pair.plantManager) {
          processedIds.delete(pair.plantManager.id);
        }
        pair.plantManager = entry;
        processedIds.add(entry.id);
      }
    } else {
      if (!pair.operator || getEntryTimestamp(entry) > getEntryTimestamp(pair.operator)) {
        if (pair.operator) {
          processedIds.delete(pair.operator.id);
        }
        pair.operator = entry;
        processedIds.add(entry.id);
      }
    }
  });

  const result: TimesheetEntry[] = [];
  pairingMap.forEach((pair) => {
    if (pair.operator) {
      result.push(pair.operator);
    }
    if (pair.plantManager) {
      result.push(pair.plantManager);
    }
  });

  return result;
};

// Returns only the effective entry per date (PM entry takes priority over operator entry)
// This is used for billing calculations where we should only count one value per date
const getEffectiveEntriesForBilling = (entries: TimesheetEntry[]): TimesheetEntry[] => {
  const pairingMap = new Map<string, { plantManager?: TimesheetEntry; operator?: TimesheetEntry }>();
  const processedIds = new Set<string>();

  entries.forEach((entry) => {
    if (processedIds.has(entry.id)) {
      return;
    }

    const isPMEntry = entry.hasOriginalEntry || entry.isAdjustment || Boolean(entry.adjustedBy);
    const dateOperatorKey = `${entry.date}-${entry.operatorName}`;

    if (!pairingMap.has(dateOperatorKey)) {
      pairingMap.set(dateOperatorKey, {});
    }

    const pair = pairingMap.get(dateOperatorKey)!;

    if (isPMEntry) {
      if (!pair.plantManager || getEntryTimestamp(entry) > getEntryTimestamp(pair.plantManager)) {
        if (pair.plantManager) {
          processedIds.delete(pair.plantManager.id);
        }
        pair.plantManager = entry;
        processedIds.add(entry.id);
      }
    } else {
      if (!pair.operator || getEntryTimestamp(entry) > getEntryTimestamp(pair.operator)) {
        if (pair.operator) {
          processedIds.delete(pair.operator.id);
        }
        pair.operator = entry;
        processedIds.add(entry.id);
      }
    }
  });

  // Return only the effective entry per date: PM entry if exists, otherwise operator entry
  const result: TimesheetEntry[] = [];
  pairingMap.forEach((pair) => {
    if (pair.plantManager) {
      // PM entry takes priority - only include this one
      result.push(pair.plantManager);
    } else if (pair.operator) {
      // Only include operator entry if no PM entry exists
      result.push(pair.operator);
    }
  });

  return result;
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
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  
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
    breakdown: {
      enabled: true,
    },
  });
  const [timesheetGroups, setTimesheetGroups] = useState<TimesheetDisplayGroup[]>([]);
  const [showOriginalRows, setShowOriginalRows] = useState(true);
  const [agreedHoursModalVisible, setAgreedHoursModalVisible] = useState(false);
  const [selectedTimesheetForAgreement, setSelectedTimesheetForAgreement] = useState<any>(null);
  const [ephTimesheets, setEphTimesheets] = useState<Map<string, TimesheetEntry[]>>(new Map());
  const [agreedTimesheetIds, setAgreedTimesheetIds] = useState<Set<string>>(new Set());
  const [reportGenerationModalVisible, setReportGenerationModalVisible] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [selectedTimesheetForEdit, setSelectedTimesheetForEdit] = useState<any>(null);
  const [selectedComparison, setSelectedComparison] = useState<any>(null);
  const [pendingEdits, setPendingEdits] = useState<Map<string, EPHPendingEdit[]>>(new Map());
  const [timesheetsSubTab, setTimesheetsSubTab] = useState<TimesheetsSubTab>('machine');
  const [configSubTab, setConfigSubTab] = useState<ConfigSubTab>('machine');
  const [globalBillingMethod, setGlobalBillingMethod] = useState<BillingMethod>('PER_HOUR');
  const [expandedDayCards, setExpandedDayCards] = useState<Set<string>>(new Set());

  const totalTimesheetHours = useMemo(() => {
    // Calculate total hours using hierarchy based on timesheetGroups:
    // 1. If admin edit exists -> use admin's hours (highest priority for billing)
    // 2. If plant manager edited -> use plant manager's hours (adjustmentEntry)
    // 3. If only operator entry -> use operator's hours (originalEntry)
    // Each group represents a unique date, and we only count once per date
    
    console.log('[TotalHours] Starting calculation with', timesheetGroups.length, 'date groups');
    
    const assetPendingEdits = selectedAssetForTimesheets 
      ? pendingEdits.get(selectedAssetForTimesheets.assetId) || []
      : [];
    
    let total = 0;
    
    timesheetGroups.forEach(group => {
      // Check for admin edit (highest priority)
      const adminEdit = assetPendingEdits.find(
        edit => edit.date === group.date && edit.editedBy === 'admin' && edit.status === 'pending_review'
      );
      
      if (adminEdit) {
        // Use admin's hours (highest priority)
        total += adminEdit.totalHours;
        console.log(`[TotalHours] Date ${group.date}: Using ADMIN edit hours: ${adminEdit.totalHours}`);
      } else {
        // Use PM entry if it exists (from adjustmentEntry), otherwise use operator entry
        // Find the PM row or ORIG row in the visible rows
        const pmRow = group.rows.find(row => row.badgeLabel === 'PM');
        const origRow = group.rows.find(row => row.badgeLabel === 'ORIG');
        
        if (pmRow) {
          total += pmRow.totalHours;
          console.log(`[TotalHours] Date ${group.date}: Using PM hours: ${pmRow.totalHours}`);
        } else if (origRow) {
          total += origRow.totalHours;
          console.log(`[TotalHours] Date ${group.date}: Using OPERATOR hours: ${origRow.totalHours}`);
        } else if (group.rows.length > 0) {
          // Fallback to first row if no PM or ORIG badge found
          total += group.rows[0].totalHours;
          console.log(`[TotalHours] Date ${group.date}: Using fallback hours: ${group.rows[0].totalHours}`);
        }
      }
    });
    
    console.log(`[TotalHours] Final calculated total: ${total}h from ${timesheetGroups.length} date groups`);
    return total;
  }, [timesheetGroups, pendingEdits, selectedAssetForTimesheets]);

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
      console.log('[EPH] Generating EPH report for date range:', startDate.toISOString(), 'to', endDate.toISOString());
      console.log('[EPH] Assets to process:', assets.length);
      console.log('[EPH] Using billing config:', JSON.stringify(config, null, 2));

      const billingCalcConfig: BillingConfigForCalculation = {
        weekdays: { minHours: config.weekdays.minHours || 0 },
        saturday: { minHours: config.saturday.minHours || 0 },
        sunday: { minHours: config.sunday.minHours || 0 },
        publicHolidays: { minHours: config.publicHolidays.minHours || 0 },
        rainDays: { enabled: config.rainDays.enabled, minHours: config.rainDays.minHours },
        breakdown: { enabled: config.breakdown?.enabled ?? true },
      };

      try {
        const ephRecords: EPHRecord[] = await Promise.all(
          assets.map(async (asset) => {
            console.log('[EPH] Processing asset:', asset.assetId, asset.type, asset.plantNumber);
            const timesheetQuery = query(
              collection(db, 'verifiedTimesheets'),
              where('masterAccountId', '==', user?.masterAccountId),
              where('siteId', '==', user?.siteId),
              where('assetId', '==', asset.assetId),
              where('type', '==', 'plant_hours'),
              where('date', '>=', startDate.toISOString().split('T')[0]),
              where('date', '<=', endDate.toISOString().split('T')[0])
            );

            const timesheetSnapshot = await getDocs(timesheetQuery);
            console.log('[EPH] Found', timesheetSnapshot.docs.length, 'verified timesheets for asset:', asset.assetId);
            
            const rawEntries = timesheetSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            })) as TimesheetEntry[];

            setEphTimesheets(prev => {
              const newMap = new Map(prev);
              newMap.set(asset.assetId, rawEntries);
              return newMap;
            });
            
            const dedupedEntries = deduplicateTimesheetEntries(rawEntries);
            // For billing calculations, use only the effective entry per date (PM > operator hierarchy)
            const effectiveEntries = getEffectiveEntriesForBilling(rawEntries);
            console.log('[EPH] After deduplication:', dedupedEntries.length, 'entries, effective for billing:', effectiveEntries.length, 'entries');

            let actualNormalHours = 0;
            let actualSaturdayHours = 0;
            let actualSundayHours = 0;
            let actualPublicHolidayHours = 0;
            let actualBreakdownHours = 0;
            let actualRainDayHours = 0;
            let actualStrikeDayHours = 0;

            let billableNormalHours = 0;
            let billableSaturdayHours = 0;
            let billableSundayHours = 0;
            let billablePublicHolidayHours = 0;
            let billableBreakdownHours = 0;
            let billableRainDayHours = 0;
            let billableStrikeDayHours = 0;

            const billingResults: BillableHoursResult[] = [];
            // Create a map from date to billing result for later lookup in PDF generation
            const billingResultsByDate = new Map<string, BillableHoursResult>();

            // Use effective entries for billing calculations (only one per date based on hierarchy)
            effectiveEntries.forEach((entry) => {
              const actualHours = entry.totalHours || 0;
              const date = new Date(entry.date);
              const dayOfWeek = date.getDay();
              const isBreakdown = entry.isBreakdown || false;
              const isRainDay = entry.isRainDay || false;
              const isStrikeDay = entry.isStrikeDay || false;
              const isPublicHoliday = entry.isPublicHoliday || false;

              const billingResult = calculateBillableHours(
                {
                  startTime: entry.openHours,
                  endTime: entry.closeHours,
                  date: entry.date,
                  isBreakdown,
                  isRainDay,
                  isInclementWeather: isRainDay,
                  isPublicHoliday,
                  totalHours: actualHours,
                },
                billingCalcConfig
              );
              billingResults.push(billingResult);
              billingResultsByDate.set(entry.date, billingResult);

              console.log(`[EPH] Entry ${entry.date}: actual=${actualHours}h, billable=${billingResult.billableHours}h, rule=${billingResult.appliedRule}`);

              if (isBreakdown) {
                actualBreakdownHours += actualHours;
                billableBreakdownHours += billingResult.billableHours;
              } else if (isRainDay) {
                actualRainDayHours += actualHours;
                billableRainDayHours += billingResult.billableHours;
              } else if (isStrikeDay) {
                actualStrikeDayHours += actualHours;
                billableStrikeDayHours += billingResult.billableHours;
              } else if (isPublicHoliday) {
                actualPublicHolidayHours += actualHours;
                billablePublicHolidayHours += billingResult.billableHours;
              } else if (dayOfWeek === 6) {
                actualSaturdayHours += actualHours;
                billableSaturdayHours += billingResult.billableHours;
              } else if (dayOfWeek === 0) {
                actualSundayHours += actualHours;
                billableSundayHours += billingResult.billableHours;
              } else {
                actualNormalHours += actualHours;
                billableNormalHours += billingResult.billableHours;
              }
            });

            const rate = asset.dryRate || asset.wetRate || 0;
            const rateType = asset.dryRate ? 'dry' : 'wet';
            
            const totalActualHours = actualNormalHours + actualSaturdayHours + actualSundayHours + 
              actualPublicHolidayHours + actualBreakdownHours + actualRainDayHours + actualStrikeDayHours;
            
            const totalBillableHours = billableNormalHours + billableSaturdayHours + billableSundayHours + 
              billablePublicHolidayHours + billableBreakdownHours + billableRainDayHours + billableStrikeDayHours;

            console.log(`[EPH] Asset ${asset.assetId}: totalActual=${totalActualHours}h, totalBillable=${totalBillableHours}h, cost=R${(totalBillableHours * rate).toFixed(2)}`);

            return {
              assetId: asset.assetId,
              assetType: asset.type,
              plantNumber: asset.plantNumber,
              registrationNumber: asset.registrationNumber,
              rate,
              rateType: rateType as 'wet' | 'dry',
              actualNormalHours,
              actualSaturdayHours,
              actualSundayHours,
              actualPublicHolidayHours,
              actualBreakdownHours,
              actualRainDayHours,
              actualStrikeDayHours,
              totalActualHours,
              billableNormalHours,
              billableSaturdayHours,
              billableSundayHours,
              billablePublicHolidayHours,
              billableBreakdownHours,
              billableRainDayHours,
              billableStrikeDayHours,
              totalBillableHours,
              estimatedCost: totalBillableHours * rate,
              rawTimesheets: dedupedEntries,
              billingResults,
              billingResultsByDate,
            };
          })
        );

        setEphData(ephRecords);
      } catch (error) {
        console.error('Error generating EPH report:', error);
      }
    },
    [endDate, startDate, user?.masterAccountId, user?.siteId, config]
  );

  const loadPlantAssets = useCallback(
    async (subcontractorId: string) => {
      console.log('[loadPlantAssets] Starting load for subcontractor:', subcontractorId);
      console.log('[loadPlantAssets] Query params:', {
        masterAccountId: user?.masterAccountId,
        siteId: user?.siteId,
        ownerId: subcontractorId,
        ownerType: 'subcontractor'
      });
      
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
        console.log('[loadPlantAssets] Found', snapshot.docs.length, 'assets in query');
        
        const assets = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('[loadPlantAssets] Asset:', doc.id, data);
          return { id: doc.id, ...data } as PlantAsset;
        });
        
        console.log('[loadPlantAssets] Processed assets:', assets.length);
        setPlantAssets(assets);
        
        if (assets.length > 0) {
          console.log('[loadPlantAssets] Generating EPH report for', assets.length, 'assets');
          await generateEPHReport(assets, subcontractorId);
        } else {
          console.log('[loadPlantAssets] ⚠️ No assets found - clearing EPH data');
          setEphData([]);
        }
      } catch (error) {
        console.error('[loadPlantAssets] Error:', error);
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

  const toggleDayCard = (dayType: string) => {
    setExpandedDayCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dayType)) {
        newSet.delete(dayType);
      } else {
        newSet.add(dayType);
      }
      return newSet;
    });
  };

  const applyGlobalBillingMethod = (method: BillingMethod) => {
    setGlobalBillingMethod(method);
    setConfig(prev => ({
      ...prev,
      weekdays: { ...prev.weekdays, billingMethod: method },
      saturday: { ...prev.saturday, billingMethod: method },
      sunday: { ...prev.sunday, billingMethod: method },
      publicHolidays: { ...prev.publicHolidays, billingMethod: method },
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
        const loadedConfig = data as BillingConfig;
        
        // Ensure breakdown config exists (for backward compatibility)
        if (!loadedConfig.breakdown) {
          loadedConfig.breakdown = {
            enabled: true,
          };
        }
        
        setConfig(loadedConfig);
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

  const handleGeneratePDFReport = async (options: {
    scope: 'all' | 'selected';
    deliveryMethod: 'download' | 'email';
    recipientEmail?: string;
  }) => {
    console.log('[PDF] Starting PDF generation with options:', options);
    
    if (!selectedSubcontractor) {
      Alert.alert('Error', 'No subcontractor selected');
      return;
    }

    const selectedAssets = options.scope === 'selected'
      ? ephData.filter(record => selectedAssetIds.has(record.assetId))
      : ephData;

    if (selectedAssets.length === 0) {
      Alert.alert('Error', 'No assets to include in the report');
      return;
    }

    console.log('[PDF] Generating report for', selectedAssets.length, 'assets');

    try {
      setPdfGenerating(true);

      const subcontractor = subcontractors.find(s => s.id === selectedSubcontractor);
      console.log('[PDF] Selected assets:', selectedAssets.map(a => ({ id: a.assetId, type: a.assetType, plant: a.plantNumber })));
      console.log('[PDF] ephTimesheets map has', ephTimesheets.size, 'assets');

      const groups = selectedAssets.map(record => {
        const rawTimesheets = ephTimesheets.get(record.assetId) || record.rawTimesheets || [];
        const timesheets = deduplicateTimesheetEntries(rawTimesheets);
        const billingResultsByDate = record.billingResultsByDate || new Map<string, BillableHoursResult>();
        
        console.log('[PDF] Asset', record.assetId, record.assetType, record.plantNumber, 'has', rawTimesheets.length, 'raw timesheets');
        console.log('[PDF] Sample timesheet data:', rawTimesheets[0]);
        console.log('[PDF] After dedup:', timesheets.length, 'entries');
        console.log('[PDF] Billing results available:', billingResultsByDate.size, 'dates');
        console.log('[PDF] Timesheets:', timesheets.map(ts => ({
          date: ts.date,
          operator: ts.operatorName,
          hours: ts.totalHours,
          open: ts.openHours,
          close: ts.closeHours
        })));
        
        return {
          key: record.assetId,
          title: record.assetType,
          subtitle: record.plantNumber || record.registrationNumber || record.assetId,
          entries: timesheets.map((ts: TimesheetEntry) => {
            // Get the billing result for this date to populate actualHours and billableHours
            const billingResult = billingResultsByDate.get(ts.date);
            
            return {
              id: ts.id,
              date: ts.date,
              operatorName: ts.operatorName,
              operatorId: ts.operatorName || '',
              verified: true,
              verifiedAt: ts.verifiedAt || new Date().toISOString(),
              verifiedBy: ts.adjustedBy || 'system',
              masterAccountId: user?.masterAccountId || '',
              siteId: user?.siteId || '',
              type: 'plant_hours' as const,
              openHours: parseFloat(ts.openHours) || 0,
              closeHours: parseFloat(ts.closeHours) || 0,
              totalHours: ts.totalHours || 0,
              // Use pre-calculated hours from billing logic - DO NOT recalculate in PDF
              actualHours: billingResult?.actualHours ?? ts.totalHours ?? 0,
              billableHours: billingResult?.billableHours ?? ts.totalHours ?? 0,
              assetRate: record.rate,
              totalCost: (billingResult?.billableHours ?? ts.totalHours ?? 0) * record.rate,
              billingRule: billingResult?.appliedRule,
              isBreakdown: ts.isBreakdown,
              inclementWeather: ts.isRainDay,
              isRainDay: ts.isRainDay,
              isStrikeDay: ts.isStrikeDay,
              isPublicHoliday: ts.isPublicHoliday,
              hasAttachment: false,
              assetId: record.assetId,
              assetType: record.assetType,
              plantNumber: record.plantNumber,
              registrationNumber: record.registrationNumber,
              ownerId: selectedSubcontractor,
              ownerType: 'subcontractor' as const,
              ownerName: subcontractor?.name,
              hasOriginalEntry: ts.hasOriginalEntry,
              originalEntryData: ts.originalEntryData,
              isAdjustment: ts.isAdjustment,
              originalEntryId: ts.originalEntryId,
              adjustedBy: ts.adjustedBy,
              adjustedAt: ts.adjustedAt,
              notes: ts.notes || ts.adminNotes || ts.billingNotes,
            };
          }),
          dateGroups: timesheets.map((ts: TimesheetEntry) => {
            const hasAdjustment = ts.hasOriginalEntry || ts.isAdjustment || Boolean(ts.adjustedBy);
            // Get billing result for this date
            const billingResult = billingResultsByDate.get(ts.date);
            // Also get billing result for original entry if it exists
            const originalBillingResult = ts.originalEntryData?.date 
              ? billingResultsByDate.get(ts.originalEntryData.date)
              : undefined;
            
            if (hasAdjustment && ts.originalEntryData) {
              return {
                date: ts.date,
                originalEntry: {
                  ...ts.originalEntryData,
                  id: ts.originalEntryId || ts.id,
                  date: ts.date,
                  operatorName: ts.originalEntryData.operatorName || ts.operatorName,
                  openHours: parseFloat(String(ts.originalEntryData.openHours || 0)),
                  closeHours: parseFloat(String(ts.originalEntryData.closeHours || ts.originalEntryData.closingHours || 0)),
                  totalHours: ts.originalEntryData.totalHours || 0,
                  // For original entry, use totalHours as actualHours since it wasn't agreed
                  actualHours: ts.originalEntryData.totalHours || 0,
                  billableHours: originalBillingResult?.billableHours ?? ts.originalEntryData.totalHours ?? 0,
                  assetRate: record.rate,
                  totalCost: (originalBillingResult?.billableHours ?? ts.originalEntryData.totalHours ?? 0) * record.rate,
                  billingRule: originalBillingResult?.appliedRule,
                  isBreakdown: ts.originalEntryData.isBreakdown,
                  inclementWeather: ts.originalEntryData.isRainDay,
                  isRainDay: ts.originalEntryData.isRainDay,
                  isStrikeDay: ts.originalEntryData.isStrikeDay,
                  isPublicHoliday: ts.originalEntryData.isPublicHoliday,
                  notes: ts.originalEntryData.notes,
                } as any,
                adjustmentEntry: {
                  ...ts,
                  id: ts.id,
                  date: ts.date,
                  operatorName: ts.operatorName,
                  openHours: parseFloat(String(ts.openHours || 0)),
                  closeHours: parseFloat(String(ts.closeHours || ts.closingHours || 0)),
                  totalHours: ts.totalHours || 0,
                  // Use pre-calculated billing hours - this is the agreed version
                  actualHours: billingResult?.actualHours ?? ts.totalHours ?? 0,
                  billableHours: billingResult?.billableHours ?? ts.totalHours ?? 0,
                  assetRate: record.rate,
                  totalCost: (billingResult?.billableHours ?? ts.totalHours ?? 0) * record.rate,
                  billingRule: billingResult?.appliedRule,
                  isBreakdown: ts.isBreakdown,
                  inclementWeather: ts.isRainDay,
                  isRainDay: ts.isRainDay,
                  isStrikeDay: ts.isStrikeDay,
                  isPublicHoliday: ts.isPublicHoliday,
                  notes: ts.notes || ts.adminNotes || ts.billingNotes,
                  adjustedBy: ts.adjustedBy,
                  adjustedAt: ts.adjustedAt,
                } as any,
                agreedEntry: undefined,
              };
            } else {
              return {
                date: ts.date,
                originalEntry: {
                  id: ts.id,
                  date: ts.date,
                  operatorName: ts.operatorName,
                  openHours: parseFloat(String(ts.openHours || 0)),
                  closeHours: parseFloat(String(ts.closeHours || ts.closingHours || 0)),
                  totalHours: ts.totalHours || 0,
                  // Use pre-calculated billing hours
                  actualHours: billingResult?.actualHours ?? ts.totalHours ?? 0,
                  billableHours: billingResult?.billableHours ?? ts.totalHours ?? 0,
                  assetRate: record.rate,
                  totalCost: (billingResult?.billableHours ?? ts.totalHours ?? 0) * record.rate,
                  billingRule: billingResult?.appliedRule,
                  isBreakdown: ts.isBreakdown,
                  inclementWeather: ts.isRainDay,
                  isRainDay: ts.isRainDay,
                  isStrikeDay: ts.isStrikeDay,
                  isPublicHoliday: ts.isPublicHoliday,
                  notes: ts.notes || ts.operatorNotes,
                } as any,
                adjustmentEntry: undefined,
                agreedEntry: undefined,
              };
            }
          }),
        };
      });

      console.log('[PDF] Calling generateTimesheetPDF with', groups.length, 'groups');
      
      const { uri, fileName } = await generateTimesheetPDF({
        groups,
        reportType: 'plant',
        subcontractorName: subcontractor?.name,
        dateRange: {
          from: startDate,
          to: endDate,
        },
        selectedOnly: options.scope === 'selected',
        selectedGroups: options.scope === 'selected' 
          ? new Set(selectedAssets.map(r => r.assetId))
          : undefined,
      });

      console.log('[PDF] PDF generated successfully:', uri);

      if (options.deliveryMethod === 'email') {
        console.log('[PDF] Sending via email to:', options.recipientEmail);
        await emailTimesheetPDF(uri, fileName, {
          recipientEmail: options.recipientEmail,
          subject: `Plant Hours Report - ${subcontractor?.name || 'Unknown'} - ${formatDate(startDate)} to ${formatDate(endDate)}`,
          body: `Please find attached the plant hours timesheet report for ${subcontractor?.name || 'Unknown Subcontractor'}.\n\nDate Range: ${formatDate(startDate)} to ${formatDate(endDate)}\nAssets Included: ${selectedAssets.length}`,
        });
        Alert.alert('Success', 'Report generated and email composer opened');
      } else {
        console.log('[PDF] Downloading/sharing PDF');
        await downloadTimesheetPDF(uri, fileName);
        Alert.alert('Success', 'Report generated successfully');
      }
    } catch (error) {
      console.error('[PDF] Error generating PDF:', error);
      Alert.alert('Error', `Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPdfGenerating(false);
    }
  };

  const renderDayTypeCard = (
    title: string,
    dayType: keyof Omit<BillingConfig, 'rainDays'>,
    icon: string,
    isExpanded: boolean,
    onToggle: () => void
  ) => {
    const dayConfig = config[dayType] as DayTypeConfig;

    return (
      <View style={styles.card}>
        <TouchableOpacity 
          style={styles.cardHeader}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardIcon}>{icon}</Text>
            <Text style={styles.cardTitle}>{title}</Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={24} color="#64748b" />
          ) : (
            <ChevronDown size={24} color="#64748b" />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Enabled</Text>
              <Switch
                value={dayConfig.enabled}
                onValueChange={(value) => updateDayConfig(dayType, 'enabled', value)}
                trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                thumbColor={dayConfig.enabled ? '#ffffff' : '#f3f4f6'}
              />
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

  const renderDayTypeCardMachine = (
    title: string,
    dayType: keyof Omit<BillingConfig, 'rainDays'>,
    icon: string,
    isExpanded: boolean,
    onToggle: () => void
  ) => {
    const dayConfig = config[dayType] as DayTypeConfig;

    return (
      <View style={styles.card}>
        <TouchableOpacity 
          style={styles.cardHeader}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardIcon}>{icon}</Text>
            <Text style={styles.cardTitle}>{title}</Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={24} color="#64748b" />
          ) : (
            <ChevronDown size={24} color="#64748b" />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardContent}>
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
          </View>
        )}
      </View>
    );
  };

  const renderRainDayConfig = () => {
    const isExpanded = expandedDayCards.has('rainDays');
    
    return (
      <View style={styles.card}>
        <TouchableOpacity 
          style={styles.cardHeader}
          onPress={() => toggleDayCard('rainDays')}
          activeOpacity={0.7}
        >
          <View style={styles.cardTitleRow}>
            <CloudRain size={24} color="#3b82f6" style={{ marginRight: 12 }} />
            <Text style={styles.cardTitle}>Rain Day Configuration</Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={24} color="#64748b" />
          ) : (
            <ChevronDown size={24} color="#64748b" />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Enabled</Text>
              <Switch
                value={config.rainDays.enabled}
                onValueChange={(value) => updateRainDayConfig('enabled', value)}
                trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                thumbColor={config.rainDays.enabled ? '#ffffff' : '#f3f4f6'}
              />
            </View>

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
  };

  const updateBreakdownConfig = (field: keyof BillingConfig['breakdown'], value: any) => {
    setConfig(prev => ({
      ...prev,
      breakdown: {
        ...prev.breakdown,
        [field]: value,
      },
    }));
  };

  const renderBreakdownConfig = () => {
    const isExpanded = expandedDayCards.has('breakdown');
    
    if (!config.breakdown) {
      console.error('[Breakdown Config] config.breakdown is undefined');
      return null;
    }
    
    return (
      <View style={styles.card}>
        <TouchableOpacity 
          style={styles.cardHeader}
          onPress={() => toggleDayCard('breakdown')}
          activeOpacity={0.7}
        >
          <View style={styles.cardTitleRow}>
            <Wrench size={24} color="#3b82f6" style={{ marginRight: 12 }} />
            <Text style={styles.cardTitle}>Breakdown Configuration</Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={24} color="#64748b" />
          ) : (
            <ChevronDown size={24} color="#64748b" />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Enabled</Text>
              <Switch
                value={config.breakdown.enabled}
                onValueChange={(value) => updateBreakdownConfig('enabled', value)}
                trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                thumbColor={config.breakdown.enabled ? '#ffffff' : '#f3f4f6'}
              />
              <Text style={styles.helperText}>
                When ENABLED: Breakdown days are billed at actual hours (end time - start time).{"\n"}When DISABLED: Breakdown days are billed at R0 (no charge).
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

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
        console.log('[Timesheets] Raw timesheet data for', doc.id, ':', {
          hasOriginalEntry: data.hasOriginalEntry,
          isAdjustment: data.isAdjustment,
          adjustedBy: data.adjustedBy,
          operatorName: data.operatorName,
          totalHours: data.totalHours,
          hasOriginalEntryData: !!data.originalEntryData,
        });
        const date = new Date(data.date);
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
        const rawNotes = typeof data.notes === 'string' ? data.notes : undefined;
        const operatorNotes = typeof data.operatorNotes === 'string' ? data.operatorNotes : undefined;
        const additionalNotes = typeof data.additionalNotes === 'string' ? data.additionalNotes : undefined;
        const adminNotes = typeof data.adminNotes === 'string' ? data.adminNotes : undefined;
        const billingNotes = typeof data.billingNotes === 'string' ? data.billingNotes : undefined;
        const comment = typeof data.comment === 'string' ? data.comment : undefined;
        const comments = typeof data.comments === 'string' ? data.comments : undefined;
        const extraNotes = typeof data.extraNotes === 'string' ? data.extraNotes : undefined;
        const noteSource: Partial<TimesheetEntry> = {
          notes: rawNotes,
          operatorNotes,
          additionalNotes,
          adminNotes,
          billingNotes,
          comment,
          comments,
          extraNotes,
          rawNotes,
        };
        const resolvedNotes = resolveDisplayNotes(noteSource);
        
        return {
          id: doc.id,
          date: data.date,
          dayOfWeek,
          openHours: toTimeString(data.openHours),
          closeHours: toTimeString(data.closeHours ?? data.closeHour ?? data.close_time ?? data.close ?? data.openHours),
          closingHours: toTimeString(data.closingHours ?? data.closeHours ?? data.closeHour ?? data.close_time ?? data.close ?? data.openHours),
          totalHours: Number(data.totalHours || 0),
          operatorName: data.operatorName || 'Unknown',
          isRainDay: Boolean(data.isRainDay || data.inclementWeather),
          isStrikeDay: Boolean(data.isStrikeDay),
          isBreakdown: Boolean(data.isBreakdown),
          isPublicHoliday: Boolean(data.isPublicHoliday),
          notes: resolvedNotes,
          operatorNotes,
          additionalNotes,
          adminNotes,
          billingNotes,
          comment,
          comments,
          extraNotes,
          rawNotes,
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
      console.log('[Timesheets] Before dedup:', entries.length, 'entries');
      entries.forEach((e, i) => {
        console.log(`[Timesheets] Entry ${i}:`, {
          id: e.id.substring(0, 8),
          operator: e.operatorName,
          hours: e.totalHours,
          hasOriginalEntry: e.hasOriginalEntry,
          isAdjustment: e.isAdjustment,
          adjustedBy: e.adjustedBy,
          hasOriginalData: !!e.originalEntryData,
        });
      });
      const normalizedEntries = deduplicateTimesheetEntries(entries);
      normalizedEntries.sort((a, b) => a.date.localeCompare(b.date));
      console.log('[Timesheets] After dedup:', normalizedEntries.length, 'entries');
      normalizedEntries.forEach((e, i) => {
        console.log(`[Timesheets] Deduped Entry ${i}:`, {
          id: e.id.substring(0, 8),
          operator: e.operatorName,
          hours: e.totalHours,
          hasOriginalEntry: e.hasOriginalEntry,
          isAdjustment: e.isAdjustment,
          adjustedBy: e.adjustedBy,
          hasOriginalData: !!e.originalEntryData,
          originalOperator: e.originalEntryData?.operatorName,
          originalHours: e.originalEntryData?.totalHours,
        });
      });
      const grouped = buildTimesheetGroups(normalizedEntries);
      console.log('[Timesheets] Built display groups:', grouped.length);
      grouped.forEach((g, i) => {
        console.log(`[Timesheets] Group ${i} (${g.date}):`, {
          rows: g.rows.length,
          hasAdjustments: g.hasAdjustments,
          rowTypes: g.rows.map(r => r.badgeLabel).join(', '),
        });
      });
      setTimesheets(normalizedEntries);
      setTimesheetGroups(grouped);
      setShowOriginalRows(true);
      console.log('[Timesheets] Removed', entries.length - normalizedEntries.length, 'duplicate entries');
    } catch (error) {
      console.error('Error loading timesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderManHoursView = () => (
    <View style={styles.timesheetsContainer}>
      <View style={styles.comingSoonContainer}>
        <Clock size={64} color="#94a3b8" />
        <Text style={styles.comingSoonTitle}>Man Hours Processing</Text>
        <Text style={styles.comingSoonText}>
          This section will handle operator man hours timesheets, allowing you to review and process operator work hours separately from plant asset hours.
        </Text>
        <View style={styles.comingSoonFeatureList}>
          <Text style={styles.comingSoonFeature}>• Review operator daily timesheets</Text>
          <Text style={styles.comingSoonFeature}>• Compare operator vs plant manager entries</Text>
          <Text style={styles.comingSoonFeature}>• Process billing for labor costs</Text>
          <Text style={styles.comingSoonFeature}>• Generate operator timesheet reports</Text>
        </View>
      </View>
    </View>
  );

  const renderMachineHoursConfig = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.infoCard}>
        <Wrench size={24} color="#3b82f6" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Billing Rules - Machine Hours</Text>
          <Text style={styles.infoText}>
            Configure minimum hours and billing rules for plant/machine hours. The billing method (Per Hour vs Minimum Billing) is set per asset during plant onboarding. Weekdays, weekends, and public holidays are automatically determined. Event-based conditions (rain days, breakdowns) are marked by operators in the timesheet.
          </Text>
        </View>
      </View>

      {renderDayTypeCardMachine('Weekdays (Monday - Friday)', 'weekdays', '📅', expandedDayCards.has('weekdays'), () => toggleDayCard('weekdays'))}
      {renderDayTypeCardMachine('Weekends (Saturday & Sunday)', 'saturday', '🏖️', expandedDayCards.has('saturday'), () => toggleDayCard('saturday'))}
      {renderRainDayConfig()}
      {renderBreakdownConfig()}
    </ScrollView>
  );

  const renderManHoursConfig = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.infoCard}>
        <Clock size={24} color="#3b82f6" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Billing Rules - Man Hours</Text>
          <Text style={styles.infoText}>
            Configure billing methods and rates for different day types for operator man hours. Weekdays,
            weekends, and public holidays are automatically determined. Event-based
            conditions (rain days, strike days, breakdowns) are marked by operators in
            the timesheet.
          </Text>
        </View>
      </View>

      <View style={styles.globalBillingMethodCard}>
        <Text style={styles.globalBillingMethodTitle}>Billing Method</Text>
        <Text style={styles.globalBillingMethodSubtitle}>Select billing method for all day types</Text>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[
              styles.methodButton,
              globalBillingMethod === 'PER_HOUR' && styles.methodButtonActive,
            ]}
            onPress={() => applyGlobalBillingMethod('PER_HOUR')}
          >
            <Clock
              size={18}
              color={
                globalBillingMethod === 'PER_HOUR' ? '#ffffff' : '#64748b'
              }
            />
            <Text
              style={[
                styles.methodButtonText,
                globalBillingMethod === 'PER_HOUR' &&
                  styles.methodButtonTextActive,
              ]}
            >
              Per Hour
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodButton,
              globalBillingMethod === 'MINIMUM_BILLING' &&
                styles.methodButtonActive,
            ]}
            onPress={() => applyGlobalBillingMethod('MINIMUM_BILLING')}
          >
            <Calendar
              size={18}
              color={
                globalBillingMethod === 'MINIMUM_BILLING'
                  ? '#ffffff'
                  : '#64748b'
              }
            />
            <Text
              style={[
                styles.methodButtonText,
                globalBillingMethod === 'MINIMUM_BILLING' &&
                  styles.methodButtonTextActive,
              ]}
            >
              Minimum Billing
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderDayTypeCard('Weekdays', 'weekdays', '📅', expandedDayCards.has('weekdays'), () => toggleDayCard('weekdays'))}
      {renderDayTypeCard('Saturday', 'saturday', '🏖️', expandedDayCards.has('saturday'), () => toggleDayCard('saturday'))}
      {renderDayTypeCard('Sunday', 'sunday', '☀️', expandedDayCards.has('sunday'), () => toggleDayCard('sunday'))}
      {renderDayTypeCard('Public Holidays', 'publicHolidays', '🎉', expandedDayCards.has('publicHolidays'), () => toggleDayCard('publicHolidays'))}
      {renderRainDayConfig()}
    </ScrollView>
  );

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
                    const visibleRows = group.rows;

                    if (visibleRows.length === 0) {
                      return null;
                    }

                    const groupDate = new Date(group.date);
                    // Calculate effective hours for this day using hierarchy:
                    // Admin edit > Plant Manager edit > Operator entry
                    const assetPendingEditsForGroup = selectedAssetForTimesheets
                      ? pendingEdits.get(selectedAssetForTimesheets.assetId) || []
                      : [];
                    const adminEditForDay = assetPendingEditsForGroup.find(
                      edit => edit.date === group.date && edit.editedBy === 'admin' && edit.status === 'pending_review'
                    );
                    
                    let groupHours = 0;
                    if (adminEditForDay) {
                      // Use admin's hours if admin edited this day
                      groupHours = adminEditForDay.totalHours;
                    } else {
                      // Look for PM entry (adjusted), if not found use operator entry
                      const pmRow = visibleRows.find(row => row.badgeLabel === 'PM');
                      const origRow = visibleRows.find(row => row.badgeLabel === 'ORIG');
                      
                      if (pmRow) {
                        groupHours = pmRow.totalHours;
                      } else if (origRow) {
                        groupHours = origRow.totalHours;
                      } else if (visibleRows.length > 0) {
                        // Fallback: use first visible row
                        groupHours = visibleRows[0].totalHours;
                      }
                    }
                    
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
                            <Text style={styles.groupHeaderInsight}>
                              {`${group.rows.filter(r => r.badgeLabel === 'ORIG').length} operator · ${group.rows.filter(r => r.badgeLabel === 'PM').length} plant manager entries`}
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

  const handleOpenAgreedHoursModal = async (assetId: string) => {
    console.log('[EPH] Opening agreed hours modal for asset:', assetId);
    const timesheets = ephTimesheets.get(assetId);
    
    if (!timesheets || timesheets.length === 0) {
      Alert.alert('No Timesheets', 'No timesheets found for this asset in the selected date range.');
      return;
    }

    const dedupedEntries = deduplicateTimesheetEntries(timesheets);
    
    if (dedupedEntries.length === 1) {
      const existingAgreed = await getAgreedTimesheetByOriginalId(dedupedEntries[0].id);
      if (existingAgreed) {
        Alert.alert(
          'Already Agreed',
          `This timesheet has already been agreed on ${new Date(existingAgreed.agreedAt.toDate()).toLocaleDateString('en-GB')}.\n\nAgreed Hours: ${existingAgreed.agreedHours}h\nOriginal Hours: ${existingAgreed.originalHours}h`,
          [
            { text: 'OK', style: 'default' },
          ]
        );
        return;
      }
      
      setSelectedTimesheetForAgreement(dedupedEntries[0]);
      setAgreedHoursModalVisible(true);
    } else {
      Alert.alert(
        'Multiple Timesheets',
        `This asset has ${dedupedEntries.length} timesheet entries in the selected date range. Please use the View Timesheets option to agree hours for individual dates.`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleAgreeHours = async (data: { agreedHours?: number; agreedNotes?: string }) => {
    if (!selectedTimesheetForAgreement || !user) {
      console.error('[EPH] Missing timesheet or user');
      return;
    }

    try {
      console.log('[EPH] Agreeing hours:', data);
      const agreedByIdentifier = user.userId || user.id || 'Unknown Admin';
      await agreePlantAssetTimesheet(
        selectedTimesheetForAgreement,
        {
          agreedHours: data.agreedHours,
          agreedNotes: data.agreedNotes,
        },
        agreedByIdentifier,
        'digital',
        'Admin'
      );

      Alert.alert('Success', 'Hours agreed successfully and ready for billing.');
      
      if (selectedSubcontractor) {
        await loadPlantAssets(selectedSubcontractor);
      }
    } catch (error) {
      console.error('[EPH] Error agreeing hours:', error);
      throw error;
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  const handleGenerateSelectedReport = () => {
    console.log('[Generate] Generate Selected clicked');
    if (selectedAssetIds.size === 0) {
      Alert.alert(
        'No Selection',
        'Please select at least one asset by tapping the checkbox next to it, then try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    setReportGenerationModalVisible(true);
  };

  const handleGenerateAllReport = () => {
    console.log('[Generate] Generate All clicked');
    setReportGenerationModalVisible(true);
  };

  const loadPendingEdits = useCallback(async () => {
    if (!user?.masterAccountId) return;
    
    console.log('[EPH] Loading pending edits for all assets');
    const editsMap = new Map<string, EPHPendingEdit[]>();
    
    for (const asset of plantAssets) {
      const edits = await getAllPendingEditsByAssetId(asset.assetId, user.masterAccountId);
      if (edits.length > 0) {
        editsMap.set(asset.assetId, edits);
      }
    }
    
    setPendingEdits(editsMap);
    console.log('[EPH] Loaded pending edits for', editsMap.size, 'assets');
  }, [plantAssets, user?.masterAccountId]);

  useEffect(() => {
    if (activeTab === 'eph' && plantAssets.length > 0) {
      loadPendingEdits();
    }
  }, [activeTab, plantAssets, loadPendingEdits]);

  const handleEditHours = async (assetId: string) => {
    console.log('[EPH] Edit hours clicked for asset:', assetId);
    const timesheets = ephTimesheets.get(assetId);
    
    if (!timesheets || timesheets.length === 0) {
      Alert.alert('No Timesheets', 'No timesheets found for this asset.');
      return;
    }
    
    if (timesheets.length > 1) {
      Alert.alert(
        'Multiple Timesheets',
        `This asset has ${timesheets.length} timesheet entries. Please use View Timesheets to edit individual dates.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    const asset = plantAssets.find(a => a.assetId === assetId);
    setSelectedTimesheetForEdit({
      ...timesheets[0],
      assetType: asset?.type,
      plantNumber: asset?.plantNumber || asset?.registrationNumber,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (editedValues: any) => {
    if (!selectedTimesheetForEdit || !user) {
      console.error('[EPH] Missing timesheet or user');
      return;
    }
    
    try {
      console.log('[EPH] Saving edit:', editedValues);
      const asset = plantAssets.find(a => a.assetId === selectedTimesheetForEdit.assetId);
      const subcontractor = subcontractors.find(s => s.id === selectedSubcontractor);
      
      await createPendingEdit({
        originalTimesheetId: selectedTimesheetForEdit.id,
        assetId: selectedTimesheetForEdit.assetId,
        assetType: asset?.type || 'Unknown',
        plantNumber: asset?.plantNumber || asset?.registrationNumber,
        date: selectedTimesheetForEdit.date,
        editedBy: 'admin',
        editedByUserId: user.userId || user.id || 'unknown',
        editedByName: user.name || 'Admin',
        totalHours: editedValues.totalHours,
        openHours: editedValues.openHours,
        closeHours: editedValues.closeHours,
        isBreakdown: editedValues.isBreakdown,
        isRainDay: editedValues.isRainDay,
        isStrikeDay: editedValues.isStrikeDay,
        isPublicHoliday: editedValues.isPublicHoliday,
        notes: editedValues.adminNotes,
        originalTotalHours: selectedTimesheetForEdit.totalHours || 0,
        originalOpenHours: selectedTimesheetForEdit.openHours || '00:00',
        originalCloseHours: selectedTimesheetForEdit.closeHours || '00:00',
        masterAccountId: user.masterAccountId || '',
        siteId: user.siteId || '',
        subcontractorId: selectedSubcontractor || '',
        subcontractorName: subcontractor?.name || 'Unknown',
      });
      
      Alert.alert('Success', 'Hours edited successfully. Changes are pending subcontractor review.');
      await loadPendingEdits();
    } catch (error) {
      console.error('[EPH] Error saving edit:', error);
      throw error;
    }
  };

  const handleCompareVersions = async (assetId: string) => {
    console.log('[EPH] Compare versions clicked for asset:', assetId);
    const timesheets = ephTimesheets.get(assetId);
    const edits = pendingEdits.get(assetId);
    
    if (!timesheets || timesheets.length === 0) {
      Alert.alert('No Timesheets', 'No timesheets found for this asset.');
      return;
    }
    
    if (!edits || edits.length === 0) {
      Alert.alert('No Edits', 'No pending edits found for this asset.');
      return;
    }
    
    const plantManagerVersion = timesheets[0];
    const adminEdit = edits.find(e => e.editedBy === 'admin');
    const subcontractorEdit = edits.find(e => e.editedBy === 'subcontractor');
    
    const asset = plantAssets.find(a => a.assetId === assetId);
    
    setSelectedComparison({
      plantManager: {
        ...plantManagerVersion,
        assetType: asset?.type,
        plantNumber: asset?.plantNumber || asset?.registrationNumber,
      },
      adminEdited: adminEdit ? {
        id: adminEdit.id,
        date: adminEdit.date,
        operatorName: plantManagerVersion.operatorName,
        assetType: adminEdit.assetType,
        plantNumber: adminEdit.plantNumber,
        totalHours: adminEdit.totalHours,
        openHours: adminEdit.openHours,
        closeHours: adminEdit.closeHours,
        isBreakdown: adminEdit.isBreakdown,
        isRainDay: adminEdit.isRainDay,
        isStrikeDay: adminEdit.isStrikeDay,
        isPublicHoliday: adminEdit.isPublicHoliday,
        notes: adminEdit.notes,
      } : undefined,
      subcontractorEdited: subcontractorEdit ? {
        id: subcontractorEdit.id,
        date: subcontractorEdit.date,
        operatorName: plantManagerVersion.operatorName,
        assetType: subcontractorEdit.assetType,
        plantNumber: subcontractorEdit.plantNumber,
        totalHours: subcontractorEdit.totalHours,
        openHours: subcontractorEdit.openHours,
        closeHours: subcontractorEdit.closeHours,
        isBreakdown: subcontractorEdit.isBreakdown,
        isRainDay: subcontractorEdit.isRainDay,
        isStrikeDay: subcontractorEdit.isStrikeDay,
        isPublicHoliday: subcontractorEdit.isPublicHoliday,
        notes: subcontractorEdit.notes,
      } : undefined,
    });
    
    setComparisonModalVisible(true);
  };

  const handleDirectApproveEPH = async () => {
    if (!selectedSubcontractor || !user) {
      Alert.alert('Error', 'Missing subcontractor or user information');
      return;
    }
    
    console.log('[EPH] Direct approving EPH for selected assets');
    
    try {
      const selectedAssets = Array.from(selectedAssetIds).map(id => 
        ephData.find(record => record.assetId === id)
      ).filter(Boolean) as typeof ephData;
      
      if (selectedAssets.length === 0) {
        Alert.alert('Error', 'No assets selected');
        return;
      }
      
      const allTimesheets: any[] = [];
      for (const asset of selectedAssets) {
        const timesheets = ephTimesheets.get(asset.assetId) || [];
        const dedupedTimesheets = deduplicateTimesheetEntries(timesheets);
        allTimesheets.push(...dedupedTimesheets);
      }
      
      const agreedByIdentifier = user.userId || user.id || 'Admin';
      await directApproveEPHTimesheets(
        allTimesheets,
        agreedByIdentifier,
        `Direct approval by admin - ${new Date().toLocaleDateString('en-GB')}`
      );
      
      Alert.alert(
        'Success', 
        `${selectedAssets.length} asset(s) approved and finalized. You can now generate PDF reports manually.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (selectedSubcontractor) {
                loadPlantAssets(selectedSubcontractor);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('[EPH] Error direct approving:', error);
      throw error;
    }
  };

  const handleSendToSubcontractor = async (recipientEmail: string, message: string) => {
    if (!selectedSubcontractor || !user) {
      Alert.alert('Error', 'Missing subcontractor or user information');
      return;
    }
    
    console.log('[EPH] Sending to subcontractor:', recipientEmail);
    
    try {
      const selectedAssets = Array.from(selectedAssetIds).map(id => 
        ephData.find(record => record.assetId === id)
      ).filter(Boolean) as typeof ephData;
      
      const totalHours = selectedAssets.reduce((sum, asset) => sum + asset.totalBillableHours, 0);
      const subcontractor = subcontractors.find(s => s.id === selectedSubcontractor);
      
      const groups = selectedAssets.map(record => {
        const timesheets = ephTimesheets.get(record.assetId) || [];
        const dedupedTimesheets = deduplicateTimesheetEntries(timesheets);
        const billingResultsByDate = record.billingResultsByDate || new Map<string, BillableHoursResult>();
        
        return {
          key: record.assetId,
          title: record.assetType,
          subtitle: record.plantNumber || record.registrationNumber || record.assetId,
          entries: dedupedTimesheets.map(ts => {
            // Get the billing result for this date to populate actualHours and billableHours
            const billingResult = billingResultsByDate.get(ts.date);
            
            return {
              id: ts.id,
              date: ts.date,
              operatorName: ts.operatorName,
              operatorId: ts.operatorName || '',
              verified: true,
              verifiedAt: ts.verifiedAt || new Date().toISOString(),
              verifiedBy: ts.adjustedBy || 'system',
              masterAccountId: user?.masterAccountId || '',
              siteId: user?.siteId || '',
              type: 'plant_hours' as const,
              openHours: parseFloat(ts.openHours) || 0,
              closeHours: parseFloat(ts.closeHours) || 0,
              totalHours: ts.totalHours || 0,
              // Use pre-calculated hours from billing logic - DO NOT recalculate in PDF
              actualHours: billingResult?.actualHours ?? ts.totalHours ?? 0,
              billableHours: billingResult?.billableHours ?? ts.totalHours ?? 0,
              assetRate: record.rate,
              totalCost: (billingResult?.billableHours ?? ts.totalHours ?? 0) * record.rate,
              billingRule: billingResult?.appliedRule,
              isBreakdown: ts.isBreakdown,
              inclementWeather: ts.isRainDay,
              isRainDay: ts.isRainDay,
              isStrikeDay: ts.isStrikeDay,
              isPublicHoliday: ts.isPublicHoliday,
              hasAttachment: false,
              assetId: record.assetId,
              assetType: record.assetType,
              plantNumber: record.plantNumber,
              registrationNumber: record.registrationNumber,
              ownerId: selectedSubcontractor,
              ownerType: 'subcontractor' as const,
              ownerName: subcontractor?.name,
              hasOriginalEntry: ts.hasOriginalEntry,
              originalEntryData: ts.originalEntryData,
              isAdjustment: ts.isAdjustment,
              originalEntryId: ts.originalEntryId,
              adjustedBy: ts.adjustedBy,
              adjustedAt: ts.adjustedAt,
              notes: ts.notes || ts.adminNotes || ts.billingNotes,
            };
          }),
          dateGroups: dedupedTimesheets.map(ts => {
            // Get billing result for this date
            const billingResult = billingResultsByDate.get(ts.date);
            // Also get billing result for original entry if it exists
            const originalBillingResult = ts.originalEntryData?.date 
              ? billingResultsByDate.get(ts.originalEntryData.date)
              : undefined;
            
            const adjustmentEntry = (ts.hasOriginalEntry || ts.isAdjustment) ? {
              ...ts,
              id: ts.id,
              date: ts.date,
              operatorName: ts.operatorName,
              openHours: parseFloat(String(ts.openHours || 0)),
              closeHours: parseFloat(String(ts.closeHours || ts.closingHours || 0)),
              totalHours: ts.totalHours || 0,
              // Use pre-calculated billing hours
              actualHours: billingResult?.actualHours ?? ts.totalHours ?? 0,
              billableHours: billingResult?.billableHours ?? ts.totalHours ?? 0,
              assetRate: record.rate,
              totalCost: (billingResult?.billableHours ?? ts.totalHours ?? 0) * record.rate,
              billingRule: billingResult?.appliedRule,
              isBreakdown: ts.isBreakdown,
              inclementWeather: ts.isRainDay,
              isRainDay: ts.isRainDay,
              isStrikeDay: ts.isStrikeDay,
              isPublicHoliday: ts.isPublicHoliday,
              notes: ts.notes || ts.adminNotes || ts.billingNotes,
              adjustedBy: ts.adjustedBy,
              adjustedAt: ts.adjustedAt,
            } as any : undefined;
            
            const originalEntry = ts.originalEntryData ? {
              ...ts.originalEntryData,
              id: ts.originalEntryId || ts.id,
              date: ts.date,
              operatorName: ts.originalEntryData.operatorName || ts.operatorName,
              openHours: parseFloat(String(ts.originalEntryData.openHours || 0)),
              closeHours: parseFloat(String(ts.originalEntryData.closeHours || ts.originalEntryData.closingHours || 0)),
              totalHours: ts.originalEntryData.totalHours || 0,
              // For original entry, use totalHours as actualHours
              actualHours: ts.originalEntryData.totalHours || 0,
              billableHours: originalBillingResult?.billableHours ?? ts.originalEntryData.totalHours ?? 0,
              assetRate: record.rate,
              totalCost: (originalBillingResult?.billableHours ?? ts.originalEntryData.totalHours ?? 0) * record.rate,
              billingRule: originalBillingResult?.appliedRule,
              isBreakdown: ts.originalEntryData.isBreakdown,
              inclementWeather: ts.originalEntryData.isRainDay,
              isRainDay: ts.originalEntryData.isRainDay,
              isStrikeDay: ts.originalEntryData.isStrikeDay,
              isPublicHoliday: ts.originalEntryData.isPublicHoliday,
              notes: ts.originalEntryData.notes,
            } as any : undefined;
            
            return {
              date: ts.date,
              adjustmentEntry,
              originalEntry,
              agreedEntry: undefined,
            };
          }),
        };
      });
      
      const { uri, fileName } = await generateTimesheetPDF({
        groups,
        reportType: 'plant',
        subcontractorName: subcontractor?.name,
        dateRange: {
          from: startDate,
          to: endDate,
        },
        selectedOnly: true,
        selectedGroups: new Set(selectedAssets.map(r => r.assetId)),
      });
      
      await sendEPHToSubcontractor({
        recipientEmail,
        message,
        pdfUri: uri,
        pdfFileName: fileName,
        subcontractorName: subcontractor?.name || 'Unknown',
        dateRange: { from: startDate, to: endDate },
        assetCount: selectedAssets.length,
        totalHours,
        companyName: user.companyName || 'Your Company',
      });
      
      Alert.alert('Success', 'EPH report sent to subcontractor');
    } catch (error) {
      console.error('[EPH] Error sending to subcontractor:', error);
      throw error;
    }
  };

  const renderEPHRecord = ({ item }: { item: EPHRecord }) => {
    const isExpanded = expandedCards.has(item.assetId);
    const isSelected = selectedAssetIds.has(item.assetId);
    const hasPendingEdits = pendingEdits.has(item.assetId);

    return (
      <View style={styles.ephCard}>
        <TouchableOpacity 
          style={styles.ephCardHeader}
          onPress={() => toggleCardExpansion(item.assetId)}
          activeOpacity={0.7}
        >
          <TouchableOpacity
            onPress={() => toggleAssetSelection(item.assetId)}
            style={styles.checkboxContainer}
          >
            {isSelected ? (
              <CheckSquare size={24} color="#1e3a8a" />
            ) : (
              <Square size={24} color="#94a3b8" />
            )}
          </TouchableOpacity>
          <View style={styles.ephHeaderLeft}>
            <View style={styles.ephHeaderTitleRow}>
              <Text style={styles.ephAssetType}>{item.assetType}</Text>
              {hasPendingEdits && (
                <View style={styles.pendingEditBadge}>
                  <Text style={styles.pendingEditBadgeText}>Edits Pending</Text>
                </View>
              )}
            </View>
            <Text style={styles.ephAssetNumber}>
              {item.plantNumber || item.registrationNumber || item.assetId}
            </Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={24} color="#64748b" />
          ) : (
            <ChevronDown size={24} color="#64748b" />
          )}
        </TouchableOpacity>

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
            <Text style={styles.ephInfoLabel}>Actual Clock Hours:</Text>
            <Text style={styles.ephInfoValue}>{item.totalActualHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.ephInfoRow}>
            <Text style={styles.ephTotalLabel}>Billable Hours (per config):</Text>
            <Text style={styles.ephTotalValue}>{item.totalBillableHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.ephInfoRow}>
            <Text style={styles.ephTotalLabel}>Total Cost:</Text>
            <Text style={styles.ephCostValue}>R{item.estimatedCost.toFixed(2)}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.ephExpandedContent}>
            <View style={styles.ephDivider} />
            <Text style={styles.ephBreakdownTitle}>Hours Breakdown (Actual → Billable)</Text>
            <View style={styles.ephGrid}>
              <View style={styles.ephGridHeader}>
                <Text style={styles.ephGridHeaderLabel}>Day Type</Text>
                <Text style={styles.ephGridHeaderValue}>Actual</Text>
                <Text style={styles.ephGridHeaderValue}>Billable</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Weekdays:</Text>
                <Text style={styles.ephValueActual}>{item.actualNormalHours.toFixed(1)}h</Text>
                <Text style={styles.ephValueBillable}>{item.billableNormalHours.toFixed(1)}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Saturday:</Text>
                <Text style={styles.ephValueActual}>{item.actualSaturdayHours.toFixed(1)}h</Text>
                <Text style={styles.ephValueBillable}>{item.billableSaturdayHours.toFixed(1)}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Sunday:</Text>
                <Text style={styles.ephValueActual}>{item.actualSundayHours.toFixed(1)}h</Text>
                <Text style={styles.ephValueBillable}>{item.billableSundayHours.toFixed(1)}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Public Holidays:</Text>
                <Text style={styles.ephValueActual}>{item.actualPublicHolidayHours.toFixed(1)}h</Text>
                <Text style={styles.ephValueBillable}>{item.billablePublicHolidayHours.toFixed(1)}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Breakdown:</Text>
                <Text style={styles.ephValueActual}>{item.actualBreakdownHours.toFixed(1)}h</Text>
                <Text style={styles.ephValueBillable}>{item.billableBreakdownHours.toFixed(1)}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Rain Days:</Text>
                <Text style={styles.ephValueActual}>{item.actualRainDayHours.toFixed(1)}h</Text>
                <Text style={styles.ephValueBillable}>{item.billableRainDayHours.toFixed(1)}h</Text>
              </View>
              <View style={styles.ephRow}>
                <Text style={styles.ephLabel}>Strike Days:</Text>
                <Text style={styles.ephValueActual}>{item.actualStrikeDayHours.toFixed(1)}h</Text>
                <Text style={styles.ephValueBillable}>{item.billableStrikeDayHours.toFixed(1)}h</Text>
              </View>
              <View style={[styles.ephRow, styles.ephTotalRow]}>
                <Text style={[styles.ephLabel, styles.ephTotalLabelBold]}>TOTALS:</Text>
                <Text style={styles.ephValueActualTotal}>{item.totalActualHours.toFixed(1)}h</Text>
                <Text style={styles.ephValueBillableTotal}>{item.totalBillableHours.toFixed(1)}h</Text>
              </View>
            </View>
            
            <View style={styles.ephActions}>
              <TouchableOpacity
                style={styles.viewTimesheetsButton}
                onPress={() => handleViewTimesheets(item.assetId)}
              >
                <ClipboardList size={18} color="#1e3a8a" />
                <Text style={styles.viewTimesheetsButtonText}>View Timesheets</Text>
              </TouchableOpacity>

              <View style={styles.ephActionRow}>
                <TouchableOpacity
                  style={styles.editHoursButton}
                  onPress={() => handleEditHours(item.assetId)}
                >
                  <Edit3 size={16} color="#3b82f6" />
                  <Text style={styles.editHoursButtonText}>Edit Hours</Text>
                </TouchableOpacity>

                {hasPendingEdits && (
                  <TouchableOpacity
                    style={styles.compareButton}
                    onPress={() => handleCompareVersions(item.assetId)}
                  >
                    <GitCompare size={16} color="#10b981" />
                    <Text style={styles.compareButtonText}>Compare</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <TouchableOpacity
                style={styles.agreeHoursButton}
                onPress={() => handleOpenAgreedHoursModal(item.assetId)}
              >
                <Edit3 size={18} color="#ffffff" />
                <Text style={styles.agreeHoursButtonText}>Agree Hours</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
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
            Process Payments
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'config' ? (
        <View style={styles.configMainContainer}>
          <View style={styles.configSubTabBar}>
            <TouchableOpacity
              style={[styles.configSubTab, configSubTab === 'machine' && styles.configSubTabActive]}
              onPress={() => setConfigSubTab('machine')}
            >
              <Wrench size={18} color={configSubTab === 'machine' ? '#1e3a8a' : '#64748b'} />
              <Text style={[styles.configSubTabText, configSubTab === 'machine' && styles.configSubTabTextActive]}>
                Machine Hours
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.configSubTab, configSubTab === 'man' && styles.configSubTabActive]}
              onPress={() => setConfigSubTab('man')}
            >
              <Clock size={18} color={configSubTab === 'man' ? '#1e3a8a' : '#64748b'} />
              <Text style={[styles.configSubTabText, configSubTab === 'man' && styles.configSubTabTextActive]}>
                Man Hours
              </Text>
            </TouchableOpacity>
          </View>
          {configSubTab === 'machine' ? renderMachineHoursConfig() : renderManHoursConfig()}
        </View>
      ) : activeTab === 'timesheets' ? (
        <View style={styles.timesheetsMainContainer}>
          <View style={styles.timesheetsSubTabBar}>
            <TouchableOpacity
              style={[styles.timesheetsSubTab, timesheetsSubTab === 'machine' && styles.timesheetsSubTabActive]}
              onPress={() => setTimesheetsSubTab('machine')}
            >
              <Wrench size={18} color={timesheetsSubTab === 'machine' ? '#1e3a8a' : '#64748b'} />
              <Text style={[styles.timesheetsSubTabText, timesheetsSubTab === 'machine' && styles.timesheetsSubTabTextActive]}>
                Machine Hours
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.timesheetsSubTab, timesheetsSubTab === 'man' && styles.timesheetsSubTabActive]}
              onPress={() => setTimesheetsSubTab('man')}
            >
              <Clock size={18} color={timesheetsSubTab === 'man' ? '#1e3a8a' : '#64748b'} />
              <Text style={[styles.timesheetsSubTabText, timesheetsSubTab === 'man' && styles.timesheetsSubTabTextActive]}>
                Man Hours
              </Text>
            </TouchableOpacity>
          </View>
          {timesheetsSubTab === 'machine' ? renderTimesheetsView() : renderManHoursView()}
        </View>
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
              <View style={styles.generateButtonsContainer}>
                <TouchableOpacity
                  style={[styles.generateButton, styles.generateButtonPrimary]}
                  onPress={handleGenerateAllReport}
                >
                  <FileText size={18} color="#ffffff" />
                  <Text style={styles.generateButtonText}>Generate All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.generateButton,
                    styles.generateButtonSecondary,
                    selectedAssetIds.size === 0 && styles.generateButtonDisabled,
                  ]}
                  onPress={handleGenerateSelectedReport}
                  disabled={selectedAssetIds.size === 0}
                >
                  <CheckSquare size={18} color={selectedAssetIds.size === 0 ? "#94a3b8" : "#1e3a8a"} />
                  <Text style={[
                    styles.generateButtonTextSecondary,
                    selectedAssetIds.size === 0 && styles.generateButtonTextDisabled,
                  ]}>
                    Generate Selected ({selectedAssetIds.size})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.generateButton,
                    styles.sendToSubButton,
                    selectedAssetIds.size === 0 && styles.generateButtonDisabled,
                  ]}
                  onPress={() => {
                    if (selectedAssetIds.size === 0) {
                      Alert.alert('No Selection', 'Please select at least one asset');
                      return;
                    }
                    const subcontractor = subcontractors.find(s => s.id === selectedSubcontractor);
                    if (!subcontractor) {
                      Alert.alert('Error', 'Subcontractor not found');
                      return;
                    }
                    setSendModalVisible(true);
                  }}
                  disabled={selectedAssetIds.size === 0}
                >
                  <Send size={18} color={selectedAssetIds.size === 0 ? "#94a3b8" : "#10b981"} />
                  <Text style={[
                    styles.sendToSubButtonText,
                    selectedAssetIds.size === 0 && styles.generateButtonTextDisabled,
                  ]}>
                    Send to Subcontractor
                  </Text>
                </TouchableOpacity>
              </View>
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

      <AgreedHoursModal
        visible={agreedHoursModalVisible}
        onClose={() => {
          setAgreedHoursModalVisible(false);
          setSelectedTimesheetForAgreement(null);
        }}
        onSubmit={handleAgreeHours}
        timesheet={selectedTimesheetForAgreement}
        viewMode="plant"
      />

      <ReportGenerationModal
        visible={reportGenerationModalVisible}
        onClose={() => setReportGenerationModalVisible(false)}
        onGenerate={handleGeneratePDFReport}
        hasSelection={selectedAssetIds.size > 0}
        selectedCount={selectedAssetIds.size}
        totalCount={ephData.length}
      />

      <EditEPHHoursModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedTimesheetForEdit(null);
        }}
        onSave={handleSaveEdit}
        timesheet={selectedTimesheetForEdit}
      />

      <TimesheetComparisonModal
        visible={comparisonModalVisible}
        onClose={() => {
          setComparisonModalVisible(false);
          setSelectedComparison(null);
        }}
        comparison={selectedComparison}
      />

      <SendConfirmationModal
        visible={sendModalVisible}
        onClose={() => setSendModalVisible(false)}
        onSend={handleSendToSubcontractor}
        onDirectApprove={handleDirectApproveEPH}
        subcontractorName={subcontractors.find(s => s.id === selectedSubcontractor)?.name || 'Unknown'}
        assetCount={selectedAssetIds.size}
        dateRange={{ from: startDate, to: endDate }}
      />
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
  ephGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  ephGridHeaderLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#64748b',
    textTransform: 'uppercase' as const,
  },
  ephGridHeaderValue: {
    width: 70,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    textAlign: 'right' as const,
  },
  ephValueActual: {
    width: 70,
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
    textAlign: 'right' as const,
  },
  ephValueBillable: {
    width: 70,
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#10b981',
    textAlign: 'right' as const,
  },
  ephTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  ephTotalLabelBold: {
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  ephValueActualTotal: {
    width: 70,
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#475569',
    textAlign: 'right' as const,
  },
  ephValueBillableTotal: {
    width: 70,
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#10b981',
    textAlign: 'right' as const,
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
  groupHeaderInsight: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
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
  ephActions: {
    gap: 8,
    marginTop: 12,
  },
  agreeHoursButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#10b981',
    borderRadius: 8,
  },
  agreeHoursButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
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
  ephCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  checkboxContainer: {
    paddingRight: 8,
  },
  generateButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  generateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  generateButtonPrimary: {
    backgroundColor: '#1e3a8a',
  },
  generateButtonSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  generateButtonDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  generateButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e3a8a',
  },
  generateButtonTextDisabled: {
    color: '#94a3b8',
  },
  sendToSubButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  sendToSubButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#10b981',
  },
  ephHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingEditBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  pendingEditBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#92400e',
    textTransform: 'uppercase' as const,
  },
  ephActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editHoursButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  editHoursButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  compareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  compareButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#10b981',
  },
  timesheetsMainContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  timesheetsSubTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
  },
  timesheetsSubTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  timesheetsSubTabActive: {
    borderBottomColor: '#1e3a8a',
  },
  timesheetsSubTabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  timesheetsSubTabTextActive: {
    color: '#1e3a8a',
  },
  comingSoonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  comingSoonFeatureList: {
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  comingSoonFeature: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  configMainContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  configSubTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
  },
  configSubTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  configSubTabActive: {
    borderBottomColor: '#1e3a8a',
  },
  configSubTabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  configSubTabTextActive: {
    color: '#1e3a8a',
  },
  globalBillingMethodCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  globalBillingMethodTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  globalBillingMethodSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
});
