import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FileSpreadsheet, ChevronDown, ChevronUp, Calendar, CheckCircle2, Wrench, AlertTriangle, CloudRain, Trash2, Home, Settings, QrCode } from 'lucide-react-native';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { HeaderTitleWithSync, StandardHeaderRight } from '@/components/HeaderSyncStatus';
import { useTheme } from '@/utils/hooks/useTheme';
import { PlantAsset, Subcontractor } from '@/types';

type TabType = 'plant' | 'man';

type TimesheetEntry = {
  id: string;
  date: string;
  openHours: number;
  closeHours: number;
  totalHours: number;
  operatorName: string;
  isBreakdown: boolean;
  isRainDay: boolean;
  isStrikeDay: boolean;
  hasAttachment: boolean;
  inclementWeather: boolean;
  verified?: boolean;
  hasAdjustment?: boolean;
  adjustmentId?: string;
  isAdjustment?: boolean;
  plantAssetDocId?: string;
};

type ManHoursEntry = {
  id: string;
  date: string;
  operatorName: string;
  startTime: string;
  stopTime: string;
  totalManHours: number;
  normalHours: number;
  overtimeHours: number;
  sundayHours: number;
  publicHolidayHours: number;
  noLunchBreak: boolean;
  verified?: boolean;
  hasAdjustment?: boolean;
  adjustmentId?: string;
  isAdjustment?: boolean;
  operatorId: string;
};

type PlantTimesheetGroup = {
  asset: PlantAsset;
  timesheets: TimesheetEntry[];
  weekStart: string;
  weekEnd: string;
};

type ManHoursGroup = {
  operatorName: string;
  operatorId: string;
  timesheets: ManHoursEntry[];
  weekStart: string;
  weekEnd: string;
};

