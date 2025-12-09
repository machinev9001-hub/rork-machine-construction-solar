import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

type ExportFormat = 'CSV' | 'JSON';

function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

function convertToCSV(data: any[], headers: string[]): string {
  const headerRow = headers.map(h => escapeCSVValue(h)).join(',');
  
  const dataRows = data.map(row => {
    return headers.map(header => escapeCSVValue(row[header])).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

export async function exportActivitiesData(siteId: string, format: ExportFormat = 'CSV') {
  console.log('📊 Exporting activities data for site:', siteId);
  
  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(activitiesRef, where('siteId', '==', siteId));
    const snapshot = await getDocs(q);
    
    const data = snapshot.docs.map(doc => {
      const activity = doc.data();
      return {
        Activity_ID: doc.id,
        Activity_Name: activity.name || '',
        Status: activity.status || '',
        Scope_Value: activity.scopeValue?.value || 0,
        Scope_Unit: activity.scopeValue?.unit || '',
        Cumulative_Progress: activity.cumulativeProgress || 0,
        Progress_Percentage: activity.progressPercentage || 0,
        QC_Value: activity.qc?.value || 0,
        QC_Unit: activity.qc?.unit || '',
        QC_Status: activity.qc?.status || 'not_requested',
        Supervisor_ID: activity.supervisorInputBy || '',
        Created_At: activity.createdAt?.toDate?.()?.toISOString() || '',
        Updated_At: activity.updatedAt?.toDate?.()?.toISOString() || '',
      };
    });
    
    const headers = [
      'Activity_ID',
      'Activity_Name',
      'Status',
      'Scope_Value',
      'Scope_Unit',
      'Cumulative_Progress',
      'Progress_Percentage',
      'QC_Value',
      'QC_Unit',
      'QC_Status',
      'Supervisor_ID',
      'Created_At',
      'Updated_At',
    ];
    
    if (format === 'CSV') {
      const csvContent = convertToCSV(data, headers);
      return await saveAndShareFile(csvContent, `activities_export_${Date.now()}.csv`, 'text/csv');
    } else {
      const jsonContent = JSON.stringify(data, null, 2);
      return await saveAndShareFile(jsonContent, `activities_export_${Date.now()}.json`, 'application/json');
    }
  } catch (error) {
    console.error('Error exporting activities:', error);
    throw error;
  }
}

export async function exportBOQData(siteId: string, format: ExportFormat = 'CSV') {
  console.log('📊 Exporting BOQ data for site:', siteId);
  
  try {
    const boqRef = collection(db, 'boq');
    const q = query(boqRef, where('siteId', '==', siteId));
    const snapshot = await getDocs(q);
    
    const data = snapshot.docs.map(doc => {
      const boq = doc.data();
      return {
        BOQ_ID: doc.id,
        Site_ID: boq.siteId || '',
        Activity_Name: boq.activityName || '',
        Target_Quantity: boq.quantity || 0,
        Unit: boq.unit || '',
        Description: boq.description || '',
        Created_At: boq.createdAt?.toDate?.()?.toISOString() || '',
        Updated_At: boq.updatedAt?.toDate?.()?.toISOString() || '',
      };
    });
    
    const headers = [
      'BOQ_ID',
      'Site_ID',
      'Activity_Name',
      'Target_Quantity',
      'Unit',
      'Description',
      'Created_At',
      'Updated_At',
    ];
    
    if (format === 'CSV') {
      const csvContent = convertToCSV(data, headers);
      return await saveAndShareFile(csvContent, `boq_export_${Date.now()}.csv`, 'text/csv');
    } else {
      const jsonContent = JSON.stringify(data, null, 2);
      return await saveAndShareFile(jsonContent, `boq_export_${Date.now()}.json`, 'application/json');
    }
  } catch (error) {
    console.error('Error exporting BOQ:', error);
    throw error;
  }
}

export async function exportProgressReport(
  siteId: string,
  startDate?: Date,
  endDate?: Date,
  format: ExportFormat = 'CSV'
) {
  console.log('📊 Exporting progress report for site:', siteId);
  
  try {
    const activitiesRef = collection(db, 'activities');
    let q = query(activitiesRef, where('siteId', '==', siteId));
    
    if (startDate || endDate) {
      console.log('📅 Date filter applied:', { startDate, endDate });
    }
    
    const snapshot = await getDocs(q);
    
    const boqRef = collection(db, 'boq');
    const boqQuery = query(boqRef, where('siteId', '==', siteId));
    const boqSnapshot = await getDocs(boqQuery);
    
    const boqMap = new Map();
    boqSnapshot.docs.forEach(doc => {
      const data = doc.data();
      boqMap.set(data.activityName, {
        targetQuantity: data.quantity,
        unit: data.unit,
      });
    });
    
    const usersRef = collection(db, 'users');
    const usersQuery = query(usersRef, where('siteId', '==', siteId));
    const usersSnapshot = await getDocs(usersQuery);
    
    const usersMap = new Map();
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      usersMap.set(doc.id, data.name || 'Unknown');
    });
    
    const data = snapshot.docs.map(doc => {
      const activity = doc.data();
      const activityName = activity.name || '';
      const boqData = boqMap.get(activityName);
      
      const qcValue = activity.qc?.value || 0;
      const targetQuantity = boqData?.targetQuantity || 0;
      const progressPercent = targetQuantity > 0 ? ((qcValue / targetQuantity) * 100).toFixed(2) : '0.00';
      
      return {
        Activity_Name: activityName,
        Supervisor: usersMap.get(activity.supervisorInputBy) || 'Unassigned',
        Scope_Allocated: activity.scopeValue?.value || 0,
        Scope_Unit: activity.scopeValue?.unit || '',
        Completed_Today: activity.supervisorInputValue || 0,
        Cumulative_Progress: activity.cumulativeProgress || 0,
        QC_Approved_Value: qcValue,
        QC_Unit: activity.qc?.unit || '',
        BOQ_Target: targetQuantity,
        Progress_Percent: progressPercent,
        Status: activity.status || '',
        QC_Status: activity.qc?.status || 'not_requested',
        Last_Updated: activity.updatedAt?.toDate?.()?.toISOString() || '',
      };
    });
    
    const headers = [
      'Activity_Name',
      'Supervisor',
      'Scope_Allocated',
      'Scope_Unit',
      'Completed_Today',
      'Cumulative_Progress',
      'QC_Approved_Value',
      'QC_Unit',
      'BOQ_Target',
      'Progress_Percent',
      'Status',
      'QC_Status',
      'Last_Updated',
    ];
    
    if (format === 'CSV') {
      const csvContent = convertToCSV(data, headers);
      return await saveAndShareFile(csvContent, `progress_report_${Date.now()}.csv`, 'text/csv');
    } else {
      const jsonContent = JSON.stringify(data, null, 2);
      return await saveAndShareFile(jsonContent, `progress_report_${Date.now()}.json`, 'application/json');
    }
  } catch (error) {
    console.error('Error exporting progress report:', error);
    throw error;
  }
}

