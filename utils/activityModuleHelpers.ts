import { ActivityModuleConfig, ActivityMicroModule, GridConfiguration } from '@/types';
import { doc, updateDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/config/firebase';

export function isMicroModuleEnabled(
  moduleConfig: ActivityModuleConfig | undefined,
  module: ActivityMicroModule
): boolean {
  if (!moduleConfig || !moduleConfig.microModules) {
    return false;
  }
  return moduleConfig.microModules[module]?.enabled === true;
}

export function getMicroModulePlacement(
  moduleConfig: ActivityModuleConfig | undefined,
  module: ActivityMicroModule
): 'inside' | 'above' | 'between' | undefined {
  if (!moduleConfig || !moduleConfig.microModules) {
    return undefined;
  }
  return moduleConfig.microModules[module]?.placement;
}

export function isGridTypeActivity(
  moduleConfig: ActivityModuleConfig | undefined
): boolean {
  return moduleConfig?.baseBlockType === 'GRID_TYPE_ROW_PROGRESS';
}

export function isStandardCompletedTodayActivity(
  moduleConfig: ActivityModuleConfig | undefined
): boolean {
  if (!moduleConfig) {
    return true;
  }
  return moduleConfig.baseBlockType === 'STANDARD_COMPLETED_TODAY';
}

export function getMicroModulesForPlacement(
  moduleConfig: ActivityModuleConfig | undefined,
  placement: 'inside' | 'above' | 'between'
): ActivityMicroModule[] {
  if (!moduleConfig || !moduleConfig.microModules) {
    return [];
  }

  const modules: ActivityMicroModule[] = [];
  
  for (const [key, value] of Object.entries(moduleConfig.microModules)) {
    if (value?.enabled && value?.placement === placement) {
      modules.push(key as ActivityMicroModule);
    }
  }
  
  return modules;
}

export function calculateGridScopeValue(gridConfig: GridConfiguration): number {
  if (gridConfig.flexibleColumns && gridConfig.flexibleColumns.length > 0) {
    return gridConfig.flexibleColumns.reduce((sum, col) => sum + col.rows, 0);
  }
  return gridConfig.totalRows * gridConfig.totalColumns;
}

export async function autoApproveGridScope(
  activityDocId: string,
  gridConfig: GridConfiguration,
  approverId: string,
  supervisorId: string
): Promise<void> {
  console.log('📊 [autoApproveGridScope] Auto-approving grid activity scope');
  console.log('   Activity Doc ID:', activityDocId);
  console.log('   Grid Config:', gridConfig);
  
  const totalCells = calculateGridScopeValue(gridConfig);
  const scopeValuePerCell = gridConfig.scopeValue || 1;
  const totalScopeValue = totalCells * scopeValuePerCell;
  const unit = gridConfig.scopeUnit || 'm';
  
  console.log('   Total Cells:', totalCells);
  console.log('   Scope per Cell:', scopeValuePerCell, unit);
  console.log('   Total Scope Value:', totalScopeValue, unit);
  
  const updatePayload: any = {
    scope: { 
      value: totalScopeValue, 
      unit, 
      setBy: approverId, 
      setAt: Timestamp.now(),
      autoApproved: true,
      source: 'GRID_CONFIG'
    },
    scopeValue: totalScopeValue,
    scopeApproved: true,
    scopeEverSet: true,
    status: 'OPEN',
    unlockedFor: arrayUnion(supervisorId),
    unit: {
      canonical: unit,
      setBy: approverId,
      setAt: Timestamp.now(),
    },
    updatedAt: Timestamp.now(),
  };
  
  console.log('🏴 [autoApproveGridScope] Setting scopeValue =', totalScopeValue, '- NEVER requires manual scope request');
  
  const actRef = doc(db, 'activities', activityDocId);
  await updateDoc(actRef, updatePayload);
  
  console.log('✅ [autoApproveGridScope] Grid scope auto-approved successfully');
}

export async function syncGridActivityScopeValue(
  activityDocId: string,
  gridConfig: GridConfiguration,
  updaterUserId: string
): Promise<void> {
  console.log('🔄 [syncGridActivityScopeValue] Syncing calculated scope for grid activity');
  console.log('   Activity Doc ID:', activityDocId);
  
  const totalCells = calculateGridScopeValue(gridConfig);
  const scopeValuePerCell = gridConfig.scopeValue || 1;
  const totalScopeValue = totalCells * scopeValuePerCell;
  const unit = gridConfig.scopeUnit || 'm';
  
  console.log('   Total Cells:', totalCells);
  console.log('   Scope per Cell:', scopeValuePerCell, unit);
  console.log('   Calculated Total Scope:', totalScopeValue, unit);
  
  const updatePayload: any = {
    scopeValue: totalScopeValue,
    updatedAt: Timestamp.now(),
    updatedBy: updaterUserId,
  };
  
  const actRef = doc(db, 'activities', activityDocId);
  await updateDoc(actRef, updatePayload);
  
  console.log('✅ [syncGridActivityScopeValue] Scope value synced:', totalScopeValue);
}
