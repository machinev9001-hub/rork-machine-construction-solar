import { Stack } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/utils/hooks/useTheme';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { FileDown, Printer, ChevronDown, ChevronUp } from 'lucide-react-native';
import { GridCellProgress } from '@/types';

type ActivityDetail = {
  activityId: string;
  activityName: string;
  type: string;
  status: 'Done' | 'In Progress' | 'Pending';
  progress: number;
  assignedTo: string;
};

type CellActivities = {
  pvArea: string;
  blockNumber: string;
  row: string;
  column: string;
  activities: ActivityDetail[];
  cellProgress: number;
};

type RowProgress = {
  rowLabel: string;
  completed: number;
  total: number;
  percentage: number;
  status: 'Complete' | 'In Progress' | 'Not Started';
};

type ColumnProgress = {
  columnLabel: string;
  completed: number;
  total: number;
  percentage: number;
  status: 'Complete' | 'In Progress' | 'Not Started';
};

type BlockProgress = {
  blockName: string;
  totalCells: number;
  completedCells: number;
  inProgressCells: number;
  notStartedCells: number;
  percentage: number;
};

export default function ProgressReportScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [selectedPVArea, setSelectedPVArea] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [selectedRow, setSelectedRow] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);
  
  const [expandedSections, setExpandedSections] = useState({
    cellActivities: true,
    visualGrid: true,
    rowProgress: true,
    columnProgress: true,
    blockProgress: true,
  });

  const { data: pvAreas = [] } = useQuery({
    queryKey: ['pvAreas', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      const pvAreasRef = collection(db, 'pvAreas');
      const q = query(pvAreasRef, where('siteId', '==', user.siteId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
      }));
    },
    enabled: !!user?.siteId,
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ['blocks', selectedPVArea, user?.siteId],
    queryFn: async () => {
      if (!selectedPVArea || !user?.siteId) return [];
      const blocksRef = collection(db, 'blockAreas');
      const q = query(
        blocksRef,
        where('siteId', '==', user.siteId),
        where('pvAreaId', '==', selectedPVArea)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        rowValues: doc.data().rowValues || [],
        columnValues: doc.data().columnValues || [],
      }));
    },
    enabled: !!selectedPVArea && !!user?.siteId,
  });

  const selectedBlockData = useMemo(() => {
    return blocks.find(b => b.id === selectedBlock);
  }, [blocks, selectedBlock]);

  const { data: gridCellProgressData = [], isLoading } = useQuery({
    queryKey: ['gridCellProgress', user?.siteId, selectedPVArea, selectedBlock],
    queryFn: async () => {
      if (!user?.siteId || !selectedPVArea || !selectedBlock) return [];
      
      const progressRef = collection(db, 'gridCellProgress');
      const q = query(
        progressRef,
        where('siteId', '==', user.siteId),
        where('pvAreaId', '==', selectedPVArea),
        where('blockAreaId', '==', selectedBlock)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as GridCellProgress[];
    },
    enabled: !!user?.siteId && !!selectedPVArea && !!selectedBlock,
  });

  useQuery({
    queryKey: ['activities', user?.siteId, selectedPVArea, selectedBlock],
    queryFn: async () => {
      if (!user?.siteId || !selectedPVArea || !selectedBlock) return [];
      
      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('siteId', '==', user.siteId),
        where('moduleConfig.gridConfig.pvAreaId', '==', selectedPVArea),
        where('moduleConfig.gridConfig.blockAreaId', '==', selectedBlock)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    },
    enabled: !!user?.siteId && !!selectedPVArea && !!selectedBlock,
  });

  const cellActivities = useMemo((): CellActivities | null => {
    if (!selectedRow || !selectedColumn || !selectedPVArea || !selectedBlock) return null;

    const pvAreaName = pvAreas.find(p => p.id === selectedPVArea)?.name || selectedPVArea;
    const blockName = blocks.find(b => b.id === selectedBlock)?.name || selectedBlock;

    const cellProgress = gridCellProgressData.filter(
      cell => cell.row === selectedRow && cell.column === selectedColumn
    );

    const activities: ActivityDetail[] = cellProgress.map(cell => ({
      activityId: cell.activityId,
      activityName: cell.activityName,
      type: cell.activityName.includes('Cable') ? 'Cabling' : 
            cell.activityName.includes('Termination') ? 'Termination' : 
            cell.activityName.includes('QC') ? 'QC' : 'Mechanical',
      status: cell.status === 'completed' ? 'Done' : 
              cell.status === 'in-progress' ? 'In Progress' : 'Pending',
      progress: cell.progressPercentage,
      assignedTo: cell.supervisorName,
    }));

    const totalProgress = activities.length > 0
      ? activities.reduce((sum, a) => sum + a.progress, 0) / activities.length
      : 0;

    return {
      pvArea: pvAreaName,
      blockNumber: blockName,
      row: selectedRow,
      column: selectedColumn,
      activities,
      cellProgress: totalProgress,
    };
  }, [selectedRow, selectedColumn, selectedPVArea, selectedBlock, gridCellProgressData, pvAreas, blocks]);

  const gridData = useMemo(() => {
    if (!selectedBlockData) return [];
    
    const rows = selectedBlockData.rowValues || [];
    const columns = selectedBlockData.columnValues || [];
    
    const grid: { row: string; column: string; percentage: number }[][] = [];
    
    rows.forEach((row: string) => {
      const rowData: { row: string; column: string; percentage: number }[] = [];
      columns.forEach((column: string) => {
        const cellProgress = gridCellProgressData.filter(
          cell => cell.row === row && cell.column === column
        );
        
        const totalCellActivities = cellProgress.length;
        const completedActivities = cellProgress.filter(c => c.status === 'completed').length;
        const percentage = totalCellActivities > 0 
          ? (completedActivities / totalCellActivities) * 100 
          : 0;
        
        rowData.push({ row, column, percentage });
      });
      grid.push(rowData);
    });
    
    return grid;
  }, [selectedBlockData, gridCellProgressData]);

  const rowProgress = useMemo((): RowProgress[] => {
    if (!selectedBlockData) return [];
    
    const rows = selectedBlockData.rowValues || [];
    const columns = selectedBlockData.columnValues || [];
    
    return rows.map((row: string) => {
      const totalCells = columns.length;
      const cellsInRow = gridCellProgressData.filter(cell => cell.row === row);
      const completedCells = cellsInRow.filter(c => c.status === 'completed').length;
      const percentage = totalCells > 0 ? (completedCells / totalCells) * 100 : 0;
      
      const status: 'Complete' | 'In Progress' | 'Not Started' = 
        percentage === 100 ? 'Complete' : 
        percentage > 0 ? 'In Progress' : 'Not Started';
      
      return {
        rowLabel: row,
        completed: completedCells,
        total: totalCells,
        percentage,
        status,
      };
    });
  }, [selectedBlockData, gridCellProgressData]);

  const columnProgress = useMemo((): ColumnProgress[] => {
    if (!selectedBlockData) return [];
    
    const rows = selectedBlockData.rowValues || [];
    const columns = selectedBlockData.columnValues || [];
    
    return columns.map((column: string) => {
      const totalCells = rows.length;
      const cellsInColumn = gridCellProgressData.filter(cell => cell.column === column);
      const completedCells = cellsInColumn.filter(c => c.status === 'completed').length;
      const percentage = totalCells > 0 ? (completedCells / totalCells) * 100 : 0;
      
      const status: 'Complete' | 'In Progress' | 'Not Started' = 
        percentage === 100 ? 'Complete' : 
        percentage > 0 ? 'In Progress' : 'Not Started';
      
      return {
        columnLabel: column,
        completed: completedCells,
        total: totalCells,
        percentage,
        status,
      };
    });
  }, [selectedBlockData, gridCellProgressData]);

  const blockProgress = useMemo((): BlockProgress | null => {
    if (!selectedBlockData) return null;
    
    const blockName = blocks.find(b => b.id === selectedBlock)?.name || selectedBlock;
    const rows = selectedBlockData.rowValues || [];
    const columns = selectedBlockData.columnValues || [];
    const totalCells = rows.length * columns.length;
    
    const completedCells = gridCellProgressData.filter(c => c.status === 'completed').length;
    const inProgressCells = gridCellProgressData.filter(c => c.status === 'in-progress').length;
    const notStartedCells = totalCells - completedCells - inProgressCells;
    
    const percentage = totalCells > 0 ? (completedCells / totalCells) * 100 : 0;
    
    return {
      blockName,
      totalCells,
      completedCells,
      inProgressCells,
      notStartedCells,
      percentage,
    };
  }, [selectedBlockData, selectedBlock, blocks, gridCellProgressData]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handlePrint = async () => {
    try {
      if (Platform.OS === 'web') {
        const htmlContent = generateHTMLReport();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          setTimeout(() => {
            printWindow.print();
          }, 250);
        }
      } else {
        const htmlContent = generateHTMLReport();
        const fileName = `progress_report_${Date.now()}.html`;
        
        const exportModule = await import('@/utils/exportData');
        const saveAndShareFile = (exportModule as any).default || (exportModule as any).saveAndShareFile;
        if (saveAndShareFile) {
          await saveAndShareFile(htmlContent, fileName, 'text/html');
        }
      }
    } catch (error) {
      console.error('Print failed:', error);
    }
  };

  const handleExportPDF = async () => {
    setIsPrinting(true);
    
    try {
      const htmlContent = generateHTMLReport();
      
      if (Platform.OS === 'web') {
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `progress_report_${Date.now()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const fileName = `progress_report_${Date.now()}.html`;
        const exportModule = await import('@/utils/exportData');
        const saveAndShareFile = (exportModule as any).default || (exportModule as any).saveAndShareFile;
        if (saveAndShareFile) {
          await saveAndShareFile(htmlContent, fileName, 'text/html');
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const generateHTMLReport = (): string => {
    const pvAreaName = pvAreas.find(p => p.id === selectedPVArea)?.name || '';
    const blockName = blocks.find(b => b.id === selectedBlock)?.name || '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Progress Report - ${pvAreaName} / ${blockName}</title>
        <style>
          @media print {
            body { margin: 0; }
            @page { margin: 1cm; }
          }
          body { font-family: Arial, sans-serif; padding: 20px; background: #fff; }
          h1 { color: #202124; border-bottom: 2px solid #4285F4; padding-bottom: 10px; }
          h2 { color: #000000; margin-top: 30px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #dadce0; padding: 12px; text-align: left; }
          th { background: #4285F4; color: #fff; font-weight: 600; }
          .progress-bar { width: 100%; height: 20px; background: #e8eaed; border-radius: 4px; overflow: hidden; }
          .progress-fill { height: 100%; background: #34A853; }
          .status-complete { color: #34A853; font-weight: 600; }
          .status-progress { color: #FBBC04; font-weight: 600; }
          .status-pending { color: #EA4335; font-weight: 600; }
          .grid { display: grid; gap: 2px; margin: 20px 0; }
          .grid-cell { width: 40px; height: 40px; border: 1px solid #dadce0; display: flex; align-items: center; justify-content: center; }
          .cell-complete { background: #34A853; color: #fff; }
          .cell-progress { background: #FBBC04; color: #fff; }
          .cell-pending { background: #EA4335; color: #fff; }
        </style>
      </head>
      <body>
        <h1>Progress Report</h1>
        <p><strong>Location:</strong> ${pvAreaName} / ${blockName}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        
        ${cellActivities ? `
          <h2>Activities at ${cellActivities.pvArea} / ${cellActivities.blockNumber} / ROW ${cellActivities.row} / COLUMN ${cellActivities.column}</h2>
          <table>
            <tr>
              <th>Activity</th>
              <th>Type</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Assigned To</th>
            </tr>
            ${cellActivities.activities.map(act => `
              <tr>
                <td>${act.activityName}</td>
                <td>${act.type}</td>
                <td class="status-${act.status === 'Done' ? 'complete' : act.status === 'In Progress' ? 'progress' : 'pending'}">${act.status}</td>
                <td>${act.progress}%</td>
                <td>${act.assignedTo}</td>
              </tr>
            `).join('')}
          </table>
          <p><strong>Cell Progress:</strong> ${cellActivities.cellProgress.toFixed(0)}% (${cellActivities.activities.filter(a => a.status === 'Done').length} / ${cellActivities.activities.length} activities)</p>
        ` : ''}
        
        ${blockProgress ? `
          <h2>Overall Block Progress</h2>
          <p><strong>${blockProgress.blockName}:</strong> ${blockProgress.percentage.toFixed(0)}% Complete</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${blockProgress.percentage}%"></div>
          </div>
          <ul>
            <li>Total Cells: ${blockProgress.totalCells} (${selectedBlockData?.rowValues.length || 0} rows × ${selectedBlockData?.columnValues.length || 0} columns)</li>
            <li>Completed: ${blockProgress.completedCells} cells</li>
            <li>In Progress: ${blockProgress.inProgressCells} cells</li>
            <li>Not Started: ${blockProgress.notStartedCells} cells</li>
          </ul>
        ` : ''}
        
        <h2>Row Progress</h2>
        <table>
          <tr>
            <th>Row</th>
            <th>Progress</th>
            <th>Status</th>
          </tr>
          ${rowProgress.map(row => `
            <tr>
              <td>Row ${row.rowLabel}</td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${row.percentage}%"></div>
                </div>
                ${row.completed}/${row.total} (${row.percentage.toFixed(0)}%)
              </td>
              <td class="status-${row.status === 'Complete' ? 'complete' : row.status === 'In Progress' ? 'progress' : 'pending'}">${row.status}</td>
            </tr>
          `).join('')}
        </table>
        
        <h2>Column Progress</h2>
        <table>
          <tr>
            <th>Column</th>
            <th>Progress</th>
            <th>Status</th>
          </tr>
          ${columnProgress.slice(0, 10).map(col => `
            <tr>
              <td>Column ${col.columnLabel}</td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${col.percentage}%"></div>
                </div>
                ${col.completed}/${col.total} (${col.percentage.toFixed(0)}%)
              </td>
              <td class="status-${col.status === 'Complete' ? 'complete' : col.status === 'In Progress' ? 'progress' : 'pending'}">${col.status}</td>
            </tr>
          `).join('')}
        </table>
        ${columnProgress.length > 10 ? `<p><em>... (${columnProgress.length - 10} more columns)</em></p>` : ''}
      </body>
      </html>
    `;
  };

  const getStatusColor = (status: string) => {
    if (status === 'Done' || status === 'Complete') return '#34A853';
    if (status === 'In Progress') return '#FBBC04';
    return '#EA4335';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'Done' || status === 'Complete') return '✓';
    if (status === 'In Progress') return '⚠';
    return '✕';
  };

  const getCellColor = (percentage: number): string => {
    if (percentage === 100) return '#34A853';
    if (percentage >= 1) return '#FBBC04';
    return '#EA4335';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Progress Report',
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '600' as const },
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.printButton}
                onPress={handlePrint}
                disabled={!selectedBlock}
              >
                <Printer size={16} color="#fff" strokeWidth={2} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleExportPDF}
                disabled={isPrinting || !selectedBlock}
              >
                {isPrinting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <FileDown size={16} color="#fff" strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.filtersSection, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.filterSectionTitle, { color: '#000' }]}>Report Filters</Text>
          
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: '#000' }]}>PV Area:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {pvAreas.map(area => (
                <TouchableOpacity
                  key={area.id}
                  style={[
                    styles.filterChip,
                    selectedPVArea === area.id && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setSelectedPVArea(area.id);
                    setSelectedBlock('');
                    setSelectedRow('');
                    setSelectedColumn('');
                  }}
                >
                  <Text style={[
                    styles.filterChipText,
                    { color: selectedPVArea === area.id ? '#fff' : '#000' },
                    selectedPVArea === area.id && styles.filterChipTextActive,
                  ]}>
                    {area.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {selectedPVArea && (
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: '#000' }]}>Block:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                {blocks.map(block => (
                  <TouchableOpacity
                    key={block.id}
                    style={[
                      styles.filterChip,
                      selectedBlock === block.id && styles.filterChipActive,
                    ]}
                    onPress={() => {
                      setSelectedBlock(block.id);
                      setSelectedRow('');
                      setSelectedColumn('');
                    }}
                  >
                    <Text style={[
                      styles.filterChipText,
                      { color: selectedBlock === block.id ? '#fff' : '#000' },
                      selectedBlock === block.id && styles.filterChipTextActive,
                    ]}>
                      {block.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {selectedBlock && selectedBlockData && (
            <>
              <View style={styles.filterRow}>
                <Text style={[styles.filterLabel, { color: '#000' }]}>Row:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {selectedBlockData.rowValues.map((row: string) => (
                    <TouchableOpacity
                      key={row}
                      style={[
                        styles.filterChip,
                        selectedRow === row && styles.filterChipActive,
                      ]}
                      onPress={() => setSelectedRow(row)}
                    >
                      <Text style={[
                        styles.filterChipText,
                        { color: selectedRow === row ? '#fff' : '#000' },
                        selectedRow === row && styles.filterChipTextActive,
                      ]}>
                        {row}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.filterRow}>
                <Text style={[styles.filterLabel, { color: '#000' }]}>Column:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {selectedBlockData.columnValues.map((column: string) => (
                    <TouchableOpacity
                      key={column}
                      style={[
                        styles.filterChip,
                        selectedColumn === column && styles.filterChipActive,
                      ]}
                      onPress={() => setSelectedColumn(column)}
                    >
                      <Text style={[
                        styles.filterChipText,
                        { color: selectedColumn === column ? '#fff' : '#000' },
                        selectedColumn === column && styles.filterChipTextActive,
                      ]}>
                        {column}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </>
          )}
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4285F4" />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading progress data...</Text>
          </View>
        )}

        {!isLoading && !selectedBlock && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Select PV Area and Block to view report</Text>
          </View>
        )}

        {!isLoading && selectedBlock && (
          <>
            {cellActivities && (
              <View style={[styles.section, { backgroundColor: theme.cardBg }]}>
                <TouchableOpacity 
                  style={styles.sectionHeader}
                  onPress={() => toggleSection('cellActivities')}
                >
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Activities at {cellActivities.pvArea} / {cellActivities.blockNumber} / ROW {cellActivities.row} / COLUMN {cellActivities.column}
                  </Text>
                  {expandedSections.cellActivities ? (
                    <ChevronUp size={20} color={theme.textSecondary} />
                  ) : (
                    <ChevronDown size={20} color={theme.textSecondary} />
                  )}
                </TouchableOpacity>

                {expandedSections.cellActivities && (
                  <View style={styles.sectionContent}>
                    <View style={styles.table}>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Activity</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Type</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Progress</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Assigned To</Text>
                      </View>
                      
                      {cellActivities.activities.map((activity, index) => (
                        <View key={index} style={styles.tableRow}>
                          <Text style={[styles.tableCell, { flex: 2, color: theme.text }]}>{activity.activityName}</Text>
                          <Text style={[styles.tableCell, { flex: 1, color: theme.text }]}>{activity.type}</Text>
                          <View style={[styles.tableCell, { flex: 1 }]}>
                            <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(activity.status) }]}>
                              {getStatusIcon(activity.status)} {activity.status}
                            </Text>
                          </View>
                          <Text style={[styles.tableCell, { flex: 1, color: theme.text }]}>{activity.progress}%</Text>
                          <Text style={[styles.tableCell, { flex: 1.5, color: theme.text }]}>{activity.assignedTo}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.cellProgressSummary}>
                      <Text style={[styles.summaryText, { color: theme.text }]}>
                        Cell Progress: {cellActivities.cellProgress.toFixed(0)}% ({cellActivities.activities.filter(a => a.status === 'Done').length} / {cellActivities.activities.length} activities = {((cellActivities.activities.filter(a => a.status === 'Done').length / cellActivities.activities.length) * 100).toFixed(0)}%)
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {blockProgress && (
              <>
                <View style={[styles.section, { backgroundColor: theme.cardBg }]}>
                  <TouchableOpacity 
                    style={styles.sectionHeader}
                    onPress={() => toggleSection('visualGrid')}
                  >
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Visual Progress Grid</Text>
                    {expandedSections.visualGrid ? (
                      <ChevronUp size={20} color={theme.textSecondary} />
                    ) : (
                      <ChevronDown size={20} color={theme.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {expandedSections.visualGrid && (
                    <View style={styles.sectionContent}>
                      <Text style={[styles.subsectionTitle, { fontWeight: '700' as const, color: theme.text }]}>
                        Block: {blockProgress.blockName} in PV Area: {pvAreas.find(p => p.id === selectedPVArea)?.name}
                      </Text>

                      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                          <View style={styles.gridHeaderRow}>
                            <View style={styles.gridCornerCell} />
                            {selectedBlockData?.columnValues.map((col: string) => (
                              <View key={col} style={styles.gridHeaderCell}>
                                <Text style={styles.gridHeaderText}>{col}</Text>
                              </View>
                            ))}
                          </View>

                          {gridData.map((row, rowIndex) => (
                            <View key={rowIndex} style={styles.gridRow}>
                              <View style={styles.gridRowHeader}>
                                <Text style={styles.gridRowHeaderText}>{row[0]?.row}</Text>
                              </View>
                              {row.map((cell, colIndex) => (
                                <View
                                  key={colIndex}
                                  style={[
                                    styles.gridCell,
                                    { backgroundColor: getCellColor(cell.percentage) }
                                  ]}
                                >
                                  <Text style={styles.gridCellText}>{Math.round(cell.percentage)}%</Text>
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                      </ScrollView>

                      <View style={styles.legend}>
                        <Text style={[styles.legendTitle, { color: theme.text }]}>Color Legend:</Text>
                        <View style={styles.legendItems}>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#34A853' }]} />
                            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Green (100%): Cell is complete</Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#FBBC04' }]} />
                            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Yellow (1-99%): Cell is in progress</Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#EA4335' }]} />
                            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Red (0%): Cell not started</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                <View style={[styles.section, { backgroundColor: theme.cardBg }]}>
                  <TouchableOpacity 
                    style={styles.sectionHeader}
                    onPress={() => toggleSection('rowProgress')}
                  >
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>By Row</Text>
                    {expandedSections.rowProgress ? (
                      <ChevronUp size={20} color={theme.textSecondary} />
                    ) : (
                      <ChevronDown size={20} color={theme.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {expandedSections.rowProgress && (
                    <View style={styles.sectionContent}>
                      {rowProgress.map(row => (
                        <View key={row.rowLabel} style={styles.progressRow}>
                          <View style={styles.progressRowHeader}>
                            <Text style={[styles.progressRowLabel, { color: theme.text }]}>Row {row.rowLabel}:</Text>
                            <Text style={[styles.progressRowPercentage, { color: '#4285F4' }]}>{row.percentage.toFixed(0)}%</Text>
                            <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(row.status), marginLeft: 8 }]}>
                              {getStatusIcon(row.status)} {row.status}
                            </Text>
                          </View>
                          <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${row.percentage}%`, backgroundColor: getStatusColor(row.status) }]} />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={[styles.section, { backgroundColor: theme.cardBg }]}>
                  <TouchableOpacity 
                    style={styles.sectionHeader}
                    onPress={() => toggleSection('columnProgress')}
                  >
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>By Column</Text>
                    {expandedSections.columnProgress ? (
                      <ChevronUp size={20} color={theme.textSecondary} />
                    ) : (
                      <ChevronDown size={20} color={theme.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {expandedSections.columnProgress && (
                    <View style={styles.sectionContent}>
                      {columnProgress.slice(0, 10).map(col => (
                        <View key={col.columnLabel} style={styles.progressRow}>
                          <View style={styles.progressRowHeader}>
                            <Text style={[styles.progressRowLabel, { color: theme.text }]}>Col {col.columnLabel}:</Text>
                            <Text style={[styles.progressRowPercentage, { color: '#4285F4' }]}>{col.percentage.toFixed(0)}%</Text>
                            <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(col.status), marginLeft: 8 }]}>
                              {getStatusIcon(col.status)} {col.status}
                            </Text>
                          </View>
                          <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${col.percentage}%`, backgroundColor: getStatusColor(col.status) }]} />
                          </View>
                        </View>
                      ))}
                      {columnProgress.length > 10 && (
                        <Text style={[styles.moreText, { color: theme.textSecondary }]}>... ({columnProgress.length - 10} more columns)</Text>
                      )}
                    </View>
                  )}
                </View>

                <View style={[styles.section, { backgroundColor: theme.cardBg }]}>
                  <TouchableOpacity 
                    style={styles.sectionHeader}
                    onPress={() => toggleSection('blockProgress')}
                  >
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Overall Block Progress</Text>
                    {expandedSections.blockProgress ? (
                      <ChevronUp size={20} color={theme.textSecondary} />
                    ) : (
                      <ChevronDown size={20} color={theme.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {expandedSections.blockProgress && (
                    <View style={styles.sectionContent}>
                      <View style={styles.overallProgress}>
                        <Text style={[styles.overallProgressLabel, { color: theme.text }]}>{blockProgress.blockName}:</Text>
                        <Text style={[styles.overallProgressValue, { color: '#4285F4' }]}>{blockProgress.percentage.toFixed(0)}% In Progress</Text>
                      </View>

                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${blockProgress.percentage}%` }]} />
                      </View>

                      <View style={styles.blockStats}>
                        <Text style={[styles.blockStat, { color: theme.textSecondary }]}>
                          - Total Cells: {blockProgress.totalCells} ({selectedBlockData?.rowValues.length || 0} rows × {selectedBlockData?.columnValues.length || 0} columns)
                        </Text>
                        <Text style={[styles.blockStat, { color: theme.textSecondary }]}>- Completed: {blockProgress.completedCells} cells</Text>
                        <Text style={[styles.blockStat, { color: theme.textSecondary }]}>- In Progress: {blockProgress.inProgressCells} cells</Text>
                        <Text style={[styles.blockStat, { color: theme.textSecondary }]}>- Not Started: {blockProgress.notStartedCells} cells</Text>
                      </View>
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  printButton: {
    width: 36,
    height: 36,
    backgroundColor: '#34A853',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButton: {
    width: 36,
    height: 36,
    backgroundColor: '#4285F4',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  filtersSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 16,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 10,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#dadce0',
  },
  filterChipActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  section: {
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    flex: 1,
  },
  sectionContent: {
    padding: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 16,
  },
  table: {
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4285F4',
    padding: 12,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
    textTransform: 'uppercase' as const,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 12,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cellProgressSummary: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  gridCornerCell: {
    width: 40,
    height: 32,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    marginRight: 2,
    borderRadius: 4,
  },
  gridHeaderCell: {
    width: 50,
    height: 32,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
    borderRadius: 4,
  },
  gridHeaderText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  gridRowHeader: {
    width: 40,
    height: 40,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
    borderRadius: 4,
  },
  gridRowHeaderText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  gridCell: {
    width: 50,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
    borderRadius: 4,
  },
  gridCellText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#fff',
  },
  legend: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  legendItems: {
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  progressRow: {
    marginBottom: 16,
  },
  progressRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressRowLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
  },
  progressRowPercentage: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  progressBar: {
    height: 24,
    backgroundColor: '#e8eaed',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34A853',
  },
  moreText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  overallProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overallProgressLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  overallProgressValue: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  blockStats: {
    marginTop: 16,
    gap: 8,
  },
  blockStat: {
    fontSize: 13,
    lineHeight: 20,
  },
});