export async function exportSupervisorPerformance(siteId: string, format: ExportFormat = 'CSV') {
  console.log('📊 Exporting supervisor performance for site:', siteId);
  
  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(activitiesRef, where('siteId', '==', siteId));
    const snapshot = await getDocs(q);
    
    const usersRef = collection(db, 'users');
    const usersQuery = query(usersRef, where('siteId', '==', siteId));
    const usersSnapshot = await getDocs(usersQuery);
    
    const usersMap = new Map();
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      usersMap.set(doc.id, {
        name: data.name || 'Unknown',
        role: data.role || '',
      });
    });
    
    const supervisorStats = new Map<string, {
      name: string;
      totalActivities: number;
      totalScope: number;
      totalCompleted: number;
      totalQCApproved: number;
      openActivities: number;
      completedActivities: number;
    }>();
    
    snapshot.docs.forEach(doc => {
      const activity = doc.data();
      const supId = activity.supervisorInputBy || 'unassigned';
      
      if (supId === 'unassigned') return;
      
      if (!supervisorStats.has(supId)) {
        supervisorStats.set(supId, {
          name: usersMap.get(supId)?.name || 'Unknown',
          totalActivities: 0,
          totalScope: 0,
          totalCompleted: 0,
          totalQCApproved: 0,
          openActivities: 0,
          completedActivities: 0,
        });
      }
      
      const stats = supervisorStats.get(supId)!;
      stats.totalActivities += 1;
      stats.totalScope += activity.scopeValue?.value || 0;
      stats.totalCompleted += activity.cumulativeProgress || 0;
      stats.totalQCApproved += activity.qc?.value || 0;
      
      if (activity.status === 'OPEN') {
        stats.openActivities += 1;
      } else if (activity.status === 'DONE') {
        stats.completedActivities += 1;
      }
    });
    
    const data: any[] = [];
    supervisorStats.forEach((stats, supId) => {
      const performancePercent = stats.totalScope > 0 
        ? ((stats.totalQCApproved / stats.totalScope) * 100).toFixed(2) 
        : '0.00';
      
      data.push({
        Supervisor_ID: supId,
        Supervisor_Name: stats.name,
        Total_Activities: stats.totalActivities,
        Open_Activities: stats.openActivities,
        Completed_Activities: stats.completedActivities,
        Total_Scope_Allocated: stats.totalScope.toFixed(2),
        Total_Progress: stats.totalCompleted.toFixed(2),
        Total_QC_Approved: stats.totalQCApproved.toFixed(2),
        Performance_Percent: performancePercent,
      });
    });
    
    const headers = [
      'Supervisor_ID',
      'Supervisor_Name',
      'Total_Activities',
      'Open_Activities',
      'Completed_Activities',
      'Total_Scope_Allocated',
      'Total_Progress',
      'Total_QC_Approved',
      'Performance_Percent',
    ];
    
    if (format === 'CSV') {
      const csvContent = convertToCSV(data, headers);
      return await saveAndShareFile(csvContent, `supervisor_performance_${Date.now()}.csv`, 'text/csv');
    } else {
      const jsonContent = JSON.stringify(data, null, 2);
      return await saveAndShareFile(jsonContent, `supervisor_performance_${Date.now()}.json`, 'application/json');
    }
  } catch (error) {
    console.error('Error exporting supervisor performance:', error);
    throw error;
  }
}