export default function PlantManagerTimesheetsScreen() {
  const { user } = useAuth();
  const { theme, commonStyles } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('plant');
  const [loading, setLoading] = useState(false);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<string | null>(null);
  const [plantTypes, setPlantTypes] = useState<string[]>([]);
  const [selectedPlantType, setSelectedPlantType] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  const [plantTimesheetGroups, setPlantTimesheetGroups] = useState<PlantTimesheetGroup[]>([]);
  const [manHoursGroups, setManHoursGroups] = useState<ManHoursGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPlantEntries, setEditedPlantEntries] = useState<Map<string, Partial<TimesheetEntry>>>(new Map());
  const [editedManEntries, setEditedManEntries] = useState<Map<string, Partial<ManHoursEntry>>>(new Map());

  useEffect(() => {
    loadSubcontractors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'plant') {
      loadPlantTimesheets();
    } else {
      loadManHoursTimesheets();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedSubcontractor, selectedPlantType, startDate, endDate]);

  const loadSubcontractors = async () => {
    try {
      const q = query(
        collection(db, 'subcontractors'),
        where('masterAccountId', '==', user?.masterAccountId),
        where('siteId', '==', user?.siteId),
        where('status', '==', 'Active'),
        orderBy('name')
      );
      const snapshot = await getDocs(q);
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subcontractor));
      setSubcontractors(subs);
    } catch (error) {
      console.error('Error loading subcontractors:', error);
    }
  };

  const loadPlantTimesheets = async () => {
    setLoading(true);
    try {
      let assetsQuery = query(
        collection(db, 'plantAssets'),
        where('masterAccountId', '==', user?.masterAccountId),
        where('siteId', '==', user?.siteId)
      );

      if (selectedSubcontractor) {
        assetsQuery = query(
          collection(db, 'plantAssets'),
          where('masterAccountId', '==', user?.masterAccountId),
          where('siteId', '==', user?.siteId),
          where('ownerId', '==', selectedSubcontractor),
          where('ownerType', '==', 'subcontractor')
        );
      }

      const assetsSnapshot = await getDocs(assetsQuery);
      const assets = assetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlantAsset));

      const types = [...new Set(assets.map(a => a.type))];
      setPlantTypes(types);

      let filteredAssets = assets;
      if (selectedPlantType) {
        filteredAssets = assets.filter(a => a.type === selectedPlantType);
      }

      const groups: PlantTimesheetGroup[] = [];

      for (const asset of filteredAssets) {
        if (!asset.id) continue;

        const timesheetsQuery = query(
          collection(db, 'plantAssets', asset.id, 'timesheets'),
          where('date', '>=', startDate.toISOString().split('T')[0]),
          where('date', '<=', endDate.toISOString().split('T')[0]),
          orderBy('date', 'asc')
        );

        const timesheetsSnapshot = await getDocs(timesheetsQuery);
        const allTimesheets = timesheetsSnapshot.docs
          .map(doc => ({ id: doc.id, plantAssetDocId: asset.id, ...doc.data() } as TimesheetEntry));

        const originalTimesheets = allTimesheets.filter(t => !t.isAdjustment);

        if (originalTimesheets.length > 0) {
          const timesheetsWithAdjustments: TimesheetEntry[] = [];
          
          for (const original of originalTimesheets) {
            timesheetsWithAdjustments.push(original);
            
            if (original.hasAdjustment && original.adjustmentId) {
              const adjustment = allTimesheets.find(t => t.id === original.adjustmentId);
              if (adjustment) {
                timesheetsWithAdjustments.push(adjustment);
              }
            }
          }

          const weekStart = originalTimesheets[0].date;
          const weekEnd = originalTimesheets[originalTimesheets.length - 1].date;

          groups.push({
            asset,
            timesheets: timesheetsWithAdjustments,
            weekStart,
            weekEnd,
          });
        }
      }

      setPlantTimesheetGroups(groups);
    } catch (error) {
      console.error('Error loading plant timesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadManHoursTimesheets = async () => {
    setLoading(true);
    try {
      let timesheetsQuery = query(
        collection(db, 'operatorTimesheets'),
        where('masterAccountId', '==', user?.masterAccountId),
        where('siteId', '==', user?.siteId),
        where('date', '>=', startDate.toISOString().split('T')[0]),
        where('date', '<=', endDate.toISOString().split('T')[0]),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(timesheetsQuery);
      const allTimesheets = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ManHoursEntry));

      const originalTimesheets = allTimesheets.filter(t => !t.isAdjustment);

      const groupedByOperator = originalTimesheets.reduce((acc, timesheet) => {
        const key = timesheet.operatorId || timesheet.operatorName;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(timesheet);
        return acc;
      }, {} as Record<string, ManHoursEntry[]>);

      const groups: ManHoursGroup[] = Object.entries(groupedByOperator).map(([key, timesheets]) => {
        const timesheetsWithAdjustments: ManHoursEntry[] = [];
        
        for (const original of timesheets) {
          timesheetsWithAdjustments.push(original);
          
          if (original.hasAdjustment && original.adjustmentId) {
            const adjustment = allTimesheets.find(t => t.id === original.adjustmentId);
            if (adjustment) {
              timesheetsWithAdjustments.push(adjustment);
            }
          }
        }

        const weekStart = timesheets[0].date;
        const weekEnd = timesheets[timesheets.length - 1].date;

        return {
          operatorId: timesheets[0].operatorId || key,
          operatorName: timesheets[0].operatorName,
          timesheets: timesheetsWithAdjustments,
          weekStart,
          weekEnd,
        };
      });

      setManHoursGroups(groups);
    } catch (error) {
      console.error('Error loading man hours timesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpansion = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const createAdjustmentForEntry = async (originalEntry: TimesheetEntry | ManHoursEntry, isPlant: boolean) => {
    console.log('[createAdjustment] Creating adjustment for:', originalEntry.id);
    
    if (isPlant) {
      const plantEntry = originalEntry as TimesheetEntry;
      if (!plantEntry.plantAssetDocId) return;
      
      const adjustmentData = {
        ...plantEntry,
        isAdjustment: true,
        originalEntryId: plantEntry.id,
        adjustedBy: user?.name || user?.userId,
        adjustedAt: new Date().toISOString(),
        verified: false,
      };
      delete (adjustmentData as any).id;
      delete (adjustmentData as any).plantAssetDocId;
      
      const adjustmentRef = await addDoc(
        collection(db, 'plantAssets', plantEntry.plantAssetDocId, 'timesheets'),
        adjustmentData
      );
      
      await updateDoc(
        doc(db, 'plantAssets', plantEntry.plantAssetDocId, 'timesheets', plantEntry.id),
        {
          hasAdjustment: true,
          adjustmentId: adjustmentRef.id,
        }
      );
      
      console.log('[createAdjustment] ✅ Created adjustment:', adjustmentRef.id);
    } else {
      const manEntry = originalEntry as ManHoursEntry;
      
      const adjustmentData = {
        ...manEntry,
        isAdjustment: true,
        originalEntryId: manEntry.id,
        adjustedBy: user?.name || user?.userId,
        adjustedAt: new Date().toISOString(),
        verified: false,
      };
      delete (adjustmentData as any).id;
      
      const adjustmentRef = await addDoc(
        collection(db, 'operatorTimesheets'),
        adjustmentData
      );
      
      await updateDoc(
        doc(db, 'operatorTimesheets', manEntry.id),
        {
          hasAdjustment: true,
          adjustmentId: adjustmentRef.id,
        }
      );
      
      console.log('[createAdjustment] ✅ Created adjustment:', adjustmentRef.id);
    }
  };

  const handleEnterEditMode = async () => {
    console.log('[handleEnterEditMode] Creating adjustment entries...');
    setIsEditMode(true);
    
    try {
      if (activeTab === 'plant') {
        for (const group of plantTimesheetGroups) {
          for (const entry of group.timesheets) {
            if (!entry.isAdjustment && !entry.hasAdjustment) {
              await createAdjustmentForEntry(entry, true);
            }
          }
        }
        await loadPlantTimesheets();
      } else {
        for (const group of manHoursGroups) {
          for (const entry of group.timesheets) {
            if (!entry.isAdjustment && !entry.hasAdjustment) {
              await createAdjustmentForEntry(entry, false);
            }
          }
        }
        await loadManHoursTimesheets();
      }
      console.log('[handleEnterEditMode] ✅ All adjustment entries created');
    } catch (error) {
      console.error('[handleEnterEditMode] ❌ Error creating adjustments:', error);
      Alert.alert('Error', 'Failed to enter edit mode');
      setIsEditMode(false);
    }
  };

  const handleSave = async () => {
    const hasEdits = activeTab === 'plant' 
      ? editedPlantEntries.size > 0 
      : editedManEntries.size > 0;

    if (!hasEdits) {
      setIsEditMode(false);
      return;
    }

    try {
      if (activeTab === 'plant') {
        for (const [entryId, changes] of editedPlantEntries.entries()) {
          const group = plantTimesheetGroups.find(g => 
            g.timesheets.some(t => t.id === entryId)
          );
          const entry = group?.timesheets.find(t => t.id === entryId);
          
          if (entry && entry.isAdjustment && entry.plantAssetDocId) {
            console.log('[handleSave] Updating adjustment entry:', entryId, 'with changes:', changes);
            
            if (changes.openHours !== undefined || changes.closeHours !== undefined) {
              const openHours = changes.openHours ?? entry.openHours;
              const closeHours = changes.closeHours ?? entry.closeHours;
              const totalHours = closeHours - openHours;
              changes.totalHours = totalHours;
              console.log('[handleSave] Recalculated totalHours:', totalHours);
            }
            
            const timesheetRef = doc(db, 'plantAssets', entry.plantAssetDocId, 'timesheets', entryId);
            await updateDoc(timesheetRef, changes);
            console.log('[handleSave] ✅ Updated adjustment entry successfully');
          }
        }
      } else {
        for (const [entryId, changes] of editedManEntries.entries()) {
          const group = manHoursGroups.find(g => g.timesheets.some(t => t.id === entryId));
          const entry = group?.timesheets.find(t => t.id === entryId);
          
          if (entry && entry.isAdjustment) {
            console.log('[handleSave] Updating adjustment entry:', entryId, 'with changes:', changes);
            const timesheetRef = doc(db, 'operatorTimesheets', entryId);
            await updateDoc(timesheetRef, changes);
            console.log('[handleSave] ✅ Updated adjustment entry successfully');
          }
        }
      }

      setEditedPlantEntries(new Map());
      setEditedManEntries(new Map());
      setIsEditMode(false);
      Alert.alert('Success', 'Changes saved successfully');
      
      if (activeTab === 'plant') {
        loadPlantTimesheets();
      } else {
        loadManHoursTimesheets();
      }
    } catch (error) {
      console.error('[handleSave] ❌ Error saving changes:', error);
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const handleVerifyAll = async () => {
    const unverifiedCount = activeTab === 'plant'
      ? plantTimesheetGroups.reduce((count, group) => count + group.timesheets.filter(t => !t.verified).length, 0)
      : manHoursGroups.reduce((count, group) => count + group.timesheets.filter(t => !t.verified).length, 0);

    if (unverifiedCount === 0) {
      Alert.alert('Already Verified', 'All timesheets in this batch are already verified and submitted to billing.');
      return;
    }

    Alert.alert(
      'Verify All Timesheets',
      `This will verify ${unverifiedCount} unverified timesheet(s) and submit them to billing. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify All',
          style: 'default',
          onPress: async () => {
            try {
              let verifiedCount = 0;
              if (activeTab === 'plant') {
                for (const group of plantTimesheetGroups) {
                  for (const entry of group.timesheets) {
                    if (!entry.verified) {
                      await verifyTimesheetSilently(entry.id, entry.plantAssetDocId, group.asset);
                      verifiedCount++;
                    }
                  }
                }
              } else {
                for (const group of manHoursGroups) {
                  for (const entry of group.timesheets) {
                    if (!entry.verified) {
                      await verifyTimesheetSilently(entry.id);
                      verifiedCount++;
                    }
                  }
                }
              }
              
              Alert.alert('Success', `${verifiedCount} timesheet(s) verified and filed to billing`);
              
              if (activeTab === 'plant') {
                loadPlantTimesheets();
              } else {
                loadManHoursTimesheets();
              }
            } catch (error) {
              console.error('Error verifying timesheets:', error);
              Alert.alert('Error', 'Failed to verify some timesheets');
            }
          },
        },
      ]
    );
  };

  const updatePlantEditedEntry = (entryId: string, field: keyof TimesheetEntry, value: any) => {
    setEditedPlantEntries(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(entryId) || {};
      newMap.set(entryId, { ...existing, [field]: value });
      return newMap;
    });
  };

  const updateManEditedEntry = (entryId: string, field: keyof ManHoursEntry, value: any) => {
    setEditedManEntries(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(entryId) || {};
      newMap.set(entryId, { ...existing, [field]: value });
      return newMap;
    });
  };



  const deleteTimesheet = async (entryId: string, plantAssetDocId?: string, isPlantTab: boolean = true) => {
    console.log('[Delete] Attempting to delete:', { entryId, plantAssetDocId, isPlantTab });
    
    Alert.alert(
      'Delete Timesheet',
      'Are you sure you want to permanently delete this timesheet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[Delete] User confirmed deletion');
              
              if (isPlantTab && plantAssetDocId) {
                console.log('[Delete] Deleting plant timesheet');
                const group = plantTimesheetGroups.find(g => g.asset.id === plantAssetDocId);
                const entry = group?.timesheets.find(t => t.id === entryId);
                
                console.log('[Delete] Found entry:', entry);
                
                if (entry?.hasAdjustment && entry.adjustmentId) {
                  console.log('[Delete] Deleting adjustment first:', entry.adjustmentId);
                  const adjustmentRef = doc(db, 'plantAssets', plantAssetDocId, 'timesheets', entry.adjustmentId);
                  await deleteDoc(adjustmentRef);
                  console.log('[Delete] ✅ Adjustment deleted successfully');
                }
                
                console.log('[Delete] Deleting main timesheet:', entryId);
                const timesheetRef = doc(db, 'plantAssets', plantAssetDocId, 'timesheets', entryId);
                await deleteDoc(timesheetRef);
                console.log('[Delete] ✅ Plant timesheet deleted successfully');
                
                Alert.alert('Success', 'Plant timesheet deleted successfully');
                await loadPlantTimesheets();
              } else {
                console.log('[Delete] Deleting man hours timesheet');
                const group = manHoursGroups.find(g => g.timesheets.some(t => t.id === entryId));
                const entry = group?.timesheets.find(t => t.id === entryId);
                
                console.log('[Delete] Found entry:', entry);
                
                if (entry?.hasAdjustment && entry.adjustmentId) {
                  console.log('[Delete] Deleting adjustment first:', entry.adjustmentId);
                  const adjustmentRef = doc(db, 'operatorTimesheets', entry.adjustmentId);
                  await deleteDoc(adjustmentRef);
                  console.log('[Delete] ✅ Adjustment deleted successfully');
                }
                
                console.log('[Delete] Deleting main timesheet:', entryId);
                const timesheetRef = doc(db, 'operatorTimesheets', entryId);
                await deleteDoc(timesheetRef);
                console.log('[Delete] ✅ Man hours timesheet deleted successfully');
                
                Alert.alert('Success', 'Man hours timesheet deleted successfully');
                await loadManHoursTimesheets();
              }
            } catch (error: any) {
              console.error('[Delete] ❌ ERROR deleting timesheet:', error);
              console.error('[Delete] Error code:', error.code);
              console.error('[Delete] Error message:', error.message);
              console.error('[Delete] Full error:', JSON.stringify(error, null, 2));
              Alert.alert('Error', `Failed to delete: ${error.message || error}`);
            }
          },
        },
      ]
    );
  };

  const verifyTimesheetSilently = async (entryId: string, plantAssetDocId?: string, assetData?: PlantAsset) => {
    try {
      if (activeTab === 'plant' && plantAssetDocId) {
                const group = plantTimesheetGroups.find(g => g.asset.id === plantAssetDocId);
                const entry = group?.timesheets.find(t => t.id === entryId);
                
                if (!entry) {
                  console.error('[verifyTimesheet] ❌ Entry not found in plantTimesheetGroups');
                  throw new Error('Entry not found');
                }

                console.log('[verifyTimesheet] Found entry:', JSON.stringify(entry, null, 2));

                const timesheetRef = doc(db, 'plantAssets', plantAssetDocId, 'timesheets', entryId);

                await updateDoc(timesheetRef, {
                  verified: true,
                  verifiedAt: new Date().toISOString(),
                  verifiedBy: user?.name || user?.userId,
                });

                let dataToFile: any = { ...entry };
                delete dataToFile.id;
                delete dataToFile.plantAssetDocId;

                if (entry.hasAdjustment && entry.adjustmentId) {
                  const adjustmentEntry = group?.timesheets.find(t => t.id === entry.adjustmentId);
                  
                  if (adjustmentEntry) {
                    const originalData = { ...entry };
                    dataToFile = { ...adjustmentEntry };
                    delete dataToFile.id;
                    delete dataToFile.plantAssetDocId;
                    dataToFile.hasOriginalEntry = true;
                    dataToFile.originalEntryData = originalData;

                    await updateDoc(
                      doc(db, 'plantAssets', plantAssetDocId, 'timesheets', entry.adjustmentId),
                      {
                        verified: true,
                        verifiedAt: new Date().toISOString(),
                        verifiedBy: user?.name || user?.userId,
                      }
                    );
                  }
                }

                if (assetData) {
                  const verifiedTimesheetData = {
                    ...dataToFile,
                    verified: true,
                    verifiedAt: new Date().toISOString(),
                    verifiedBy: user?.name || user?.userId,
                    assetId: assetData.assetId,
                    assetType: assetData.type,
                    plantNumber: assetData.plantNumber,
                    registrationNumber: assetData.registrationNumber,
                    ownerId: assetData.ownerId,
                    ownerType: assetData.ownerType,
                    ownerName: assetData.ownerName,
                    masterAccountId: user?.masterAccountId,
                    siteId: user?.siteId,
                    type: 'plant_hours',
                  };
                  console.log('[verifyTimesheet] 📋 Writing to verifiedTimesheets:', JSON.stringify(verifiedTimesheetData, null, 2));
                  await addDoc(collection(db, 'verifiedTimesheets'), verifiedTimesheetData);
                  console.log('[verifyTimesheet] ✅ Successfully written to verifiedTimesheets');
                }

              } else if (activeTab === 'man') {
                const group = manHoursGroups.find(g => g.timesheets.some(t => t.id === entryId));
                const entry = group?.timesheets.find(t => t.id === entryId);
                
                if (!entry) {
                  console.error('[verifyTimesheet] ❌ Entry not found in manHoursGroups');
                  throw new Error('Entry not found');
                }

                console.log('[verifyTimesheet] Found entry:', JSON.stringify(entry, null, 2));

                await updateDoc(doc(db, 'operatorTimesheets', entryId), {
                  verified: true,
                  verifiedAt: new Date().toISOString(),
                  verifiedBy: user?.name || user?.userId,
                });

                let dataToFile: any = { ...entry };
                delete dataToFile.id;

                if (entry.hasAdjustment && entry.adjustmentId) {
                  const adjustmentEntry = group?.timesheets.find(t => t.id === entry.adjustmentId);

                  if (adjustmentEntry) {
                    const originalData = { ...entry };
                    dataToFile = { ...adjustmentEntry };
                    delete dataToFile.id;
                    dataToFile.hasOriginalEntry = true;
                    dataToFile.originalEntryData = originalData;

                    await updateDoc(
                      doc(db, 'operatorTimesheets', entry.adjustmentId),
                      {
                        verified: true,
                        verifiedAt: new Date().toISOString(),
                        verifiedBy: user?.name || user?.userId,
                      }
                    );
                  }
                }

                if (dataToFile) {
                  await addDoc(collection(db, 'verifiedTimesheets'), {
                    ...dataToFile,
                    verified: true,
                    verifiedAt: new Date().toISOString(),
                    verifiedBy: user?.name || user?.userId,
                    masterAccountId: user?.masterAccountId,
                    siteId: user?.siteId,
                    type: 'man_hours',
                  });
                }

              }
    } catch (error) {
      console.error('Error verifying timesheet:', error);
      throw error;
    }
  };

  const verifyTimesheet = async (entryId: string, plantAssetDocId?: string, assetData?: PlantAsset) => {
    const isAlreadyVerified = activeTab === 'plant'
      ? plantTimesheetGroups.some(g => g.timesheets.some(t => t.id === entryId && t.verified))
      : manHoursGroups.some(g => g.timesheets.some(t => t.id === entryId && t.verified));

    if (isAlreadyVerified) {
      Alert.alert('Already Verified', 'This timesheet has already been verified and submitted to billing.');
      return;
    }

    Alert.alert(
      'Verify Timesheet',
      'Are you sure you want to verify this timesheet? It will be filed to billing management.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          style: 'default',
          onPress: async () => {
            try {
              await verifyTimesheetSilently(entryId, plantAssetDocId, assetData);
              Alert.alert('Success', 'Timesheet verified and filed to billing');
              
              if (activeTab === 'plant') {
                loadPlantTimesheets();
              } else {
                loadManHoursTimesheets();
              }
            } catch (error) {
              console.error('Error verifying timesheet:', error);
              Alert.alert('Error', 'Failed to verify timesheet');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderPlantTimesheetGroup = (group: PlantTimesheetGroup, index: number) => {
    const groupKey = `plant-${group.asset.id}-${index}`;
    const isExpanded = expandedGroups.has(groupKey);

    return (
      <View key={groupKey} style={styles.groupCard}>
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={() => toggleGroupExpansion(groupKey)}
          activeOpacity={0.7}
        >
          <View style={styles.groupHeaderLeft}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.groupAssetType}>{group.asset.type}</Text>
              {group.timesheets[0]?.operatorName && (
                <Text style={styles.groupOperatorHeader}>({group.timesheets[0].operatorName})</Text>
              )}
            </View>
            <Text style={styles.groupAssetNumber}>
              {group.asset.plantNumber || group.asset.registrationNumber || group.asset.assetId}
            </Text>
            <Text style={styles.groupWeek}>
              Week: {group.weekStart} to {group.weekEnd}
            </Text>
            <Text style={styles.groupCount}>
              {group.timesheets.filter(t => !t.verified).length} unverified / {group.timesheets.length} total
            </Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={24} color="#64748b" />
          ) : (
            <ChevronDown size={24} color="#64748b" />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.spreadsheetContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={styles.spreadsheetTable}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.dateCol]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.timeCol]}>Open</Text>
                  <Text style={[styles.tableHeaderCell, styles.timeCol]}>Close</Text>
                  <Text style={[styles.tableHeaderCell, styles.hoursCol]}>Actuals</Text>
                  <View style={[styles.tableHeaderCell, styles.checkCol, styles.iconHeaderCell]}>
                    <Wrench size={18} color="#475569" />
                  </View>
                  <View style={[styles.tableHeaderCell, styles.checkCol, styles.iconHeaderCell]}>
                    <AlertTriangle size={18} color="#475569" />
                  </View>
                  <View style={[styles.tableHeaderCell, styles.checkCol, styles.iconHeaderCell]}>
                    <CloudRain size={18} color="#475569" />
                  </View>
                  <Text style={[styles.tableHeaderCell, styles.actionsCol]}>Actions</Text>
                </View>

                {group.timesheets.map((entry, idx) => {
                  const isAdjustmentRow = entry.isAdjustment;
                  const isVerified = entry.verified;
                  const uniqueKey = `${entry.plantAssetDocId}-${entry.id}-${idx}`;
                  const canEdit = isEditMode && isAdjustmentRow && !isVerified;
                  const editedData = editedPlantEntries.get(entry.id) || {};
                  const displayOpenHours = editedData.openHours ?? entry.openHours;
                  const displayCloseHours = editedData.closeHours ?? entry.closeHours;
                  const displayTotalHours = editedData.totalHours ?? entry.totalHours;

                  return (
                    <View key={uniqueKey} style={[styles.tableRow, isAdjustmentRow && styles.tableRowAdjustment, isVerified && styles.tableRowVerified]}>
                      <View style={[styles.tableCell, styles.dateCol]}>
                        <Text style={styles.dateCellText}>
                          {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </Text>
                        {isAdjustmentRow && (
                          <Text style={styles.adjustmentBadge}>PM EDIT</Text>
                        )}
                        {isVerified && (
                          <Text style={styles.verifiedBadge}>VERIFIED</Text>
                        )}
                      </View>
                      
                      {canEdit ? (
                        <>
                          <View style={[styles.tableCell, styles.timeCol]}>
                            <TextInput
                              keyboardType="numeric"
                              value={String(displayOpenHours)}
                              onChangeText={(text) => updatePlantEditedEntry(entry.id, 'openHours', parseFloat(text) || 0)}
                              style={styles.editableCell}
                            />
                          </View>
                          <View style={[styles.tableCell, styles.timeCol]}>
                            <TextInput
                              keyboardType="numeric"
                              value={String(displayCloseHours)}
                              onChangeText={(text) => updatePlantEditedEntry(entry.id, 'closeHours', parseFloat(text) || 0)}
                              style={styles.editableCell}
                            />
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={[styles.tableCell, styles.timeCol]}>{displayOpenHours}</Text>
                          <Text style={[styles.tableCell, styles.timeCol]}>{displayCloseHours}</Text>
                        </>
                      )}

                      <Text style={[styles.tableCell, styles.hoursCol, styles.hoursBold]}>
                        {displayTotalHours?.toFixed(1)}
                      </Text>

                      <View style={[styles.tableCell, styles.checkCol]}>
                        {canEdit ? (
                          <TouchableOpacity
                            onPress={() => updatePlantEditedEntry(entry.id, 'hasAttachment', !(editedData.hasAttachment ?? entry.hasAttachment))}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.checkbox, (editedData.hasAttachment ?? entry.hasAttachment) && styles.checkboxChecked]} />
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.checkbox, entry.hasAttachment && styles.checkboxChecked]} />
                        )}
                      </View>

                      <View style={[styles.tableCell, styles.checkCol]}>
                        {canEdit ? (
                          <TouchableOpacity
                            onPress={() => updatePlantEditedEntry(entry.id, 'isBreakdown', !(editedData.isBreakdown ?? entry.isBreakdown))}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.checkbox, (editedData.isBreakdown ?? entry.isBreakdown) && styles.checkboxChecked]} />
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.checkbox, entry.isBreakdown && styles.checkboxChecked]} />
                        )}
                      </View>

                      <View style={[styles.tableCell, styles.checkCol]}>
                        {canEdit ? (
                          <TouchableOpacity
                            onPress={() => updatePlantEditedEntry(entry.id, 'inclementWeather', !(editedData.inclementWeather ?? entry.inclementWeather))}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.checkbox, (editedData.inclementWeather ?? entry.inclementWeather) && styles.checkboxChecked]} />
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.checkbox, entry.inclementWeather && styles.checkboxChecked]} />
                        )}
                      </View>

                      <View style={[styles.tableCell, styles.actionsCol]}>
                        <View style={styles.actionButtons}>
                          {!isVerified && (
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => deleteTimesheet(entry.id, entry.plantAssetDocId, true)}
                            >
                              <Trash2 size={16} color="#fff" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderManHoursGroup = (group: ManHoursGroup, index: number) => {
    const groupKey = `man-${group.operatorId}-${index}`;
    const isExpanded = expandedGroups.has(groupKey);

    return (
      <View key={groupKey} style={styles.groupCard}>
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={() => toggleGroupExpansion(groupKey)}
          activeOpacity={0.7}
        >
          <View style={styles.groupHeaderLeft}>
            <Text style={styles.groupAssetType}>{group.operatorName}</Text>
            <Text style={styles.groupWeek}>
              Week: {group.weekStart} to {group.weekEnd}
            </Text>
            <Text style={styles.groupCount}>
              {group.timesheets.filter(t => !t.verified).length} unverified / {group.timesheets.length} total
            </Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={24} color="#64748b" />
          ) : (
            <ChevronDown size={24} color="#64748b" />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.spreadsheetContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={styles.spreadsheetTable}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.dateCol]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.timeCol]}>Start</Text>
                  <Text style={[styles.tableHeaderCell, styles.timeCol]}>Stop</Text>
                  <Text style={[styles.tableHeaderCell, styles.hoursCol]}>Total</Text>
                  <Text style={[styles.tableHeaderCell, styles.hoursCol]}>Normal</Text>
                  <Text style={[styles.tableHeaderCell, styles.hoursCol]}>Overtime</Text>
                  <Text style={[styles.tableHeaderCell, styles.actionsCol]}>Actions</Text>
                </View>

                {group.timesheets.map((entry, idx) => {
                  const isAdjustmentRow = entry.isAdjustment;
                  const isVerified = entry.verified;
                  const uniqueKey = `${group.operatorId}-${entry.id}-${idx}`;
                  const canEdit = isEditMode && isAdjustmentRow && !isVerified;
                  const editedData = editedManEntries.get(entry.id) || {};
                  const displayStartTime = editedData.startTime ?? entry.startTime;
                  const displayStopTime = editedData.stopTime ?? entry.stopTime;
                  const displayTotalManHours = editedData.totalManHours ?? entry.totalManHours;
                  const displayNormalHours = editedData.normalHours ?? entry.normalHours;
                  const displayOvertimeHours = editedData.overtimeHours ?? entry.overtimeHours;

                  return (
                    <View key={uniqueKey} style={[styles.tableRow, isAdjustmentRow && styles.tableRowAdjustment, isVerified && styles.tableRowVerified]}>
                      <View style={[styles.tableCell, styles.dateCol]}>
                        <Text style={styles.dateCellText}>
                          {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </Text>
                        {isAdjustmentRow && (
                          <Text style={styles.adjustmentBadge}>PM EDIT</Text>
                        )}
                        {isVerified && (
                          <Text style={styles.verifiedBadge}>VERIFIED</Text>
                        )}
                      </View>
                      
                      {canEdit ? (
                        <>
                          <View style={[styles.tableCell, styles.timeCol]}>
                            <TextInput
                              value={displayStartTime}
                              onChangeText={(text) => updateManEditedEntry(entry.id, 'startTime', text)}
                              placeholder="HH:MM"
                              style={styles.editableCell}
                            />
                          </View>
                          <View style={[styles.tableCell, styles.timeCol]}>
                            <TextInput
                              value={displayStopTime}
                              onChangeText={(text) => updateManEditedEntry(entry.id, 'stopTime', text)}
                              placeholder="HH:MM"
                              style={styles.editableCell}
                            />
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={[styles.tableCell, styles.timeCol]}>{displayStartTime}</Text>
                          <Text style={[styles.tableCell, styles.timeCol]}>{displayStopTime}</Text>
                        </>
                      )}

                      <Text style={[styles.tableCell, styles.hoursCol, styles.hoursBold]}>
                        {displayTotalManHours?.toFixed(1)}h
                      </Text>
                      <Text style={[styles.tableCell, styles.hoursCol]}>
                        {displayNormalHours?.toFixed(1)}h
                      </Text>
                      <Text style={[styles.tableCell, styles.hoursCol]}>
                        {displayOvertimeHours?.toFixed(1)}h
                      </Text>

                      <View style={[styles.tableCell, styles.actionsCol]}>
                        <View style={styles.actionButtons}>
                          {!isVerified && (
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => deleteTimesheet(entry.id, undefined, false)}
                            >
                              <Trash2 size={16} color="#fff" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={commonStyles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitleWithSync title="Time Sheets" />,
          headerRight: () => <StandardHeaderRight />,
          headerStyle: {
            backgroundColor: theme.headerBg,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerBackVisible: true,
        }}
      />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'plant' && styles.tabActive]}
          onPress={() => setActiveTab('plant')}
        >
          <FileSpreadsheet size={20} color={activeTab === 'plant' ? '#f59e0b' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'plant' && styles.tabTextActive]}>
            Plant Hours
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'man' && styles.tabActive]}
          onPress={() => setActiveTab('man')}
        >
          <FileSpreadsheet size={20} color={activeTab === 'man' ? '#f59e0b' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'man' && styles.tabTextActive]}>
            Man Hours
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.dateRangeRow}>
          <View style={styles.datePickerBlock}>
            <Text style={styles.dateLabel}>From</Text>
            <View style={styles.dateDisplay}>
              <Calendar size={16} color="#64748b" />
              <Text style={styles.dateText}>{formatDate(startDate)}</Text>
            </View>
          </View>

          <View style={styles.datePickerBlock}>
            <Text style={styles.dateLabel}>To</Text>
            <View style={styles.dateDisplay}>
              <Calendar size={16} color="#64748b" />
              <Text style={styles.dateText}>{formatDate(endDate)}</Text>
            </View>
          </View>
        </View>

        {activeTab === 'plant' && (
          <>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Subcontractor:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedSubcontractor && styles.filterChipActive]}
                  onPress={() => setSelectedSubcontractor(null)}
                >
                  <Text style={[styles.filterChipText, !selectedSubcontractor && styles.filterChipTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {subcontractors.map(sub => (
                  <TouchableOpacity
                    key={sub.id}
                    style={[styles.filterChip, selectedSubcontractor === sub.id && styles.filterChipActive]}
                    onPress={() => setSelectedSubcontractor(sub.id!)}
                  >
                    <Text style={[styles.filterChipText, selectedSubcontractor === sub.id && styles.filterChipTextActive]}>
                      {sub.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Plant Type:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedPlantType && styles.filterChipActive]}
                  onPress={() => setSelectedPlantType(null)}
                >
                  <Text style={[styles.filterChipText, !selectedPlantType && styles.filterChipTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {plantTypes.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.filterChip, selectedPlantType === type && styles.filterChipActive]}
                    onPress={() => setSelectedPlantType(type)}
                  >
                    <Text style={[styles.filterChipText, selectedPlantType === type && styles.filterChipTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </View>

      <View style={styles.staticButtonsContainer}>
        <TouchableOpacity 
          style={[styles.staticButton, styles.editButton]}
          onPress={() => {
            if (isEditMode) {
              setIsEditMode(false);
              setEditedPlantEntries(new Map());
              setEditedManEntries(new Map());
            } else {
              handleEnterEditMode();
            }
          }}
        >
          <Text style={styles.staticButtonText}>
            {isEditMode ? 'Cancel Edit' : 'Edit'}
          </Text>
        </TouchableOpacity>
        
        {isEditMode && (
          <TouchableOpacity 
            style={[styles.staticButton, styles.saveButton]}
            onPress={handleSave}
          >
            <Text style={styles.staticButtonText}>Save</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.staticButton, styles.verifyButton]}
          onPress={handleVerifyAll}
        >
          <CheckCircle2 size={20} color="#fff" />
          <Text style={styles.staticButtonText}>Verify All</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading timesheets...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {activeTab === 'plant' ? (
              plantTimesheetGroups.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No unverified plant timesheets found</Text>
                </View>
              ) : (
                plantTimesheetGroups.map((group, index) => renderPlantTimesheetGroup(group, index))
              )
            ) : (
              manHoursGroups.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No unverified man hours timesheets found</Text>
                </View>
              ) : (
                manHoursGroups.map((group, index) => renderManHoursGroup(group, index))
              )
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.7}
        >
          <Home size={24} color="#f59e0b" />
          <Text style={styles.footerButtonText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => router.push('/qr-scanner')}
          activeOpacity={0.7}
        >
          <View style={styles.scanQRButton}>
            <QrCode size={28} color="#fff" />
          </View>
          <Text style={styles.footerButtonText}>Scan QR</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => router.push('/company-settings')}
          activeOpacity={0.7}
        >
          <Settings size={24} color="#f59e0b" />
          <Text style={styles.footerButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
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
    borderBottomColor: '#f59e0b',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#f59e0b',
  },
  filtersContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  datePickerBlock: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  dateText: {
    fontSize: 14,
    color: '#1e293b',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  groupCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  groupHeaderLeft: {
    flex: 1,
  },
  groupAssetType: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  groupAssetNumber: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  groupOperatorHeader: {
    fontSize: 15,
    color: '#3b82f6',
    fontWeight: '600',
  },
  groupWeek: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
  },
  groupCount: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
    marginTop: 4,
  },
  spreadsheetContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 12,
  },
  spreadsheetTable: {
    backgroundColor: '#ffffff',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowWithAdjustment: {
    backgroundColor: '#fef3c7',
  },
  tableRowAdjustment: {
    backgroundColor: '#dbeafe',
  },
  tableRowVerified: {
    backgroundColor: '#f0fdf4',
    opacity: 0.7,
  },
  tableCell: {
    fontSize: 13,
    color: '#475569',
    justifyContent: 'center',
  },
  dateCellText: {
    fontSize: 13,
    color: '#475569',
  },
  adjustmentBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  verifiedBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#15803d',
    backgroundColor: '#bbf7d0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  editableCell: {
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#eff6ff',
    fontSize: 13,
    color: '#475569',
    width: '100%',
  },
  dateCol: {
    width: 80,
  },
  timeCol: {
    width: 70,
  },
  hoursCol: {
    width: 70,
  },
  hoursBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  checkCol: {
    width: 70,
    alignItems: 'center',
  },
  iconHeaderCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsCol: {
    width: 230,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#3b82f6',
  },
  verifyButton: {
    backgroundColor: '#10b981',
  },
  saveButton: {
    backgroundColor: '#059669',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#dc2626',
  },
  selectCol: {
    width: 60,
    alignItems: 'center',
  },
  staticButtonsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  staticButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  staticButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  footerButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  scanQRButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
