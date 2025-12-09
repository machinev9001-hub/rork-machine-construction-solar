import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, serverTimestamp, writeBatch, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Grid3x3, Check, Save, Lock } from 'lucide-react-native';
import { GridConfiguration, GridCellProgress, ActivityModuleConfig } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { checkAndLockGridCells } from '@/utils/gridCellLock';
import { syncGridActivityScopeValue } from '@/utils/activityModuleHelpers';


type CellStatus = 'pending' | 'completed';

type GridCellData = {
  rowIndex: number;
  columnIndex: number;
  rowLabel: string;
  columnLabel: string;
  status: CellStatus;
  value?: number;
};

type ActivityGridViewProps = {
  gridConfig: GridConfiguration;
  activityId: string;
  activityName: string;
  taskId: string;
  siteId: string;
  supervisorId: string;
  supervisorName: string;
  onCellPress?: (cell: GridCellData) => void;
  moduleConfig?: ActivityModuleConfig;
};

function getStatusIcon(status: CellStatus) {
  if (status === 'completed') {
    return <Check size={14} color="#fff" strokeWidth={3} />;
  }
  return null;
}

function getStatusColor(status: CellStatus): string {
  return status === 'completed' ? '#34A853' : '#e8eaed';
}

export default function ActivityGridView({ gridConfig, activityId, activityName, taskId, siteId, supervisorId, supervisorName, onCellPress, moduleConfig }: ActivityGridViewProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const { data: activityData } = useQuery({
    queryKey: ['activity', activityId, taskId],
    queryFn: async () => {
      console.log('📊 Fetching activity data for QC values...');
      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const data = snapshot.docs[0].data();
      return { 
        id: snapshot.docs[0].id, 
        scopeValue: data.scopeValue || 0,
        qcValue: data.qcValue || 0,
        qcRequested: data.qcRequested || false,
      };
    },
    enabled: !!activityId && !!taskId,
  });

  const { data: cellProgressData = [], isLoading } = useQuery({
    queryKey: ['gridCellProgress', activityId, taskId, siteId],
    queryFn: async () => {
      console.log('📊 Fetching grid cell progress data...');
      console.log('  Activity ID:', activityId);
      console.log('  Task ID:', taskId);
      console.log('  Site ID:', siteId);
      
      const progressRef = collection(db, 'gridCellProgress');
      const q = query(
        progressRef,
        where('activityId', '==', activityId),
        where('taskId', '==', taskId),
        where('siteId', '==', siteId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as GridCellProgress[];
      
      console.log('✅ Fetched', data.length, 'grid cell progress records');
      return data;
    },
    enabled: !!activityId && !!taskId && !!siteId,
  });

  const cellProgressMap = useMemo(() => {
    const map: Record<string, GridCellProgress> = {};
    cellProgressData.forEach(cell => {
      const key = `${cell.column}-${cell.row}`;
      map[key] = cell;
    });
    return map;
  }, [cellProgressData]);

  const completedCellsSet = useMemo(() => {
    const set = new Set<string>();
    cellProgressData.forEach(cell => {
      if (cell.status === 'completed') {
        set.add(`${cell.column}-${cell.row}`);
      }
    });
    return set;
  }, [cellProgressData]);

  const lockedCellsSet = useMemo(() => {
    const set = new Set<string>();
    cellProgressData.forEach(cell => {
      if (cell.isLocked) {
        set.add(`${cell.column}-${cell.row}`);
      }
    });
    return set;
  }, [cellProgressData]);



  useEffect(() => {
    const interval = setInterval(() => {
      if (activityId && taskId && siteId) {
        checkAndLockGridCells({ activityId, taskId, siteId }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['gridCellProgress', activityId, taskId, siteId] });
        }).catch(err => {
          console.error('Failed to lock grid cells:', err);
        });
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [activityId, taskId, siteId, queryClient]);

  const generateGrid = (): GridCellData[][] => {
    const grid: GridCellData[][] = [];
    
    const flexibleColumns = gridConfig.flexibleColumns || [];
    
    if (flexibleColumns.length === 0) {
      console.warn('⚠️ No flexible columns configured in gridConfig');
      return [];
    }
    
    console.log('📊 Generating grid from flexible columns:', flexibleColumns);
    
    const maxRows = Math.max(...flexibleColumns.map(col => col.rows));
    
    for (let r = 0; r < maxRows; r++) {
      const row: GridCellData[] = [];
      
      flexibleColumns.forEach((flexCol, colIndex) => {
        if (r < flexCol.rows) {
          const columnLabel = flexCol.column;
          const rowLabel = String(r + 1);
          
          const cellKey = `${columnLabel}-${rowLabel}`;
          const cellProgress = cellProgressMap[cellKey];
          
          row.push({
            rowIndex: r,
            columnIndex: colIndex,
            columnLabel,
            rowLabel,
            status: (cellProgress?.status === 'completed' ? 'completed' : 'pending') as CellStatus,
            value: cellProgress?.completedValue,
          });
        }
      });
      
      if (row.length > 0) {
        grid.push(row);
      }
    }
    
    console.log('✅ Generated grid with', grid.length, 'rows');
    return grid;
  };

  const gridData = generateGrid();

  const saveBatchMutation = useMutation({
    mutationFn: async (cells: GridCellData[]) => {
      console.log('💾 Saving batch of', cells.length, 'cells...');
      
      const batch = writeBatch(db);
      const targetValue = gridConfig.scopeValue || 1;
      
      cells.forEach(cell => {
        const cellId = `${activityId}_${taskId}_${cell.columnLabel}_${cell.rowLabel}`;
        const cellRef = doc(db, 'gridCellProgress', cellId);
        
        const cellData: GridCellProgress = {
          id: cellId,
          activityId,
          activityName,
          taskId,
          siteId,
          masterAccountId: user?.masterAccountId || '',
          pvAreaId: gridConfig.pvAreaId || '',
          pvAreaName: gridConfig.pvAreaName || '',
          blockAreaId: gridConfig.blockAreaId || '',
          blockAreaName: gridConfig.blockAreaName || '',
          row: cell.rowLabel,
          rowIndex: cell.rowIndex,
          column: cell.columnLabel,
          columnIndex: cell.columnIndex,
          supervisorId,
          supervisorName,
          status: 'completed',
          completedValue: targetValue,
          targetValue,
          unit: gridConfig.scopeUnit || 'm',
          progressPercentage: 100,
          lastUpdatedAt: serverTimestamp(),
          completedAt: serverTimestamp(),
          notes: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        batch.set(cellRef, cellData, { merge: true });
      });
      
      await batch.commit();
      console.log('✅ Grid cells saved to gridCellProgress collection');
      
      console.log('📊 Now updating parent activity completedToday field...');
      const activitiesRef = collection(db, 'activities');
      const activityQuery = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const activitySnap = await getDocs(activityQuery);
      
      if (!activitySnap.empty) {
        const activityDocId = activitySnap.docs[0].id;
        const activityData = activitySnap.docs[0].data();
        
        const totalCells = (gridConfig.flexibleColumns || []).reduce((sum, col) => sum + col.rows, 0);
        const allProgressData = [...cellProgressData, ...cells.map(c => ({
          column: c.columnLabel,
          row: c.rowLabel,
          status: 'completed'
        }))];
        
        const uniqueCompleted = new Set(
          allProgressData.filter(c => c.status === 'completed').map(c => `${c.column}-${c.row}`)
        ).size;
        
        const scopeValue = activityData.scopeValue || gridConfig.scopeValue || totalCells;
        const completedToday = uniqueCompleted * (gridConfig.scopeValue || 1);
        
        console.log('📊 Grid progress calculation:');
        console.log('  - Completed cells:', uniqueCompleted, '/', totalCells);
        console.log('  - Value per cell:', (gridConfig.scopeValue || 1));
        console.log('  - Total completedToday:', completedToday);
        console.log('  - Scope value:', scopeValue);
        
        const progressEntriesRef = collection(db, 'activities', activityDocId, 'progressEntries');
        const today = new Date().toISOString().split('T')[0];
        
        const existingEntriesSnap = await getDocs(
          query(
            progressEntriesRef,
            where('supervisorId', '==', supervisorId),
            where('taskId', '==', taskId),
            where('activityId', '==', activityId)
          )
        );
        
        let todayEntry: any = null;
        existingEntriesSnap.docs.forEach((docSnap) => {
          const entryData = docSnap.data();
          const entryDate = entryData.enteredAt?.toDate?.();
          if (entryDate) {
            const entryDateStr = entryDate.toISOString().split('T')[0];
            if (entryDateStr === today) {
              todayEntry = { id: docSnap.id, data: entryData };
            }
          }
        });
        
        const progressEntryData = {
          supervisorId,
          supervisorName,
          enteredAt: serverTimestamp(),
          value: completedToday,
          unit: gridConfig.scopeUnit || 'm',
          canonicalUnit: gridConfig.scopeUnit || 'm',
          taskId,
          activityId,
          siteId,
          source: 'grid',
        };
        
        if (todayEntry) {
          await updateDoc(doc(db, 'activities', activityDocId, 'progressEntries', todayEntry.id), progressEntryData);
          console.log('✅ Updated progressEntry for grid activity');
        } else {
          await addDoc(progressEntriesRef, progressEntryData);
          console.log('✅ Created progressEntry for grid activity');
        }
        
        await updateDoc(doc(db, 'activities', activityDocId), {
          completedToday,
          supervisorInputValue: completedToday,
          completedTodayUnit: gridConfig.scopeUnit || 'm',
          completedTodayUpdatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: supervisorId,
        });
        
        console.log('✅ Updated activity completedToday field:', completedToday);
        console.log('🎯 Grid activity now follows same workflow as standard activities');
        
        console.log('🔄 Now syncing scopeValue field with calculated grid total...');
        await syncGridActivityScopeValue(activityDocId, gridConfig, supervisorId);
        console.log('✅ Grid activity scopeValue field synced with calculated total');
      } else {
        console.error('❌ Activity document not found for grid progress update');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gridCellProgress', activityId, taskId, siteId] });
      setSelectedCells(new Set());
      setIsSaving(false);
    },
    onError: (error) => {
      console.error('❌ Failed to save cells:', error);
      setIsSaving(false);
    },
  });

  const mutateFn = saveBatchMutation.mutate;

  const handleCellPress = useCallback((cell: GridCellData) => {
    const cellKey = `${cell.columnLabel}-${cell.rowLabel}`;
    console.log('🎯 Cell tapped:', cellKey);
    
    if (completedCellsSet.has(cellKey)) {
      console.log('⚠️ Cell already completed, ignoring tap');
      return;
    }
    
    if (lockedCellsSet.has(cellKey)) {
      console.log('🔒 Cell is locked, ignoring tap');
      return;
    }
    
    setSelectedCells(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cellKey)) {
        newSet.delete(cellKey);
        console.log('➖ Deselected:', cellKey);
      } else {
        newSet.add(cellKey);
        console.log('➕ Selected:', cellKey);
      }
      return newSet;
    });
    
    onCellPress?.(cell);
  }, [completedCellsSet, lockedCellsSet, onCellPress]);

  const handleSaveProgress = useCallback(() => {
    if (selectedCells.size === 0 || isSaving) return;
    
    setIsSaving(true);
    const cellsToSave: GridCellData[] = [];
    
    gridData.forEach(row => {
      row.forEach(cell => {
        const cellKey = `${cell.columnLabel}-${cell.rowLabel}`;
        if (selectedCells.has(cellKey)) {
          cellsToSave.push(cell);
        }
      });
    });
    
    console.log('💾 Saving', cellsToSave.length, 'selected cells');
    mutateFn(cellsToSave);
  }, [selectedCells, isSaving, gridData, mutateFn]);



  const columnStats = useMemo(() => {
    const stats: Record<string, { completed: number; total: number; percentage: number }> = {};
    
    (gridConfig.flexibleColumns || []).forEach(flexCol => {
      const completed = cellProgressData.filter(
        cell => cell.column === flexCol.column && cell.status === 'completed'
      ).length;
      
      stats[flexCol.column] = {
        completed,
        total: flexCol.rows,
        percentage: flexCol.rows > 0 ? (completed / flexCol.rows) * 100 : 0,
      };
    });
    
    return stats;
  }, [gridConfig.flexibleColumns, cellProgressData]);

  const totalCells = (gridConfig.flexibleColumns || []).reduce((sum, col) => sum + col.rows, 0);
  const completedCells = cellProgressData.filter(cell => cell.status === 'completed').length;
  const totalScopeValue = activityData?.scopeValue || (totalCells * (gridConfig.scopeValue || 1));
  const unverifiedTotalValue = completedCells * (gridConfig.scopeValue || 1);
  const qcTotalValue = activityData?.qcValue || 0;
  
  const unverifiedProgressPercentage = totalScopeValue > 0 ? (unverifiedTotalValue / totalScopeValue) * 100 : 0;
  const qcProgressPercentage = totalScopeValue > 0 ? (qcTotalValue / totalScopeValue) * 100 : 0;
  


  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4285F4" />
        <Text style={styles.loadingText}>Loading grid data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Grid3x3 size={20} color="#4285F4" strokeWidth={2} />
          <Text style={styles.headerTitle}>Grid Layout</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>PV Area:</Text>
          <Text style={styles.infoValue}>{gridConfig.pvAreaName || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Block:</Text>
          <Text style={styles.infoValue}>{gridConfig.blockAreaName || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Dimensions:</Text>
          <Text style={styles.infoValue}>
            {gridConfig.flexibleColumns?.map(col => `${col.column}(${col.rows})`).join(', ') || 'Not configured'}
          </Text>
        </View>
        {gridConfig.scopeValue && gridConfig.scopeUnit && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Global Scope:</Text>
            <Text style={styles.infoValue}>
              {gridConfig.scopeValue} {gridConfig.scopeUnit}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Grid Completion (Unverified)</Text>
          <Text style={styles.progressPercentage}>{unverifiedProgressPercentage.toFixed(1)}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(unverifiedProgressPercentage, 100)}%` }]} />
        </View>
        <Text style={styles.progressStats}>
          {unverifiedTotalValue.toFixed(1)} / {totalScopeValue.toFixed(1)} {gridConfig.scopeUnit || 'm'} (User Input)
        </Text>
      </View>

      <View style={styles.qcProgressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.qcProgressLabel}>QC Verified</Text>
          <Text style={styles.qcProgressPercentage}>{qcProgressPercentage.toFixed(1)}%</Text>
        </View>
        <View style={styles.qcProgressBar}>
          <View style={[styles.qcProgressFill, { width: `${Math.min(qcProgressPercentage, 100)}%` }]} />
        </View>
        <Text style={styles.qcProgressStats}>
          {qcTotalValue.toFixed(1)} / {totalScopeValue.toFixed(1)} {gridConfig.scopeUnit || 'm'} (QC Validated)
        </Text>
      </View>

      <View style={styles.legendSection}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#34A853' }]} />
          <Text style={styles.legendText}>Completed / Saved</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FBBC04', borderWidth: 3, borderColor: '#FBBC04' }]} />
          <Text style={styles.legendText}>Selected (Tap to toggle)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#e8eaed' }]} />
          <Text style={styles.legendText}>Pending (Tap to select)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#34A853', opacity: 0.7 }]} />
          <Lock size={10} color="#EA4335" strokeWidth={2} style={{ marginLeft: -14, marginRight: 2 }} />
          <Text style={styles.legendText}>Locked (after 12PM)</Text>
        </View>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={true}
        style={styles.gridScrollContainer}
        contentContainerStyle={styles.gridScrollContent}
      >
        <View style={styles.gridContainer}>
          <View style={styles.gridHeaderRow}>
            <View style={styles.cornerCell} />
            {gridData[0]?.map((cell, colIndex) => (
              <View key={`header-${colIndex}`} style={styles.headerCell}>
                <Text style={styles.headerCellText}>{cell.columnLabel}</Text>
              </View>
            ))}
          </View>

          {gridData.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.gridRow}>
              <View style={styles.rowHeaderCell}>
                <Text style={styles.rowHeaderCellText}>{row[0]?.rowLabel}</Text>
              </View>
              {row.map((cell, colIndex) => {
                const cellKey = `${cell.columnLabel}-${cell.rowLabel}`;
                const isCompleted = completedCellsSet.has(cellKey);
                const isLocked = lockedCellsSet.has(cellKey);
                const isSelected = selectedCells.has(cellKey);
                const displayStatus = isSelected || isCompleted ? 'completed' : cell.status;
                
                return (
                  <TouchableOpacity
                    key={`cell-${rowIndex}-${colIndex}`}
                    style={[
                      styles.gridCell,
                      { backgroundColor: getStatusColor(displayStatus) },
                      isSelected && !isCompleted && styles.selectedCell,
                      isCompleted && styles.completedCell,
                      isLocked && styles.lockedCell,
                    ]}
                    onPress={() => handleCellPress(cell)}
                    activeOpacity={0.7}
                    disabled={isCompleted || isLocked}
                  >
                    {isLocked ? <Lock size={12} color="#EA4335" strokeWidth={3} /> : getStatusIcon(displayStatus)}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {selectedCells.size > 0 && (
        <View style={styles.selectionPanel}>
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionTitle}>
              {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} selected
            </Text>
            <TouchableOpacity onPress={() => setSelectedCells(new Set())}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.columnBreakdown}>
            {Object.entries(columnStats).map(([column, stats]) => {
              const selectedInColumn = Array.from(selectedCells).filter(key => key.startsWith(`${column}-`)).length;
              if (selectedInColumn === 0) return null;
              
              return (
                <View key={column} style={styles.columnStatRow}>
                  <Text style={styles.columnStatLabel}>Column {column}:</Text>
                  <Text style={styles.columnStatValue}>
                    +{selectedInColumn} ({stats.completed + selectedInColumn}/{stats.total} = {((stats.completed + selectedInColumn) / stats.total * 100).toFixed(0)}%)
                  </Text>
                </View>
              );
            })}
          </View>
          
          <TouchableOpacity
            style={[styles.saveButton2, (isSaving || saveBatchMutation.isPending) && styles.saveButton2Disabled]}
            onPress={handleSaveProgress}
            disabled={isSaving || saveBatchMutation.isPending}
          >
            {(isSaving || saveBatchMutation.isPending) ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Save size={18} color="#fff" strokeWidth={2} />
                <Text style={styles.saveButton2Text}>Save {selectedCells.size} Cell{selectedCells.size !== 1 ? 's' : ''}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#5f6368',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#4285F4',
  },
  infoSection: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#202124',
  },
  progressSection: {
    backgroundColor: '#e8f0fe',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1967d2',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1967d2',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#d2e3fc',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1967d2',
    borderRadius: 3,
  },
  progressStats: {
    fontSize: 11,
    color: '#1967d2',
    textAlign: 'center',
  },
  legendSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 16,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#5f6368',
    fontWeight: '500' as const,
  },
  gridScrollContainer: {
    flex: 1,
  },
  gridScrollContent: {
    paddingBottom: 16,
  },
  gridContainer: {
    flexDirection: 'column',
  },
  gridHeaderRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  cornerCell: {
    width: 40,
    height: 32,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8eaed',
    marginRight: 2,
    borderRadius: 4,
  },
  headerCell: {
    width: 40,
    height: 32,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
    borderRadius: 4,
  },
  headerCellText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  rowHeaderCell: {
    width: 40,
    height: 40,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
    borderRadius: 4,
  },
  rowHeaderCellText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  gridCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  selectedCell: {
    borderWidth: 3,
    borderColor: '#FBBC04',
  },
  completedCell: {
    opacity: 0.7,
  },
  lockedCell: {
    opacity: 0.7,
    borderWidth: 2,
    borderColor: '#EA4335',
  },
  selectionPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 2,
    borderTopColor: '#FBBC04',
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#202124',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#EA4335',
  },
  columnBreakdown: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  columnStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  columnStatLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  columnStatValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#34A853',
  },
  saveButton2: {
    backgroundColor: '#4285F4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 8,
  },
  saveButton2Disabled: {
    backgroundColor: '#9aa0a6',
  },
  saveButton2Text: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  qcProgressSection: {
    backgroundColor: '#e6f4ea',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  qcProgressLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#137333',
  },
  qcProgressPercentage: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#137333',
  },
  qcProgressBar: {
    height: 6,
    backgroundColor: '#ceead6',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  qcProgressFill: {
    height: '100%',
    backgroundColor: '#34A853',
    borderRadius: 3,
  },
  qcProgressStats: {
    fontSize: 11,
    color: '#137333',
    textAlign: 'center',
  },
  qcInputSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#34A853',
  },
  qcRequestSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  qcRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qcRequestLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#202124',
  },
  qcRequestInfo: {
    fontSize: 12,
    color: '#34A853',
    marginTop: 8,
    fontStyle: 'italic' as const,
  },
  qcInputLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 12,
  },
  qcInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  qcInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#202124',
    backgroundColor: '#f8f9fa',
  },
  qcInputUnit: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  qcSaveButton: {
    backgroundColor: '#34A853',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  qcSaveButtonDisabled: {
    backgroundColor: '#9aa0a6',
  },
  qcSaveButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