export async function exportDailyLogs(
  siteId: string,
  startDate: Date,
  endDate: Date,
  format: ExportFormat = 'CSV'
) {
  console.log('📊 Exporting daily logs for site:', siteId);
  console.log('📅 Date range:', { startDate, endDate });
  
  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(activitiesRef, where('siteId', '==', siteId));
    const snapshot = await getDocs(q);
    
    const usersRef = collection(db, 'users');
    const usersQuery = query(usersRef, where('siteId', '==', siteId));
    const usersSnapshot = await getDocs(usersQuery);
    
    const usersMap = new Map();
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      usersMap.set(doc.id, data.name || 'Unknown');
    });
    
    const data: any[] = [];
    
    snapshot.docs.forEach(doc => {
      const activity = doc.data();
      
      const updatedAt = activity.updatedAt?.toDate?.();
      if (updatedAt && updatedAt >= startDate && updatedAt <= endDate) {
        data.push({
          Date: updatedAt.toISOString().split('T')[0],
          Activity_Name: activity.name || '',
          Supervisor: usersMap.get(activity.supervisorInputBy) || 'Unassigned',
          Completed_Today: activity.supervisorInputValue || 0,
          Unit: activity.supervisorInputUnit || '',
          Scope_Allocated: activity.scopeValue?.value || 0,
          QC_Value: activity.qc?.value || 0,
          Progress_Percent: activity.progressPercentage || 0,
          Status: activity.status || '',
          Notes: activity.note || '',
        });
      }
    });
    
    data.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
    
    const headers = [
      'Date',
      'Activity_Name',
      'Supervisor',
      'Completed_Today',
      'Unit',
      'Scope_Allocated',
      'QC_Value',
      'Progress_Percent',
      'Status',
      'Notes',
    ];
    
    if (format === 'CSV') {
      const csvContent = convertToCSV(data, headers);
      return await saveAndShareFile(csvContent, `daily_logs_${Date.now()}.csv`, 'text/csv');
    } else {
      const jsonContent = JSON.stringify(data, null, 2);
      return await saveAndShareFile(jsonContent, `daily_logs_${Date.now()}.json`, 'application/json');
    }
  } catch (error) {
    console.error('Error exporting daily logs:', error);
    throw error;
  }
}

