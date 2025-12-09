import type { ActivityStatus } from '@/types';

export type ActivityForCalculation = {
  status: ActivityStatus;
  scopeValue: number;
  scopeApproved: boolean;
  qcValue: number;
  cablingHandoff?: any;
  terminationHandoff?: any;
};

export function calculatePercentage(qc: number, scope: number, scopeApproved: boolean): string {
  if (!scopeApproved || scope === 0) return '—';
  return ((qc / scope) * 100).toFixed(2);
}

export function calculateTotalTaskProgress(activities: ActivityForCalculation[]): string {
  const activitiesWithValues = activities.filter(a => {
    const isHandoffActivity = a.cablingHandoff || a.terminationHandoff;
    return !isHandoffActivity && (a.scopeApproved || a.qcValue > 0);
  });
  
  if (activitiesWithValues.length === 0) return '0%';
  
  const totalPercentage = activitiesWithValues.reduce((sum, act) => {
    const percent = act.scopeValue > 0 ? (act.qcValue / act.scopeValue) * 100 : 0;
    return sum + percent;
  }, 0);
  
  const averagePercentage = totalPercentage / activitiesWithValues.length;
  return averagePercentage.toFixed(2) + '%';
}

export function getStatusColor(status: ActivityStatus): string {
  switch (status) {
    case 'LOCKED':
      return '#94a3b8';
    case 'OPEN':
      return '#f59e0b';
    case 'DONE':
      return '#10b981';
    case 'HANDOFF_SENT':
      return '#8b5cf6';
    default:
      return '#94a3b8';
  }
}

export function getStatusBackground(status: ActivityStatus): string {
  switch (status) {
    case 'LOCKED':
      return '#f1f5f9';
    case 'OPEN':
      return '#fef3c7';
    case 'DONE':
      return '#d1fae5';
    case 'HANDOFF_SENT':
      return '#ede9fe';
    default:
      return '#f1f5f9';
  }
}

export const activityColors: Record<string, string> = {
  drilling: '#4285F4',
  trenching: '#4285F4',
  cabling: '#4285F4',
  terminations: '#4285F4',
  inverters: '#4285F4',
  mechanical: '#4285F4',
  casting: '#4285F4',
  structures: '#4285F4',
};

export const targetModuleNames: Record<string, string> = {
  'mv-cable': 'MV Cable',
  'dc-cable': 'DC Cable',
  'lv-cable': 'LV Cable',
  'dc-terminations': 'DC Terminations',
  'lv-terminations': 'LV Terminations',
};

export function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString();
}
