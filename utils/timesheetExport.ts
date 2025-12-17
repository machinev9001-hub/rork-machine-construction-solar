import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  collectionGroup
} from 'firebase/firestore';
import { db } from '@/config/firebase';
// Import for web export only as mobile file system is not available in current setup
import { Platform } from 'react-native';

interface ExportFilters {
  startDate: string;
  endDate: string;
  operatorId?: string;
  assetId?: string;
  masterAccountId: string;
  siteId?: string;
}

interface OperatorManHours {
  operatorId: string;
  operatorName: string;
  date: string;
  startTime: string;
  stopTime: string;
  lunchBreak: boolean;
  totalManHours: number;
  siteId?: string;
  siteName?: string;
  notes?: string;
  status?: string;
}

interface PlantAssetHours {
  assetId: string;
  assetType?: string;
  date: string;
  openHours: number;
  closeHours: number;
  totalHours: number;
  operatorId: string;
  operatorName: string;
  logBreakdown: {
    productive?: boolean;
    maintenance?: boolean;
    idle?: boolean;
    breakdown?: boolean;
    refueling?: boolean;
  };
  inclementWeather?: boolean;
  weatherNotes?: string;
  pvArea?: string;
  blockNumber?: string;
  notes?: string;
  fuelAmount?: number;
  fuelMeterReading?: number;
  fuelMeterType?: 'HOUR_METER' | 'ODOMETER';
  fuelConsumption?: number;
}

/**
 * Export operator man hours to CSV
 */
