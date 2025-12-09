import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPORT_LOG_KEY = '@accounts_export_log';
const MAX_LOG_ENTRIES = 100;

export type ExportLogEntry = {
  id: string;
  type: string;
  format: string;
  groupBy?: string;
  timestamp: string;
  userId: string;
  userName: string;
  filters: Record<string, unknown>;
  recordCount?: number;
  fileSize?: number;
  success: boolean;
  error?: string;
  isServerJob?: boolean;
  jobId?: string;
};

export async function logExport(entry: Omit<ExportLogEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    const logs = await getExportLogs();
    
    const newEntry: ExportLogEntry = {
      ...entry,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    logs.unshift(newEntry);

    if (logs.length > MAX_LOG_ENTRIES) {
      logs.splice(MAX_LOG_ENTRIES);
    }

    await AsyncStorage.setItem(EXPORT_LOG_KEY, JSON.stringify(logs));
    
    console.log('[ExportLog] Logged export:', newEntry.id, newEntry.type);
  } catch (error) {
    console.error('[ExportLog] Failed to log export:', error);
  }
}

export async function getExportLogs(): Promise<ExportLogEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(EXPORT_LOG_KEY);
    
    if (!stored) {
      return [];
    }

    return JSON.parse(stored);
  } catch (error) {
    console.error('[ExportLog] Failed to get export logs:', error);
    return [];
  }
}

export async function clearExportLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EXPORT_LOG_KEY);
    console.log('[ExportLog] Cleared all export logs');
  } catch (error) {
    console.error('[ExportLog] Failed to clear export logs:', error);
  }
}

export async function getExportLogsByDateRange(
  fromDate: Date,
  toDate: Date
): Promise<ExportLogEntry[]> {
  try {
    const logs = await getExportLogs();
    
    return logs.filter((log) => {
      const logDate = new Date(log.timestamp);
      return logDate >= fromDate && logDate <= toDate;
    });
  } catch (error) {
    console.error('[ExportLog] Failed to filter logs by date range:', error);
    return [];
  }
}

export async function getExportLogsByUser(userId: string): Promise<ExportLogEntry[]> {
  try {
    const logs = await getExportLogs();
    
    return logs.filter((log) => log.userId === userId);
  } catch (error) {
    console.error('[ExportLog] Failed to filter logs by user:', error);
    return [];
  }
}
