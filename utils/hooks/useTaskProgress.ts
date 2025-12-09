import { useMemo } from 'react';

type Activity = {
  id: string;
  scopeValue: number;
  qcValue: number;
  scopeApproved: boolean;
  cablingHandoff?: any;
  terminationHandoff?: any;
};

export function useTaskProgress(activities: Activity[]): string {
  return useMemo(() => {
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
  }, [activities]);
}

export function useActivityPercentage(qcValue: number, scopeValue: number, scopeApproved: boolean): string {
  return useMemo(() => {
    if (!scopeApproved || scopeValue === 0) return '—';
    return ((qcValue / scopeValue) * 100).toFixed(2);
  }, [qcValue, scopeValue, scopeApproved]);
}