export async function exportOperatorManHours(filters: ExportFilters): Promise<string | null> {
  try {
    console.log('[TimesheetExport] Exporting operator man hours with filters:', filters);

    // Query operator timesheets
    const timesheetsRef = collection(db, 'operatorTimesheets');
    const constraints = [
      where('masterAccountId', '==', filters.masterAccountId),
      where('date', '>=', filters.startDate),
      where('date', '<=', filters.endDate),
      orderBy('date', 'desc'),
      orderBy('operatorName')
    ];

    if (filters.operatorId) {
      constraints.push(where('operatorId', '==', filters.operatorId));
    }
    
    if (filters.siteId) {
      constraints.push(where('siteId', '==', filters.siteId));
    }

    const timesheetsQuery = query(timesheetsRef, ...constraints);
    const snapshot = await getDocs(timesheetsQuery);

    const manHours: OperatorManHours[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      manHours.push({
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        date: data.date,
        startTime: data.startTime,
        stopTime: data.stopTime,
        lunchBreak: data.lunchBreak || false,
        totalManHours: data.totalManHours,
        siteId: data.siteId,
        siteName: data.siteName,
        notes: data.notes,
        status: data.status
      });
    });

    if (manHours.length === 0) {
      console.log('[TimesheetExport] No man hours data found');
      return null;
    }

    // Generate CSV
    const csvHeader = 'Date,Operator Name,Operator ID,Start Time,Stop Time,Lunch Break,Total Man Hours,Site,Status,Notes\n';
    const csvRows = manHours.map(row => {
      const fields = [
        row.date,
        `"${row.operatorName}"`,
        row.operatorId,
        row.startTime,
        row.stopTime,
        row.lunchBreak ? 'Yes' : 'No',
        row.totalManHours.toFixed(2),
        `"${row.siteName || ''}"`,
        row.status || 'DRAFT',
        `"${row.notes?.replace(/"/g, '""') || ''}"`
      ];
      return fields.join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;
    
    // Save and share file
    const fileName = `operator_man_hours_${filters.startDate}_to_${filters.endDate}.csv`;
    const filePath = await saveAndShareFile(csv, fileName);
    
    return filePath;
  } catch (error) {
    console.error('[TimesheetExport] Error exporting man hours:', error);
    throw error;
  }
}

/**
 * Export plant asset hours to CSV
 */
export async function exportPlantAssetHours(filters: ExportFilters): Promise<string | null> {
  try {
    console.log('[TimesheetExport] Exporting plant asset hours with filters:', filters);

    // Query plant asset timesheets using collection group
    const timesheetsRef = collectionGroup(db, 'timesheets');
    const constraints = [
      where('masterAccountId', '==', filters.masterAccountId),
      where('date', '>=', filters.startDate),
      where('date', '<=', filters.endDate),
      orderBy('date', 'desc')
    ];

    if (filters.assetId) {
      constraints.push(where('assetId', '==', filters.assetId));
    }
    
    if (filters.operatorId) {
      constraints.push(where('operatorId', '==', filters.operatorId));
    }

    const timesheetsQuery = query(timesheetsRef, ...constraints);
    const snapshot = await getDocs(timesheetsQuery);

    const plantHours: PlantAssetHours[] = [];
    const assetDateKeys = new Set<string>();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      assetDateKeys.add(`${data.assetId}-${data.date}`);
      plantHours.push({
        assetId: data.assetId,
        assetType: data.assetType,
        date: data.date,
        openHours: data.openHours,
        closeHours: data.closeHours,
        totalHours: data.totalHours,
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        logBreakdown: data.logBreakdown || {},
        inclementWeather: data.inclementWeather,
        weatherNotes: data.weatherNotes,
        pvArea: data.pvArea,
        blockNumber: data.blockNumber,
        notes: data.notes
      });
    });
    
    const fuelLogsMap = new Map<string, any>();
    if (assetDateKeys.size > 0) {
      const assetIds = [...new Set(plantHours.map(ph => ph.assetId))];
      if (assetIds.length > 0) {
        const fuelLogsRef = collection(db, 'fuelLogs');
        const fuelLogsQuery = query(
          fuelLogsRef,
          where('masterAccountId', '==', filters.masterAccountId),
          where('assetId', 'in', assetIds.slice(0, 10)),
          where('date', '>=', filters.startDate),
          where('date', '<=', filters.endDate)
        );
        const fuelSnapshot = await getDocs(fuelLogsQuery);
        
        fuelSnapshot.forEach(doc => {
          const data = doc.data();
          const key = `${data.assetId}-${data.date}`;
          if (!fuelLogsMap.has(key)) {
            fuelLogsMap.set(key, data);
          }
        });
      }
    }
    
    plantHours.forEach(ph => {
      const fuelLogKey = `${ph.assetId}-${ph.date}`;
      const fuelLog = fuelLogsMap.get(fuelLogKey);
      
      if (fuelLog) {
        ph.fuelAmount = fuelLog.fuelAmount;
        ph.fuelMeterReading = fuelLog.meterReading;
        ph.fuelMeterType = fuelLog.meterType;
        
        if (ph.totalHours > 0) {
          if (fuelLog.meterType === 'HOUR_METER') {
            ph.fuelConsumption = fuelLog.fuelAmount / ph.totalHours;
          } else {
            ph.fuelConsumption = fuelLog.fuelAmount / (fuelLog.meterReading || 1);
          }
        }
      }
    });

    if (plantHours.length === 0) {
      console.log('[TimesheetExport] No plant hours data found');
      return null;
    }

    // Generate CSV
    const csvHeader = 'Date,Asset ID,Opening Hours,Closing Hours,Total Hours,Operator Name,Productive,Maintenance,Idle,Breakdown,Refueling,Weather Impact,PV Area,Block,Fuel Amount (L),Meter Reading,Consumption (L/h or L/km),Notes\n';
    const csvRows = plantHours.map(row => {
      const fields = [
        row.date,
        row.assetId,
        row.openHours.toFixed(2),
        row.closeHours.toFixed(2),
        row.totalHours.toFixed(2),
        `"${row.operatorName}"`,
        row.logBreakdown.productive ? 'Yes' : 'No',
        row.logBreakdown.maintenance ? 'Yes' : 'No',
        row.logBreakdown.idle ? 'Yes' : 'No',
        row.logBreakdown.breakdown ? 'Yes' : 'No',
        row.logBreakdown.refueling ? 'Yes' : 'No',
        row.inclementWeather ? `"${row.weatherNotes || 'Yes'}"` : 'No',
        `"${row.pvArea || ''}"`,
        `"${row.blockNumber || ''}"`,
        row.fuelAmount ? row.fuelAmount.toFixed(1) : '-',
        row.fuelMeterReading ? `${row.fuelMeterReading.toFixed(0)}${row.fuelMeterType === 'HOUR_METER' ? 'h' : 'km'}` : '-',
        row.fuelConsumption ? row.fuelConsumption.toFixed(2) : '-',
        `"${row.notes?.replace(/"/g, '""') || ''}"`
      ];
      return fields.join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;
    
    // Save and share file
    const fileName = `plant_asset_hours_${filters.startDate}_to_${filters.endDate}.csv`;
    const filePath = await saveAndShareFile(csv, fileName);
    
    return filePath;
  } catch (error) {
    console.error('[TimesheetExport] Error exporting plant hours:', error);
    throw error;
  }
}

/**
 * Export combined timesheet summary
 */
export async function exportCombinedTimesheetSummary(filters: ExportFilters): Promise<string | null> {
  try {
    console.log('[TimesheetExport] Exporting combined timesheet summary');

    // Get both man hours and plant hours (exports are saved separately)
    await Promise.all([
      exportOperatorManHours(filters),
      exportPlantAssetHours(filters)
    ]);

    // Create a summary report
    const summaryData = await generateSummaryReport(filters);
    
    const summaryHeader = 'TIMESHEET SUMMARY REPORT\n';
    const dateRange = `Period: ${filters.startDate} to ${filters.endDate}\n\n`;
    
    let summaryContent = summaryHeader + dateRange;
    
    // Add operator summary
    summaryContent += 'OPERATOR MAN HOURS SUMMARY\n';
    summaryContent += '==========================\n';
    for (const [operatorName, hours] of Object.entries(summaryData.operatorSummary)) {
      summaryContent += `${operatorName}: ${hours} hours\n`;
    }
    
    summaryContent += '\n';
    
    // Add plant asset summary
    summaryContent += 'PLANT ASSET HOURS SUMMARY\n';
    summaryContent += '=========================\n';
    for (const [assetId, hours] of Object.entries(summaryData.assetSummary)) {
      summaryContent += `${assetId}: ${hours} hours\n`;
    }
    
    summaryContent += '\n';
    
    // Add totals
    summaryContent += 'TOTALS\n';
    summaryContent += '======\n';
    summaryContent += `Total Man Hours: ${summaryData.totalManHours} hours\n`;
    summaryContent += `Total Plant Hours: ${summaryData.totalPlantHours} hours\n`;
    summaryContent += `Number of Operators: ${summaryData.uniqueOperators}\n`;
    summaryContent += `Number of Assets: ${summaryData.uniqueAssets}\n`;
    
    const fileName = `timesheet_summary_${filters.startDate}_to_${filters.endDate}.txt`;
    const filePath = await saveAndShareFile(summaryContent, fileName);
    
    return filePath;
  } catch (error) {
    console.error('[TimesheetExport] Error exporting combined summary:', error);
    throw error;
  }
}

/**
 * Generate summary statistics for the report
 */
async function generateSummaryReport(filters: ExportFilters) {
  const operatorSummary: Record<string, number> = {};
  const assetSummary: Record<string, number> = {};
  let totalManHours = 0;
  let totalPlantHours = 0;
  const uniqueOperators = new Set<string>();
  const uniqueAssets = new Set<string>();

  // Get operator man hours
  const manHoursRef = collection(db, 'operatorTimesheets');
  const manHoursQuery = query(
    manHoursRef,
    where('masterAccountId', '==', filters.masterAccountId),
    where('date', '>=', filters.startDate),
    where('date', '<=', filters.endDate)
  );
  const manHoursSnapshot = await getDocs(manHoursQuery);
  
  manHoursSnapshot.forEach((doc) => {
    const data = doc.data();
    const operatorName = data.operatorName;
    const hours = data.totalManHours || 0;
    
    operatorSummary[operatorName] = (operatorSummary[operatorName] || 0) + hours;
    totalManHours += hours;
    uniqueOperators.add(data.operatorId);
  });

  // Get plant asset hours
  const plantHoursRef = collectionGroup(db, 'timesheets');
  const plantHoursQuery = query(
    plantHoursRef,
    where('masterAccountId', '==', filters.masterAccountId),
    where('date', '>=', filters.startDate),
    where('date', '<=', filters.endDate)
  );
  const plantHoursSnapshot = await getDocs(plantHoursQuery);
  
  plantHoursSnapshot.forEach((doc) => {
    const data = doc.data();
    const assetId = data.assetId;
    const hours = data.totalHours || 0;
    
    assetSummary[assetId] = (assetSummary[assetId] || 0) + hours;
    totalPlantHours += hours;
    uniqueAssets.add(assetId);
  });

  return {
    operatorSummary,
    assetSummary,
    totalManHours: totalManHours.toFixed(2),
    totalPlantHours: totalPlantHours.toFixed(2),
    uniqueOperators: uniqueOperators.size,
    uniqueAssets: uniqueAssets.size
  };
}

/**
 * Save file and share it
 */
async function saveAndShareFile(content: string, fileName: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      // For web, create a blob and download
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return fileName;
    } else {
      // For mobile, use web download approach for now
      // (Full mobile file sharing would require expo-file-system and expo-sharing)
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return fileName;
    }
  } catch (error) {
    console.error('[TimesheetExport] Error saving/sharing file:', error);
    throw error;
  }
}