export async function exportPVBlockActivityData(
  siteId: string,
  startDate?: Date,
  endDate?: Date,
  format: ExportFormat = 'CSV'
) {
  console.log('📊 Exporting PV-Block activity data for site:', siteId);
  console.log('📅 Date range:', { startDate, endDate });
  
  try {
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('siteId', '==', siteId));
    const tasksSnapshot = await getDocs(tasksQuery);
    
    const taskMap = new Map<string, { pvArea: string; blockNumber: string; taskName: string }>();
    tasksSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const taskName = data.name || data.pvArea || data.blockArea || '';
      const parts = taskName.split(' - ');
      const pvArea = parts[0] || 'Unknown';
      const blockNumber = parts[1] || 'Unknown';
      
      taskMap.set(doc.id, {
        pvArea,
        blockNumber,
        taskName,
      });
    });
    
    console.log('📋 Found', taskMap.size, 'tasks (PV-Blocks)');
    
    const activitiesRef = collection(db, 'activities');
    const activitiesQuery = query(activitiesRef, where('siteId', '==', siteId));
    const activitiesSnapshot = await getDocs(activitiesQuery);
    
    console.log('📊 Found', activitiesSnapshot.docs.length, 'activities');
    
    const data: any[] = [];
    
    activitiesSnapshot.docs.forEach(doc => {
      const activity = doc.data();
      const taskId = activity.taskId;
      const taskInfo = taskMap.get(taskId);
      
      if (!taskInfo) return;
      
      const activityName = activity.name || 'Unknown Activity';
      const subMenuKey = activity.subMenuKey || '';
      const subMenuName = subMenuKey.split('-').map((word: string) => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      const supervisorId = activity.supervisorInputBy || '';
      const scopeValue = typeof activity.scopeValue === 'number'
        ? activity.scopeValue
        : (activity.scopeValue?.value || 0);
      const unit = activity.supervisorInputUnit || 
        (typeof activity.scopeValue === 'object' ? activity.scopeValue?.unit : '') || 'm';
      const qcValue = activity.qcValue || activity.qc?.value || 0;
      const qcStatus = activity.qc?.status || 'not_requested';
      const cumulativeProgress = activity.cumulativeProgress || 0;
      const progressPercent = scopeValue > 0 
        ? ((qcValue / scopeValue) * 100).toFixed(2) 
        : '0.00';
      
      const completedToday = activity.supervisorInputValue || 0;
      const completedTodayDate = activity.supervisorInputAt?.toDate?.();
      const updatedAt = activity.updatedAt?.toDate?.();
      
      const dateToUse = completedTodayDate || updatedAt || new Date();
      
      if (startDate && dateToUse < startDate) return;
      if (endDate && dateToUse > endDate) return;
      
      data.push({
        PV_Area: taskInfo.pvArea,
        Block_Number: taskInfo.blockNumber,
        Activity_Category: subMenuName,
        Activity_Name: activityName,
        Date: dateToUse.toISOString().split('T')[0],
        Completed_Today: completedToday,
        Unit: unit,
        Cumulative_Progress: cumulativeProgress,
        QC_Approved: qcValue,
        Scope_Allocated: scopeValue,
        Progress_Percent: progressPercent,
        QC_Status: qcStatus,
        Supervisor_ID: supervisorId,
        Last_Updated: dateToUse.toISOString(),
      });
    });
    
    data.sort((a, b) => {
      const pvCompare = a.PV_Area.localeCompare(b.PV_Area);
      if (pvCompare !== 0) return pvCompare;
      
      const blockCompare = a.Block_Number.localeCompare(b.Block_Number);
      if (blockCompare !== 0) return blockCompare;
      
      return new Date(b.Date).getTime() - new Date(a.Date).getTime();
    });
    
    console.log('📊 Exporting', data.length, 'activity records');
    
    const headers = [
      'PV_Area',
      'Block_Number',
      'Activity_Category',
      'Activity_Name',
      'Date',
      'Completed_Today',
      'Unit',
      'Cumulative_Progress',
      'QC_Approved',
      'Scope_Allocated',
      'Progress_Percent',
      'QC_Status',
      'Supervisor_ID',
      'Last_Updated',
    ];
    
    if (format === 'CSV') {
      const csvContent = convertToCSV(data, headers);
      return await saveAndShareFile(csvContent, `pv_block_activities_${Date.now()}.csv`, 'text/csv');
    } else {
      const jsonContent = JSON.stringify(data, null, 2);
      return await saveAndShareFile(jsonContent, `pv_block_activities_${Date.now()}.json`, 'application/json');
    }
  } catch (error) {
    console.error('Error exporting PV-Block activity data:', error);
    throw error;
  }
}

async function saveAndShareFile(content: string, fileName: string, mimeType: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      link.remove();
      URL.revokeObjectURL(url);
      
      console.log('✅ File downloaded on web:', fileName);
      return true;
    } else {
      if (!FileSystem.cacheDirectory) {
        throw new Error('Cache directory not available on this platform');
      }
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, content);
      
      console.log('✅ File saved:', fileUri);
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: 'Export Data',
          UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.json',
        });
        console.log('✅ File shared successfully');
      } else {
        console.warn('⚠️ Sharing not available on this device');
      }
      
      return true;
    }
  } catch (error) {
    console.error('❌ Error saving/sharing file:', error);
    throw error;
  }
}
