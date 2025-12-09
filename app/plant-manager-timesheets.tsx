import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { FileSpreadsheet, ChevronDown, ChevronUp, Check, Calendar, CheckCircle2, X, Wrench, AlertTriangle, CloudRain, Trash2 } from 'lucide-react-native';
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
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<any>({});

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
        const timesheets = timesheetsSnapshot.docs
          .map(doc => ({ id: doc.id, plantAssetDocId: asset.id, ...doc.data() } as TimesheetEntry))
          .filter(t => !t.verified && !t.isAdjustment);

        if (timesheets.length > 0) {
          const weekStart = timesheets[0].date;
          const weekEnd = timesheets[timesheets.length - 1].date;

          groups.push({
            asset,
            timesheets,
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
      const timesheets = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ManHoursEntry))
        .filter(t => !t.verified && !t.isAdjustment);

      const groupedByOperator = timesheets.reduce((acc, timesheet) => {
        const key = timesheet.operatorId || timesheet.operatorName;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(timesheet);
        return acc;
      }, {} as Record<string, ManHoursEntry[]>);

      const groups: ManHoursGroup[] = Object.entries(groupedByOperator).map(([key, timesheets]) => {
        const weekStart = timesheets[0].date;
        const weekEnd = timesheets[timesheets.length - 1].date;

        return {
          operatorId: timesheets[0].operatorId || key,
          operatorName: timesheets[0].operatorName,
          timesheets,
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

  const startEditing = (entryId: string, currentValues: any) => {
    setEditingEntry(entryId);
    setEditedValues(currentValues);
  };

  const cancelEditing = () => {
    setEditingEntry(null);
    setEditedValues({});
  };

  const saveEdit = async (entryId: string, plantAssetDocId?: string) => {
    try {
      if (activeTab === 'plant' && plantAssetDocId) {
        const originalTimesheetRef = doc(db, 'plantAssets', plantAssetDocId, 'timesheets', entryId);
        
        const group = plantTimesheetGroups.find(g => g.asset.id === plantAssetDocId);
        const originalEntry = group?.timesheets.find(t => t.id === entryId);
        const existingAdjustmentId = originalEntry?.adjustmentId;

        const adjustmentEntry = {
          ...editedValues,
          isAdjustment: true,
          originalEntryId: entryId,
          adjustedBy: user?.name || user?.userId,
          adjustedAt: new Date().toISOString(),
          updatedAt: new Date(),
        };

        if (existingAdjustmentId) {
          // Update existing adjustment
          await updateDoc(
            doc(db, 'plantAssets', plantAssetDocId, 'timesheets', existingAdjustmentId),
            adjustmentEntry
          );
          console.log('[PlantManager] Updated existing adjustment:', existingAdjustmentId);
        } else {
          // Create new adjustment
          adjustmentEntry.createdAt = new Date();
          const adjustmentRef = await addDoc(
            collection(db, 'plantAssets', plantAssetDocId, 'timesheets'),
            adjustmentEntry
          );

          await updateDoc(originalTimesheetRef, {
            hasAdjustment: true,
            adjustmentId: adjustmentRef.id,
          });
          console.log('[PlantManager] Created new adjustment:', adjustmentRef.id);
        }
      } else if (activeTab === 'man') {
        const originalTimesheetRef = doc(db, 'operatorTimesheets', entryId);

        const group = manHoursGroups.find(g => g.timesheets.some(t => t.id === entryId));
        const originalEntry = group?.timesheets.find(t => t.id === entryId);
        const existingAdjustmentId = originalEntry?.adjustmentId;

        const adjustmentEntry = {
          ...editedValues,
          isAdjustment: true,
          originalEntryId: entryId,
          adjustedBy: user?.name || user?.userId,
          adjustedAt: new Date().toISOString(),
          updatedAt: new Date(),
        };

        if (existingAdjustmentId) {
          // Update existing adjustment
          await updateDoc(
            doc(db, 'operatorTimesheets', existingAdjustmentId),
            adjustmentEntry
          );
          console.log('[PlantManager] Updated existing adjustment:', existingAdjustmentId);
        } else {
          // Create new adjustment
          adjustmentEntry.createdAt = new Date();
          const adjustmentRef = await addDoc(
            collection(db, 'operatorTimesheets'),
            adjustmentEntry
          );

          await updateDoc(originalTimesheetRef, {
            hasAdjustment: true,
            adjustmentId: adjustmentRef.id,
          });
          console.log('[PlantManager] Created new adjustment:', adjustmentRef.id);
        }
      }

      Alert.alert('Success', 'Adjustment saved successfully');
      setEditingEntry(null);
      setEditedValues({});
      
      if (activeTab === 'plant') {
        loadPlantTimesheets();
      } else {
        loadManHoursTimesheets();
      }
    } catch (error) {
      console.error('Error saving edit:', error);
      Alert.alert('Error', 'Failed to save adjustment');
    }
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

  const verifyTimesheet = async (entryId: string, plantAssetDocId?: string, assetData?: PlantAsset) => {
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
              if (activeTab === 'plant' && plantAssetDocId) {
                const timesheetRef = doc(db, 'plantAssets', plantAssetDocId, 'timesheets', entryId);
                
                const timesheetSnapshot = await getDocs(
                  query(
                    collection(db, 'plantAssets', plantAssetDocId, 'timesheets'), 
                    where('__name__', '==', entryId)
                  )
                );
                const timesheetData = timesheetSnapshot.docs[0]?.data();

                await updateDoc(timesheetRef, {
                  verified: true,
                  verifiedAt: new Date().toISOString(),
                  verifiedBy: user?.name || user?.userId,
                });

                const dataToFile = { ...timesheetData };

                if (timesheetData?.hasAdjustment && timesheetData?.adjustmentId) {
                  const adjustmentSnapshot = await getDocs(
                    query(
                      collection(db, 'plantAssets', plantAssetDocId, 'timesheets'),
                      where('__name__', '==', timesheetData.adjustmentId)
                    )
                  );
                  const adjustmentData = adjustmentSnapshot.docs[0]?.data();
                  
                  if (adjustmentData) {
                    Object.assign(dataToFile, adjustmentData);
                    dataToFile.hasOriginalEntry = true;
                    dataToFile.originalEntryData = timesheetData;

                    await updateDoc(
                      doc(db, 'plantAssets', plantAssetDocId, 'timesheets', timesheetData.adjustmentId),
                      {
                        verified: true,
                        verifiedAt: new Date().toISOString(),
                        verifiedBy: user?.name || user?.userId,
                      }
                    );
                  }
                }

                if (assetData) {
                  await addDoc(collection(db, 'verifiedTimesheets'), {
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
                  });
                }

                Alert.alert('Success', 'Plant timesheet verified and filed to billing');
                loadPlantTimesheets();
              } else if (activeTab === 'man') {
                const timesheetSnapshot = await getDocs(
                  query(
                    collection(db, 'operatorTimesheets'),
                    where('__name__', '==', entryId)
                  )
                );
                const timesheetData = timesheetSnapshot.docs[0]?.data();

                await updateDoc(doc(db, 'operatorTimesheets', entryId), {
                  verified: true,
                  verifiedAt: new Date().toISOString(),
                  verifiedBy: user?.name || user?.userId,
                });

                const dataToFile = { ...timesheetData };

                if (timesheetData?.hasAdjustment && timesheetData?.adjustmentId) {
                  const adjustmentSnapshot = await getDocs(
                    query(
                      collection(db, 'operatorTimesheets'),
                      where('__name__', '==', timesheetData.adjustmentId)
                    )
                  );
                  const adjustmentData = adjustmentSnapshot.docs[0]?.data();

                  if (adjustmentData) {
                    Object.assign(dataToFile, adjustmentData);
                    dataToFile.hasOriginalEntry = true;
                    dataToFile.originalEntryData = timesheetData;

                    await updateDoc(
                      doc(db, 'operatorTimesheets', timesheetData.adjustmentId),
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

                Alert.alert('Success', 'Man hours timesheet verified and filed to billing');
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

  const handleDateChange = (type: 'start' | 'end', date: Date) => {
    if (type === 'start') {
      setStartDate(date);
    } else {
      setEndDate(date);
    }
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
            <Text style={styles.groupCount}>{group.timesheets.length} unverified entries</Text>
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

                {group.timesheets.map((entry) => {
                  const isEditing = editingEntry === entry.id;
                  const rowValues = isEditing ? editedValues : entry;
                  const hasAdjustmentIndicator = entry.hasAdjustment && !entry.isAdjustment;

                  return (
                    <View key={`${entry.id}-${entry.isAdjustment ? 'adj' : 'orig'}`} style={[styles.tableRow, hasAdjustmentIndicator && styles.tableRowWithAdjustment]}>
                      <View style={[styles.tableCell, styles.dateCol]}>
                        <Text style={styles.dateCellText}>
                          {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </Text>
                        {hasAdjustmentIndicator && (
                          <Text style={styles.adjustmentBadge}>ADJ</Text>
                        )}
                      </View>
                      
                      {isEditing ? (
                        <>
                          <TextInput
                            style={[styles.tableCell, styles.timeCol, styles.editableCell]}
                            value={rowValues.openHours?.toString() || ''}
                            onChangeText={(text) => setEditedValues({ ...rowValues, openHours: parseFloat(text) || 0 })}
                            keyboardType="numeric"
                          />
                          <TextInput
                            style={[styles.tableCell, styles.timeCol, styles.editableCell]}
                            value={rowValues.closeHours?.toString() || ''}
                            onChangeText={(text) => {
                              const close = parseFloat(text) || 0;
                              const totalHours = close - (rowValues.openHours || 0);
                              setEditedValues({ ...rowValues, closeHours: close, totalHours });
                            }}
                            keyboardType="numeric"
                          />
                        </>
                      ) : (
                        <>
                          <Text style={[styles.tableCell, styles.timeCol]}>{entry.openHours}</Text>
                          <Text style={[styles.tableCell, styles.timeCol]}>{entry.closeHours}</Text>
                        </>
                      )}

                      <Text style={[styles.tableCell, styles.hoursCol, styles.hoursBold]}>
                        {isEditing ? rowValues.totalHours?.toFixed(1) : entry.totalHours?.toFixed(1)}
                      </Text>

                      <View style={[styles.tableCell, styles.checkCol]}>
                        {isEditing ? (
                          <Switch
                            value={rowValues.hasAttachment}
                            onValueChange={(val) => setEditedValues({ ...rowValues, hasAttachment: val })}
                            trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                            thumbColor="#fff"
                          />
                        ) : (
                          <View style={[styles.checkbox, entry.hasAttachment && styles.checkboxChecked]} />
                        )}
                      </View>

                      <View style={[styles.tableCell, styles.checkCol]}>
                        {isEditing ? (
                          <Switch
                            value={rowValues.isBreakdown}
                            onValueChange={(val) => setEditedValues({ ...rowValues, isBreakdown: val })}
                            trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                            thumbColor="#fff"
                          />
                        ) : (
                          <View style={[styles.checkbox, entry.isBreakdown && styles.checkboxChecked]} />
                        )}
                      </View>

                      <View style={[styles.tableCell, styles.checkCol]}>
                        {isEditing ? (
                          <Switch
                            value={rowValues.inclementWeather}
                            onValueChange={(val) => setEditedValues({ ...rowValues, inclementWeather: val })}
                            trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                            thumbColor="#fff"
                          />
                        ) : (
                          <View style={[styles.checkbox, entry.inclementWeather && styles.checkboxChecked]} />
                        )}
                      </View>

                      <View style={[styles.tableCell, styles.actionsCol]}>
                        {isEditing ? (
                          <View style={styles.actionButtons}>
                            <TouchableOpacity
                              style={styles.saveButton}
                              onPress={() => saveEdit(entry.id, entry.plantAssetDocId)}
                            >
                              <Check size={16} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.cancelButton}
                              onPress={cancelEditing}
                            >
                              <X size={16} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.actionButtons}>
                            <TouchableOpacity
                              style={styles.editButton}
                              onPress={() => startEditing(entry.id, entry)}
                            >
                              <Text style={styles.editButtonText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.verifyButton}
                              onPress={() => verifyTimesheet(entry.id, entry.plantAssetDocId, group.asset)}
                            >
                              <CheckCircle2 size={16} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => deleteTimesheet(entry.id, entry.plantAssetDocId, true)}
                            >
                              <Trash2 size={16} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        )}
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
            <Text style={styles.groupCount}>{group.timesheets.length} unverified entries</Text>
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

                {group.timesheets.map((entry) => {
                  const isEditing = editingEntry === entry.id;
                  const rowValues = isEditing ? editedValues : entry;
                  const hasAdjustmentIndicator = entry.hasAdjustment && !entry.isAdjustment;

                  return (
                    <View key={`${entry.id}-${entry.isAdjustment ? 'adj' : 'orig'}`} style={[styles.tableRow, hasAdjustmentIndicator && styles.tableRowWithAdjustment]}>
                      <View style={[styles.tableCell, styles.dateCol]}>
                        <Text style={styles.dateCellText}>
                          {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </Text>
                        {hasAdjustmentIndicator && (
                          <Text style={styles.adjustmentBadge}>ADJ</Text>
                        )}
                      </View>
                      
                      {isEditing ? (
                        <>
                          <TextInput
                            style={[styles.tableCell, styles.timeCol, styles.editableCell]}
                            value={rowValues.startTime || ''}
                            onChangeText={(text) => setEditedValues({ ...rowValues, startTime: text })}
                          />
                          <TextInput
                            style={[styles.tableCell, styles.timeCol, styles.editableCell]}
                            value={rowValues.stopTime || ''}
                            onChangeText={(text) => setEditedValues({ ...rowValues, stopTime: text })}
                          />
                        </>
                      ) : (
                        <>
                          <Text style={[styles.tableCell, styles.timeCol]}>{entry.startTime}</Text>
                          <Text style={[styles.tableCell, styles.timeCol]}>{entry.stopTime}</Text>
                        </>
                      )}

                      <Text style={[styles.tableCell, styles.hoursCol, styles.hoursBold]}>
                        {entry.totalManHours?.toFixed(1)}h
                      </Text>
                      <Text style={[styles.tableCell, styles.hoursCol]}>
                        {entry.normalHours?.toFixed(1)}h
                      </Text>
                      <Text style={[styles.tableCell, styles.hoursCol]}>
                        {entry.overtimeHours?.toFixed(1)}h
                      </Text>

                      <View style={[styles.tableCell, styles.actionsCol]}>
                        {isEditing ? (
                          <View style={styles.actionButtons}>
                            <TouchableOpacity
                              style={styles.saveButton}
                              onPress={() => saveEdit(entry.id)}
                            >
                              <Check size={16} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.cancelButton}
                              onPress={cancelEditing}
                            >
                              <X size={16} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.actionButtons}>
                            <TouchableOpacity
                              style={styles.editButton}
                              onPress={() => startEditing(entry.id, entry)}
                            >
                              <Text style={styles.editButtonText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.verifyButton}
                              onPress={() => verifyTimesheet(entry.id)}
                            >
                              <CheckCircle2 size={16} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => deleteTimesheet(entry.id, undefined, false)}
                            >
                              <Trash2 size={16} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        )}
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
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e: any) => handleDateChange('start', new Date(e.target.value))}
                style={{
                  height: 40,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  borderRadius: 8,
                  paddingLeft: 12,
                  paddingRight: 12,
                  fontSize: 14,
                  color: '#1e293b',
                  backgroundColor: '#ffffff',
                  fontFamily: 'system-ui',
                }}
              />
            ) : (
              <View style={styles.dateDisplay}>
                <Calendar size={16} color="#64748b" />
                <Text style={styles.dateText}>{formatDate(startDate)}</Text>
              </View>
            )}
          </View>

          <View style={styles.datePickerBlock}>
            <Text style={styles.dateLabel}>To</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={endDate.toISOString().split('T')[0]}
                onChange={(e: any) => handleDateChange('end', new Date(e.target.value))}
                style={{
                  height: 40,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  borderRadius: 8,
                  paddingLeft: 12,
                  paddingRight: 12,
                  fontSize: 14,
                  color: '#1e293b',
                  backgroundColor: '#ffffff',
                  fontFamily: 'system-ui',
                }}
              />
            ) : (
              <View style={styles.dateDisplay}>
                <Calendar size={16} color="#64748b" />
                <Text style={styles.dateText}>{formatDate(endDate)}</Text>
              </View>
            )}
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
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: '#f59e0b',
    backgroundColor: '#fef3c7',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  verifyButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  saveButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#dc2626',
  },

});
