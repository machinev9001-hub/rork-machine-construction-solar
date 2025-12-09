import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

export type ActivityProgress = {
  title: string;
  progressPercent: number;
  unverifiedProgressPercent: number;
  completed: number;
  unverifiedCompleted: number;
  totalScope: number;
  unit: string;
  mainMenu: string;
};

export type SiteProgress = {
  totalProgressPercent: number;
  unverifiedProgressPercent: number;
  totalCompleted: number;
  unverifiedCompleted: number;
  totalScope: number;
  activities: ActivityProgress[];
};

// Dynamic menu hierarchy - loaded from menuItems collection
// No more hardcoded mappings!

export type AllocatedScopeProgress = {
  totalQCValue: number;
  totalUnverifiedValue: number;
  totalAllocatedScope: number;
  percentage: number;
  unverifiedPercentage: number;
  supervisorCount: number;
  byMainMenu: Record<string, { qc: number; unverified: number; scope: number; percentage: number; unverifiedPercentage: number }>;
};

export type BOQProgress = {
  totalQCValue: number;
  totalUnverifiedValue: number;
  totalBOQScope: number;
  percentage: number;
  unverifiedPercentage: number;
  activitiesWithBOQ: number;
  activitiesWithoutBOQ: number;
  byMainMenu: Record<string, { qc: number; unverified: number; boqScope: number; percentage: number; unverifiedPercentage: number; activitiesCount: number }>;
};

export type TaskProgress = {
  taskId: string;
  taskName: string;
  subMenuKey: string;
  subMenuName: string;
  activities: number;
  qcValue: number;
  unverifiedValue: number;
  scopeValue: number;
  percentage: number;
  unverifiedPercentage: number;
};

export type SupervisorScopeProgress = {
  supervisorId: string;
  supervisorName: string;
  totalQCValue: number;
  totalUnverifiedValue: number;
  totalAllocatedScope: number;
  percentage: number;
  unverifiedPercentage: number;
  activitiesCount: number;
  taskBreakdown: TaskProgress[];
  byMainMenu: Record<string, { qc: number; unverified: number; scope: number; percentage: number; unverifiedPercentage: number }>;
  boqQCValue: number;
  boqUnverifiedValue: number;
  byMainMenuBOQ: Record<string, { qc: number; unverified: number }>;
};

export function calculateWeightedAverage(items: { qc: number; scope: number }[]): number {
  const totalQC = items.reduce((sum, item) => sum + item.qc, 0);
  const totalScope = items.reduce((sum, item) => sum + item.scope, 0);
  return totalScope > 0 ? (totalQC / totalScope) * 100 : 0;
}

export async function calculateBOQProgress(siteId: string): Promise<BOQProgress> {
  console.log('\n📊 ============================================== 📊');
  console.log('📊 BOQ PROGRESS TRACKING - START');
  console.log('📊 Site ID:', siteId);
  console.log('📊 ============================================== 📊\n');
  
  try {
    // Load menu hierarchy from menuItems collection
    const menuItemsRef = collection(db, 'menuItems');
    const menuItemsQuery = query(menuItemsRef, where('siteId', '==', siteId));
    const menuItemsSnapshot = await getDocs(menuItemsQuery);
    
    const mainMenuIdToKeyMap = new Map<string, string>();
    const subMenuToMainMenuMap = new Map<string, string>();
    const allMainMenuKeys = new Set<string>();
    
    // First pass: build main menu ID to key map
    menuItemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.level === 'main') {
        const mainMenuKey = (data.name || '').toLowerCase().replace(/\s+/g, '-');
        mainMenuIdToKeyMap.set(doc.id, mainMenuKey);
        allMainMenuKeys.add(mainMenuKey);
        console.log('📊 Main Menu:', data.name, '| Key:', mainMenuKey);
      }
    });
    
    // Second pass: build sub-menu to main menu map
    menuItemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.level === 'sub' && data.parentMainMenuId) {
        const subMenuKey = (data.key || data.name || '').toLowerCase().trim();
        const mainMenuKey = mainMenuIdToKeyMap.get(data.parentMainMenuId) || '';
        if (mainMenuKey) {
          subMenuToMainMenuMap.set(subMenuKey, mainMenuKey);
          console.log('📊 Sub Menu:', data.name, '| Key:', subMenuKey, '→ Main Menu:', mainMenuKey);
        }
      }
    });
    
    console.log('📊 Loaded', allMainMenuKeys.size, 'main menus and', subMenuToMainMenuMap.size, 'sub-menu mappings\n');
    
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('siteId', '==', siteId));
    const tasksSnapshot = await getDocs(tasksQuery);
    const taskIds = tasksSnapshot.docs.map(doc => doc.id);
    
    console.log('📊 Found', tasksSnapshot.docs.length, 'tasks for site');
    
    if (taskIds.length === 0) {
      console.log('📊 No tasks found, returning empty result\n');
      return {
        totalQCValue: 0,
        totalUnverifiedValue: 0,
        totalBOQScope: 0,
        percentage: 0,
        unverifiedPercentage: 0,
        activitiesWithBOQ: 0,
        activitiesWithoutBOQ: 0,
        byMainMenu: {},
      };
    }
    
    const allActivities: any[] = [];
    for (let i = 0; i < taskIds.length; i += 10) {
      const batch = taskIds.slice(i, i + 10);
      const activitiesRef = collection(db, 'activities');
      const activitiesQuery = query(activitiesRef, where('taskId', 'in', batch));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      allActivities.push(...activitiesSnapshot.docs);
    }
    
    console.log('📊 Found', allActivities.length, 'activities for site\n');
    
    let totalQCValue = 0;
    let totalUnverifiedValue = 0;
    let totalBOQScope = 0;
    let activitiesWithBOQ = 0;
    let activitiesWithoutBOQ = 0;
    const byMainMenu: Record<string, { qc: number; unverified: number; boqScope: number; percentage: number; unverifiedPercentage: number; activitiesCount: number }> = {};
    
    // Initialize all main menus from database
    allMainMenuKeys.forEach(key => {
      byMainMenu[key] = { qc: 0, unverified: 0, boqScope: 0, percentage: 0, unverifiedPercentage: 0, activitiesCount: 0 };
    });
    
    for (const activityDoc of allActivities) {
      const activityData = activityDoc.data();
      
      const subMenuKey = (activityData.subMenuKey || '').toLowerCase().trim();
      const mainMenu = subMenuToMainMenuMap.get(subMenuKey) || '';
      
      const boqQuantity = activityData.moduleConfig?.boqQuantity;
      const boqUnit = activityData.moduleConfig?.boqUnit;
      
      const qcValue = activityData.qcValue || activityData.qc?.value || 0;
      const supervisorInputValue = activityData.cumulativeCompleted || activityData.completedToday || activityData.supervisorInputValue || 0;
      const isHandoff = activityData.cablingHandoff || activityData.terminationHandoff;
      
      console.log('📊 Activity:', activityData.name);
      console.log('   Sub-menu:', subMenuKey, '→ Main menu:', mainMenu);
      console.log('   BOQ:', boqQuantity, boqUnit || 'N/A', '| QC:', qcValue, '| Supervisor Input:', supervisorInputValue);
      console.log('   Is Handoff:', isHandoff);
      
      if (isHandoff) {
        console.log('   ❌ SKIPPED - Handoff activity\n');
        continue;
      }
      
      if (!boqQuantity || boqQuantity <= 0) {
        activitiesWithoutBOQ++;
        console.log('   ⚠️ NO BOQ - Activity has no BOQ quantity defined\n');
        continue;
      }
      
      activitiesWithBOQ++;
      totalQCValue += qcValue;
      totalUnverifiedValue += supervisorInputValue;
      totalBOQScope += boqQuantity;
      
      if (mainMenu && byMainMenu[mainMenu]) {
        byMainMenu[mainMenu].qc += qcValue;
        byMainMenu[mainMenu].unverified += supervisorInputValue;
        byMainMenu[mainMenu].boqScope += boqQuantity;
        byMainMenu[mainMenu].activitiesCount += 1;
      }
      
      console.log('   ✅ COUNTED | QC:', qcValue, '| Unverified:', supervisorInputValue, '| BOQ:', boqQuantity);
      console.log('   Running Totals → QC:', totalQCValue.toFixed(2), '| Unverified:', totalUnverifiedValue.toFixed(2), '| BOQ:', totalBOQScope.toFixed(2));
      console.log('');
    }
    
    for (const mainMenu in byMainMenu) {
      const data = byMainMenu[mainMenu];
      data.percentage = data.boqScope > 0 ? (data.qc / data.boqScope) * 100 : 0;
      data.unverifiedPercentage = data.boqScope > 0 ? (data.unverified / data.boqScope) * 100 : 0;
    }
    
    const percentage = totalBOQScope > 0 ? (totalQCValue / totalBOQScope) * 100 : 0;
    const unverifiedPercentage = totalBOQScope > 0 ? (totalUnverifiedValue / totalBOQScope) * 100 : 0;
    
    console.log('\n📊 ============================================== 📊');
    console.log('📊 BOQ PROGRESS - FINAL RESULT');
    console.log('📊 Total QC Value:', totalQCValue.toFixed(2));
    console.log('📊 Total Unverified Value:', totalUnverifiedValue.toFixed(2));
    console.log('📊 Total BOQ Scope:', totalBOQScope.toFixed(2));
    console.log('📊 QC Verified Percentage:', percentage.toFixed(2) + '%');
    console.log('📊 Unverified Percentage:', unverifiedPercentage.toFixed(2) + '%');
    console.log('📊 Activities with BOQ:', activitiesWithBOQ);
    console.log('📊 Activities without BOQ:', activitiesWithoutBOQ);
    console.log('📊 By Main Menu:');
    for (const [menu, data] of Object.entries(byMainMenu)) {
      if (data.boqScope > 0) {
        console.log(`📊   ${menu}: QC ${data.percentage.toFixed(2)}% | Unverified ${data.unverifiedPercentage.toFixed(2)}% (${data.qc.toFixed(2)}/${data.unverified.toFixed(2)}/${data.boqScope.toFixed(2)}) | ${data.activitiesCount} activities`);
      }
    }
    console.log('📊 ============================================== 📊\n');
    
    return {
      totalQCValue,
      totalUnverifiedValue,
      totalBOQScope,
      percentage: Math.min(percentage, 100),
      unverifiedPercentage: Math.min(unverifiedPercentage, 100),
      activitiesWithBOQ,
      activitiesWithoutBOQ,
      byMainMenu,
    };
  } catch (error) {
    console.error('❌ BOQ PROGRESS - ERROR:', error);
    
    return {
      totalQCValue: 0,
      totalUnverifiedValue: 0,
      totalBOQScope: 0,
      percentage: 0,
      unverifiedPercentage: 0,
      activitiesWithBOQ: 0,
      activitiesWithoutBOQ: 0,
      byMainMenu: {},
    };
  }
}

export async function calculateAllocatedScopeProgress(siteId: string): Promise<AllocatedScopeProgress> {
  console.log('\n🎯 ============================================== 🎯');
  console.log('🎯 ALLOCATED SCOPE PROGRESS - START');
  console.log('🎯 Site ID:', siteId);
  console.log('🎯 ============================================== 🎯\n');
  
  try {
    // Load menu hierarchy from menuItems collection
    const menuItemsRef = collection(db, 'menuItems');
    const menuItemsQuery = query(menuItemsRef, where('siteId', '==', siteId));
    const menuItemsSnapshot = await getDocs(menuItemsQuery);
    
    const mainMenuIdToKeyMap = new Map<string, string>();
    const subMenuToMainMenuMap = new Map<string, string>();
    const allMainMenuKeys = new Set<string>();
    
    // First pass: build main menu ID to key map
    menuItemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.level === 'main') {
        const mainMenuKey = (data.name || '').toLowerCase().replace(/\s+/g, '-');
        mainMenuIdToKeyMap.set(doc.id, mainMenuKey);
        allMainMenuKeys.add(mainMenuKey);
        console.log('🎯 Main Menu:', data.name, '| Key:', mainMenuKey);
      }
    });
    
    // Second pass: build sub-menu to main menu map
    menuItemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.level === 'sub' && data.parentMainMenuId) {
        const subMenuKey = (data.key || data.name || '').toLowerCase().trim();
        const mainMenuKey = mainMenuIdToKeyMap.get(data.parentMainMenuId) || '';
        if (mainMenuKey) {
          subMenuToMainMenuMap.set(subMenuKey, mainMenuKey);
          console.log('🎯 Sub Menu:', data.name, '| Key:', subMenuKey, '→ Main Menu:', mainMenuKey);
        }
      }
    });
    
    console.log('🎯 Loaded', allMainMenuKeys.size, 'main menus and', subMenuToMainMenuMap.size, 'sub-menu mappings\n');
    
    // First, get all tasks for this site
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('siteId', '==', siteId));
    const tasksSnapshot = await getDocs(tasksQuery);
    const taskIds = tasksSnapshot.docs.map(doc => doc.id);
    
    console.log('🎯 Found', tasksSnapshot.docs.length, 'tasks for site');
    
    if (taskIds.length === 0) {
      console.log('🎯 No tasks found, returning empty result\n');
      return {
        totalQCValue: 0,
        totalUnverifiedValue: 0,
        totalAllocatedScope: 0,
        percentage: 0,
        unverifiedPercentage: 0,
        supervisorCount: 0,
        byMainMenu: {},
      };
    }
    
    // Get activities for these tasks in batches (Firestore 'in' query supports up to 10 values)
    const allActivities: any[] = [];
    for (let i = 0; i < taskIds.length; i += 10) {
      const batch = taskIds.slice(i, i + 10);
      const activitiesRef = collection(db, 'activities');
      const activitiesQuery = query(activitiesRef, where('taskId', 'in', batch));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      allActivities.push(...activitiesSnapshot.docs);
    }
    
    console.log('🎯 Found', allActivities.length, 'activities for site\n');
    
    let totalQCValue = 0;
    let totalUnverifiedValue = 0;
    let totalAllocatedScope = 0;
    const supervisorSet = new Set<string>();
    const byMainMenu: Record<string, { qc: number; unverified: number; scope: number; percentage: number; unverifiedPercentage: number }> = {};
    
    // Initialize all main menus from database
    allMainMenuKeys.forEach(key => {
      byMainMenu[key] = { qc: 0, unverified: 0, scope: 0, percentage: 0, unverifiedPercentage: 0 };
    });
    
    for (const activityDoc of allActivities) {
      const activityData = activityDoc.data();
      
      const subMenuKey = (activityData.subMenuKey || '').toLowerCase().trim();
      const mainMenu = subMenuToMainMenuMap.get(subMenuKey) || '';
      
      let scopeValue = typeof activityData.scopeValue === 'number' 
        ? activityData.scopeValue 
        : (activityData.scopeValue?.value || 0);
      
      // 🎯 GRID ACTIVITIES: Calculate scope from grid configuration
      if (scopeValue === 0 && activityData.moduleConfig?.gridConfig) {
        const gridConfig = activityData.moduleConfig.gridConfig;
        if (gridConfig.flexibleColumns && gridConfig.flexibleColumns.length > 0) {
          const totalCells = gridConfig.flexibleColumns.reduce((sum: number, col: any) => sum + (col.rows || 0), 0);
          const perCellValue = gridConfig.scopeValue || 1;
          scopeValue = totalCells * perCellValue;
          console.log('   📐 GRID ACTIVITY - Calculated scope from grid config:', totalCells, 'cells ×', perCellValue, '=', scopeValue);
        }
      }
      
      const scopeApproved = activityData.scopeApproved || false;
      const qcValue = activityData.qcValue || activityData.qc?.value || 0;
      const supervisorInputValue = activityData.cumulativeCompleted || activityData.supervisorInputValue || 0;
      const supervisorId = activityData.supervisorInputBy || '';
      const isHandoff = activityData.cablingHandoff || activityData.terminationHandoff;
      
      console.log('🎯 Activity:', activityData.name);
      console.log('   Sub-menu:', subMenuKey, '→ Main menu:', mainMenu);
      console.log('   Scope:', scopeValue, '| Approved:', scopeApproved, '| QC:', qcValue);
      console.log('   Supervisor:', supervisorId || 'None', '| Handoff:', isHandoff);
      
      if (!isHandoff && scopeValue > 0) {
        totalQCValue += qcValue;
        totalUnverifiedValue += supervisorInputValue;
        totalAllocatedScope += scopeValue;
        
        if (supervisorId) {
          supervisorSet.add(supervisorId);
        }
        
        if (mainMenu && byMainMenu[mainMenu]) {
          byMainMenu[mainMenu].qc += qcValue;
          byMainMenu[mainMenu].unverified += supervisorInputValue;
          byMainMenu[mainMenu].scope += scopeValue;
        }
        
        console.log('   ✅ COUNTED | QC:', qcValue, '| Unverified:', supervisorInputValue, '| Scope:', scopeValue);
        console.log('   Running Totals → QC:', totalQCValue.toFixed(2), '| Unverified:', totalUnverifiedValue.toFixed(2), '| Scope:', totalAllocatedScope.toFixed(2));
      } else {
        console.log('   ❌ SKIPPED -', isHandoff ? 'Handoff activity' : 'No scope');
      }
      console.log('');
    }
    
    for (const mainMenu in byMainMenu) {
      const data = byMainMenu[mainMenu];
      data.percentage = data.scope > 0 ? (data.qc / data.scope) * 100 : 0;
      data.unverifiedPercentage = data.scope > 0 ? (data.unverified / data.scope) * 100 : 0;
    }
    
    const percentage = totalAllocatedScope > 0 ? (totalQCValue / totalAllocatedScope) * 100 : 0;
    const unverifiedPercentage = totalAllocatedScope > 0 ? (totalUnverifiedValue / totalAllocatedScope) * 100 : 0;
    
    console.log('\n🎯 ============================================== 🎯');
    console.log('🎯 ALLOCATED SCOPE PROGRESS - FINAL RESULT');
    console.log('🎯 Total QC Value:', totalQCValue.toFixed(2));
    console.log('🎯 Total Unverified Value:', totalUnverifiedValue.toFixed(2));
    console.log('🎯 Total Allocated Scope:', totalAllocatedScope.toFixed(2));
    console.log('🎯 QC Verified Percentage:', percentage.toFixed(2) + '%');
    console.log('🎯 Unverified Percentage:', unverifiedPercentage.toFixed(2) + '%');
    console.log('🎯 Unique Supervisors:', supervisorSet.size);
    console.log('🎯 By Main Menu:');
    for (const [menu, data] of Object.entries(byMainMenu)) {
      if (data.scope > 0) {
        console.log(`🎯   ${menu}: QC ${data.percentage.toFixed(2)}% | Unverified ${data.unverifiedPercentage.toFixed(2)}% (${data.qc.toFixed(2)}/${data.unverified.toFixed(2)}/${data.scope.toFixed(2)})`);
      }
    }
    console.log('🎯 ============================================== 🎯\n');
    
    return {
      totalQCValue,
      totalUnverifiedValue,
      totalAllocatedScope,
      percentage: Math.min(percentage, 100),
      unverifiedPercentage: Math.min(unverifiedPercentage, 100),
      supervisorCount: supervisorSet.size,
      byMainMenu,
    };
  } catch (error) {
    console.error('❌ ALLOCATED SCOPE PROGRESS - ERROR:', error);
    
    return {
      totalQCValue: 0,
      totalUnverifiedValue: 0,
      totalAllocatedScope: 0,
      percentage: 0,
      unverifiedPercentage: 0,
      supervisorCount: 0,
      byMainMenu: {},
    };
  }
}

export async function calculatePerUserScopeProgress(siteId: string): Promise<SupervisorScopeProgress[]> {
  console.log('\n👥 ============================================== 👥');
  console.log('👥 PER USER SCOPE PROGRESS - START');
  console.log('👥 Site ID:', siteId);
  console.log('👥 ============================================== 👥\n');
  
  try {
    const usersRef = collection(db, 'users');
    const usersQuery = query(usersRef, where('siteId', '==', siteId));
    const usersSnapshot = await getDocs(usersQuery);
    const userNameMap = new Map<string, { name: string; role: string; docId: string }>();
    const userIdToDocId = new Map<string, string>();
    const supervisorUserIds = new Set<string>();
    
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      const role = userData.role || '';
      const name = userData.name || userData.userId || 'Unknown';
      const userId = userData.userId || doc.id;
      
      // Map BOTH userId and docId to handle different references
      userNameMap.set(userId, { name, role, docId: doc.id });
      userNameMap.set(doc.id, { name, role, docId: doc.id });
      userIdToDocId.set(userId, doc.id);
      
      // Include Supervisor, master, and all other roles since master can act as any role
      // We'll filter later based on actual activity assignment
      supervisorUserIds.add(userId);
      supervisorUserIds.add(doc.id);
      console.log('👥 Found user:', name, '| Role:', role, '| userId:', userId, '| docId:', doc.id);
    });
    
    console.log('👥 Total users found:', supervisorUserIds.size, '\n');
    
    // Get all tasks for this site first
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('siteId', '==', siteId));
    const tasksSnapshot = await getDocs(tasksQuery);
    const taskIds = tasksSnapshot.docs.map(doc => doc.id);
    
    console.log('👥 Found', tasksSnapshot.docs.length, 'tasks for site');
    
    if (taskIds.length === 0) {
      console.log('👥 No tasks found, returning empty result\n');
      return [];
    }
    
    // Get activities for these tasks (Firestore 'in' query supports up to 10 values)
    // We'll query in batches if needed
    const allActivities: any[] = [];
    for (let i = 0; i < taskIds.length; i += 10) {
      const batch = taskIds.slice(i, i + 10);
      const activitiesRef = collection(db, 'activities');
      const activitiesQuery = query(activitiesRef, where('taskId', 'in', batch));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      allActivities.push(...activitiesSnapshot.docs);
    }
    
    console.log('👥 Found', allActivities.length, 'activities for site\n');
    
    // Fetch menu hierarchy from menuItems collection
    const menuItemsRef = collection(db, 'menuItems');
    const menuItemsQuery = query(menuItemsRef, where('siteId', '==', siteId));
    const menuItemsSnapshot = await getDocs(menuItemsQuery);
    const subMenuNameMap = new Map<string, string>();
    const subMenuToMainMenuMap = new Map<string, string>();
    const mainMenuIdToKeyMap = new Map<string, string>();
    
    // First pass: build main menu ID to key map
    menuItemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.level === 'main') {
        const mainMenuKey = (data.name || '').toLowerCase().replace(/\s+/g, '-');
        mainMenuIdToKeyMap.set(doc.id, mainMenuKey);
        console.log('👥 Main Menu:', data.name, '| ID:', doc.id, '| Key:', mainMenuKey);
      }
    });
    
    // Second pass: build sub-menu to main menu map and sub-menu names
    menuItemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.level === 'sub' && data.parentMainMenuId) {
        const subMenuKey = (data.key || data.name || '').toLowerCase().trim();
        const mainMenuKey = mainMenuIdToKeyMap.get(data.parentMainMenuId) || '';
        if (mainMenuKey) {
          subMenuToMainMenuMap.set(subMenuKey, mainMenuKey);
          console.log('👥 Sub Menu:', data.name, '| Key:', subMenuKey, '→ Main Menu:', mainMenuKey);
        }
        subMenuNameMap.set(subMenuKey, data.name || subMenuKey.toUpperCase());
      }
    });
    
    console.log('👥 Loaded', subMenuNameMap.size, 'submenu names from menuItems');
    console.log('👥 Loaded', subMenuToMainMenuMap.size, 'sub-menu to main-menu mappings\n');
    
    // Get all main menu keys for initialization
    const allMainMenuKeys = new Set<string>();
    mainMenuIdToKeyMap.forEach(key => allMainMenuKeys.add(key));
    
    console.log('👥 Initial main menu keys from menuItems:', Array.from(allMainMenuKeys));
    
    const supervisorMainMenuAccess = new Map<string, Set<string>>();
    
    const userMap = new Map<string, {
      totalQC: number;
      totalUnverified: number;
      totalScope: number;
      activitiesCount: number;
      boqQCValue: number;
      boqUnverifiedValue: number;
      tasks: Map<string, {
        taskName: string;
        subMenuKey: string;
        subMenuName: string;
        qc: number;
        unverified: number;
        scope: number;
        count: number;
      }>;
      byMainMenu: Record<string, { qc: number; unverified: number; scope: number }>;
      byMainMenuBOQ: Record<string, { qc: number; unverified: number }>;
    }>();
    
    const taskNameMap = new Map<string, { name: string; subMenuKey: string }>();
    const taskSubMenuNameMap = new Map<string, string>();
    
    tasksSnapshot.docs.forEach(doc => {
      const data = doc.data();
      let taskName = '';
      if (data.pvArea && data.blockArea) {
        taskName = `${data.pvArea} - ${data.blockArea}`;
      } else if (data.pvArea) {
        taskName = data.pvArea;
      } else if (data.blockArea) {
        taskName = data.blockArea;
      } else {
        taskName = `Task ${doc.id.slice(0, 8)}`;
      }
      
      const subMenuKey = (data.subActivity || data.activity || 'unknown').toLowerCase().trim();
      const subMenuName = subMenuNameMap.get(subMenuKey) || subMenuKey.toUpperCase();
      
      taskNameMap.set(doc.id, {
        name: taskName,
        subMenuKey: data.subActivity || data.activity || 'unknown',
      });
      
      taskSubMenuNameMap.set(doc.id, subMenuName);
    });
    
    for (const activityDoc of allActivities) {
      const activityData = activityDoc.data();
      
      const supervisorUserId = activityData.supervisorInputBy || '';
      const taskId = activityData.taskId || '';
      const subMenuKey = (activityData.subMenuKey || '').toLowerCase().trim();
      const mainMenu = subMenuToMainMenuMap.get(subMenuKey) || '';
      
      // 🔧 STRICT FILTERING: Skip activities without a valid main menu mapping
      if (!mainMenu) {
        console.log('   ⚠️ No main menu mapping found for submenu:', subMenuKey, '→ SKIPPING activity');
        continue;
      }
      
      let scopeValue = typeof activityData.scopeValue === 'number' 
        ? activityData.scopeValue 
        : (activityData.scopeValue?.value || 0);
      
      // 🎯 GRID ACTIVITIES: Calculate scope from grid configuration
      if (scopeValue === 0 && activityData.moduleConfig?.gridConfig) {
        const gridConfig = activityData.moduleConfig.gridConfig;
        if (gridConfig.flexibleColumns && gridConfig.flexibleColumns.length > 0) {
          const totalCells = gridConfig.flexibleColumns.reduce((sum: number, col: any) => sum + (col.rows || 0), 0);
          const perCellValue = gridConfig.scopeValue || 1;
          scopeValue = totalCells * perCellValue;
          console.log('   📐 GRID ACTIVITY - Calculated scope from grid config:', totalCells, 'cells ×', perCellValue, '=', scopeValue);
        }
      }
      
      const qcValue = activityData.qcValue || activityData.qc?.value || 0;
      const supervisorInputValue = activityData.cumulativeCompleted || activityData.completedToday || activityData.supervisorInputValue || 0;
      const isHandoff = activityData.cablingHandoff || activityData.terminationHandoff;
      const boqQuantity = activityData.moduleConfig?.boqQuantity || 0;
      const hasBOQ = boqQuantity > 0;
      
      console.log('👥 Activity:', activityData.name);
      console.log('   Supervisor userId:', supervisorUserId || 'None', '| Task:', taskId || 'None');
      console.log('   Sub-menu:', subMenuKey, '→ Main menu:', mainMenu);
      console.log('   Scope:', scopeValue, '| QC:', qcValue, '| Supervisor Input:', supervisorInputValue);
      console.log('   BOQ Quantity:', boqQuantity, '| Has BOQ:', hasBOQ);
      console.log('   Is Handoff:', isHandoff);
      
      // Skip activities with missing critical data or handoff activities
      if (isHandoff) {
        console.log('   ❌ SKIPPED - Handoff activity\n');
        continue;
      }
      
      // Activities with scopeValue > 0 should be counted (blocks determine scope)
      if (scopeValue <= 0) {
        console.log('   ❌ SKIPPED - No scope value\n');
        continue;
      }
      
      // Need at least a supervisor OR task to attribute the activity
      if (!supervisorUserId && !taskId) {
        console.log('   ❌ SKIPPED - No supervisor or task assigned\n');
        continue;
      }
      
      // If supervisor assigned, they must exist in the system
      if (supervisorUserId && !userNameMap.has(supervisorUserId)) {
        console.log('   ⚠️ WARNING - Supervisor not found in users:', supervisorUserId);
        console.log('   Continuing anyway to count activity...\n');
        // Don't skip - still count the activity even if user lookup fails
      }
      
      // Get user info if available
      const userInfo = supervisorUserId ? userNameMap.get(supervisorUserId) : null;
      if (userInfo) {
        console.log('   ℹ️ Processing for user:', userInfo.name, '| Role:', userInfo.role);
      } else if (supervisorUserId) {
        console.log('   ℹ️ Processing for userId:', supervisorUserId, '(user details not found)');
      }
      
      // Only track if we have a valid supervisorUserId
      if (!supervisorUserId) {
        console.log('   ⚠️ Activity has scope but no supervisor - skipping user tracking\n');
        continue;
      }
      
      // Track which main menus this supervisor has access to
      if (mainMenu) {
        if (!supervisorMainMenuAccess.has(supervisorUserId)) {
          supervisorMainMenuAccess.set(supervisorUserId, new Set());
        }
        supervisorMainMenuAccess.get(supervisorUserId)!.add(mainMenu);
      }
      
      if (!userMap.has(supervisorUserId)) {
        // Initialize empty - we'll add menus dynamically as they're discovered
        userMap.set(supervisorUserId, {
          totalQC: 0,
          totalUnverified: 0,
          totalScope: 0,
          activitiesCount: 0,
          boqQCValue: 0,
          boqUnverifiedValue: 0,
          tasks: new Map(),
          byMainMenu: {},
          byMainMenuBOQ: {},
        });
      }
      
      const userData = userMap.get(supervisorUserId)!;
      userData.totalQC += qcValue;
      userData.totalUnverified += supervisorInputValue;
      userData.totalScope += scopeValue;
      userData.activitiesCount += 1;
      
      // Track BOQ contributions separately
      if (hasBOQ) {
        userData.boqQCValue += qcValue;
        userData.boqUnverifiedValue += supervisorInputValue;
        
        if (mainMenu) {
          if (!userData.byMainMenuBOQ[mainMenu]) {
            userData.byMainMenuBOQ[mainMenu] = { qc: 0, unverified: 0 };
          }
          userData.byMainMenuBOQ[mainMenu].qc += qcValue;
          userData.byMainMenuBOQ[mainMenu].unverified += supervisorInputValue;
        }
      }
      
      if (mainMenu) {
        // Initialize main menu if not exists
        if (!userData.byMainMenu[mainMenu]) {
          userData.byMainMenu[mainMenu] = { qc: 0, unverified: 0, scope: 0 };
          console.log('   📝 Initialized new main menu in userData:', mainMenu);
        }
        userData.byMainMenu[mainMenu].qc += qcValue;
        userData.byMainMenu[mainMenu].unverified += supervisorInputValue;
        userData.byMainMenu[mainMenu].scope += scopeValue;
      }
      
      if (!userData.tasks.has(taskId)) {
        const taskInfo = taskNameMap.get(taskId);
        const normalizedSubMenuKey = subMenuKey.toLowerCase().trim();
        const fetchedSubMenuName = taskSubMenuNameMap.get(taskId) || subMenuNameMap.get(normalizedSubMenuKey) || subMenuKey.toUpperCase();
        
        userData.tasks.set(taskId, {
          taskName: taskInfo?.name || `Task ${taskId.slice(0, 8)}`,
          subMenuKey: taskInfo?.subMenuKey || subMenuKey,
          subMenuName: fetchedSubMenuName,
          qc: 0,
          unverified: 0,
          scope: 0,
          count: 0,
        });
      }
      
      const taskData = userData.tasks.get(taskId)!;
      taskData.qc += qcValue;
      taskData.unverified += supervisorInputValue;
      taskData.scope += scopeValue;
      taskData.count += 1;
      
      console.log('   ✅ COUNTED for userId:', supervisorUserId, '| name:', userInfo?.name || 'Unknown');
      console.log('   User Totals → QC:', userData.totalQC.toFixed(2), '| Scope:', userData.totalScope.toFixed(2), '\n');
    }
    

    
    const results: SupervisorScopeProgress[] = [];
    
    userMap.forEach((userData, supervisorUserId) => {
      const userInfo = userNameMap.get(supervisorUserId);
      if (!userInfo) {
        console.log('👥 ⚠️ User not found in userNameMap:', supervisorUserId);
        return;
      }
      
      // 1️⃣ LEVEL 1: TOTAL PER USER - Weighted average of ALL activities across ALL tasks/menus
      // Formula: (Total QC across all activities) / (Total Scope across all activities) * 100
      const percentage = userData.totalScope > 0 ? (userData.totalQC / userData.totalScope) * 100 : 0;
      const unverifiedPercentage = userData.totalScope > 0 ? (userData.totalUnverified / userData.totalScope) * 100 : 0;
      console.log(`\n1️⃣ USER TOTAL: ${userInfo.name}`);
      console.log(`   QC Verified = (${userData.totalQC.toFixed(2)} total QC) / (${userData.totalScope.toFixed(2)} total scope) × 100 = ${percentage.toFixed(2)}%`);
      console.log(`   Unverified = (${userData.totalUnverified.toFixed(2)} total unverified) / (${userData.totalScope.toFixed(2)} total scope) × 100 = ${unverifiedPercentage.toFixed(2)}%`);
      
      // 4️⃣ LEVEL 4: TOTAL PER TASK - Weighted average of all activities within each task
      const taskBreakdown: TaskProgress[] = [];
      userData.tasks.forEach((taskData, taskId) => {
        const taskPercentage = taskData.scope > 0 ? (taskData.qc / taskData.scope) * 100 : 0;
        const taskUnverifiedPercentage = taskData.scope > 0 ? (taskData.unverified / taskData.scope) * 100 : 0;
        console.log(`\n4️⃣ TASK: ${taskData.taskName}`);
        console.log(`   QC Verified = (${taskData.qc.toFixed(2)} QC) / (${taskData.scope.toFixed(2)} scope) × 100 = ${taskPercentage.toFixed(2)}%`);
        console.log(`   Unverified = (${taskData.unverified.toFixed(2)} unverified) / (${taskData.scope.toFixed(2)} scope) × 100 = ${taskUnverifiedPercentage.toFixed(2)}%`);
        console.log(`   Activities in task: ${taskData.count}`);
        
        taskBreakdown.push({
          taskId,
          taskName: taskData.taskName,
          subMenuKey: taskData.subMenuKey,
          subMenuName: taskData.subMenuName,
          activities: taskData.count,
          qcValue: taskData.qc,
          unverifiedValue: taskData.unverified,
          scopeValue: taskData.scope,
          percentage: Math.min(taskPercentage, 100),
          unverifiedPercentage: Math.min(taskUnverifiedPercentage, 100),
        });
      });
      
      // 2️⃣ LEVEL 2: TOTAL PER MAIN MENU - Weighted average of activities under each main menu
      // Include ALL main menus from the site, even if supervisor has 0% progress
      const byMainMenu: Record<string, { qc: number; unverified: number; scope: number; percentage: number; unverifiedPercentage: number }> = {};
      
      // Initialize ALL main menus from the site with 0 values
      allMainMenuKeys.forEach(menu => {
        byMainMenu[menu] = {
          qc: 0,
          unverified: 0,
          scope: 0,
          percentage: 0,
          unverifiedPercentage: 0,
        };
      });
      
      // Then populate with actual data where available
      Object.keys(userData.byMainMenu).forEach(menu => {
        const data = userData.byMainMenu[menu];
        const mainMenuPercentage = data.scope > 0 ? (data.qc / data.scope) * 100 : 0;
        const mainMenuUnverifiedPercentage = data.scope > 0 ? (data.unverified / data.scope) * 100 : 0;
        byMainMenu[menu] = {
          qc: data.qc,
          unverified: data.unverified,
          scope: data.scope,
          percentage: mainMenuPercentage,
          unverifiedPercentage: mainMenuUnverifiedPercentage,
        };
        console.log(`\n2️⃣ MAIN MENU: ${menu}`);
        console.log(`   QC Verified = (${data.qc.toFixed(2)} QC) / (${data.scope.toFixed(2)} scope) × 100 = ${mainMenuPercentage.toFixed(2)}%`);
        console.log(`   Unverified = (${data.unverified.toFixed(2)} unverified) / (${data.scope.toFixed(2)} scope) × 100 = ${mainMenuUnverifiedPercentage.toFixed(2)}%`);
      });
      
      console.log(`\n📋 Supervisor ${userInfo.name}:`);
      console.log(`   Total main menus in results: ${Object.keys(byMainMenu).length}`);
      console.log(`   Main menus list:`, Object.keys(byMainMenu).join(', '));
      console.log(`   Menus with progress:`, Object.keys(byMainMenu).filter(m => byMainMenu[m].scope > 0).join(', ') || 'none');
      
      results.push({
        supervisorId: supervisorUserId,
        supervisorName: userInfo.name,
        totalQCValue: userData.totalQC,
        totalUnverifiedValue: userData.totalUnverified,
        totalAllocatedScope: userData.totalScope,
        percentage: Math.min(percentage, 100),
        unverifiedPercentage: Math.min(unverifiedPercentage, 100),
        activitiesCount: userData.activitiesCount,
        taskBreakdown: taskBreakdown.sort((a, b) => b.percentage - a.percentage),
        byMainMenu,
        boqQCValue: userData.boqQCValue,
        boqUnverifiedValue: userData.boqUnverifiedValue,
        byMainMenuBOQ: userData.byMainMenuBOQ,
      });
    });
    
    results.sort((a, b) => b.percentage - a.percentage);
    
    console.log('👥 ============================================== 👥');
    console.log('👥 PER USER SCOPE PROGRESS - FINAL RESULT');
    console.log('👥 Total Users:', results.length);
    results.forEach(user => {
      console.log(`👥 ${user.supervisorName}:`);
      console.log(`   QC Verified: ${user.percentage.toFixed(2)}% (${user.totalQCValue.toFixed(2)}/${user.totalAllocatedScope.toFixed(2)})`);
      console.log(`   Unverified: ${user.unverifiedPercentage.toFixed(2)}% (${user.totalUnverifiedValue.toFixed(2)}/${user.totalAllocatedScope.toFixed(2)})`);
      console.log(`   Activities: ${user.activitiesCount} | Tasks: ${user.taskBreakdown.length}`);
      user.taskBreakdown.forEach(task => {
        console.log(`   → ${task.taskName} (${task.subMenuName}): QC ${task.percentage.toFixed(2)}% | Unverified ${task.unverifiedPercentage.toFixed(2)}%`);
      });
    });
    console.log('👥 ============================================== 👥\n');
    
    return results;
  } catch (error) {
    console.error('❌ PER USER SCOPE PROGRESS - ERROR:', error);
    return [];
  }
}

export async function calculateSiteProgress(siteId: string): Promise<SiteProgress> {
  console.log('📊 ==============================================');
  console.log('📊 calculateSiteProgress - START for siteId:', siteId);
  console.log('📊 ==============================================');
  
  try {
    // Load menu hierarchy from menuItems collection
    const menuItemsRef = collection(db, 'menuItems');
    const menuItemsQuery = query(menuItemsRef, where('siteId', '==', siteId));
    const menuItemsSnapshot = await getDocs(menuItemsQuery);
    
    const mainMenuIdToKeyMap = new Map<string, string>();
    const mainMenuKeyToNameMap = new Map<string, string>();
    const subMenuToMainMenuMap = new Map<string, string>();
    const allMainMenuKeys: { key: string; name: string }[] = [];
    
    // First pass: build main menu ID to key map
    menuItemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.level === 'main') {
        const mainMenuKey = (data.name || '').toLowerCase().replace(/\s+/g, '-');
        mainMenuIdToKeyMap.set(doc.id, mainMenuKey);
        mainMenuKeyToNameMap.set(mainMenuKey, data.name || mainMenuKey);
        allMainMenuKeys.push({ key: mainMenuKey, name: data.name || mainMenuKey });
        console.log('📊 Main Menu:', data.name, '| Key:', mainMenuKey);
      }
    });
    
    // Second pass: build sub-menu to main menu map
    menuItemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.level === 'sub' && data.parentMainMenuId) {
        const subMenuKey = (data.key || data.name || '').toLowerCase().trim();
        const mainMenuKey = mainMenuIdToKeyMap.get(data.parentMainMenuId) || '';
        if (mainMenuKey) {
          subMenuToMainMenuMap.set(subMenuKey, mainMenuKey);
          console.log('📊 Sub Menu:', data.name, '| Key:', subMenuKey, '→ Main Menu:', mainMenuKey);
        }
      }
    });
    
    console.log('📊 Loaded', allMainMenuKeys.length, 'main menus and', subMenuToMainMenuMap.size, 'sub-menu mappings\n');
    
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('siteId', '==', siteId));
    const tasksSnapshot = await getDocs(tasksQuery);
    
    console.log('📊 Found', tasksSnapshot.docs.length, 'tasks for site:', siteId);
    
    const activityDataByMenu: Record<string, { completed: number; unverifiedCompleted: number; scope: number; unit: string; count: number }> = {};
    
    // Initialize all main menus from database
    allMainMenuKeys.forEach(menu => {
      activityDataByMenu[menu.key] = { completed: 0, unverifiedCompleted: 0, scope: 0, unit: 'units', count: 0 };
    });
    
    for (const taskDoc of tasksSnapshot.docs) {
      
      const activitiesRef = collection(db, 'activities');
      const activitiesQuery = query(activitiesRef, where('taskId', '==', taskDoc.id));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      
      console.log('📊 Task', taskDoc.id, '| activities count:', activitiesSnapshot.docs.length);
      
      for (const activityDoc of activitiesSnapshot.docs) {
        const activityData = activityDoc.data();
        
        const subMenuKey = (activityData.subMenuKey || '').toLowerCase().trim();
        const mainMenu = subMenuToMainMenuMap.get(subMenuKey) || '';
        
        let scopeValue = activityData.scopeValue || 0;
        
        // 🎯 GRID ACTIVITIES: Calculate scope from grid configuration
        if (scopeValue === 0 && activityData.moduleConfig?.gridConfig) {
          const gridConfig = activityData.moduleConfig.gridConfig;
          if (gridConfig.flexibleColumns && gridConfig.flexibleColumns.length > 0) {
            const totalCells = gridConfig.flexibleColumns.reduce((sum: number, col: any) => sum + (col.rows || 0), 0);
            const perCellValue = gridConfig.scopeValue || 1;
            scopeValue = totalCells * perCellValue;
            console.log('📐 GRID ACTIVITY (calculateSiteProgress) - Calculated scope:', totalCells, 'cells ×', perCellValue, '=', scopeValue);
          }
        }
        
        const scopeApproved = activityData.scopeApproved || false;
        const supervisorInputValue = activityData.completedToday || activityData.supervisorInputValue || 0;
        const isHandoff = activityData.cablingHandoff || activityData.terminationHandoff;
        
        console.log('📊   Activity:', activityDoc.id, '| name:', activityData.name, '| mainMenu:', mainMenu, '| scope:', scopeValue, '| approved:', scopeApproved, '| handoff:', isHandoff);
        
        if (!isHandoff && scopeValue > 0 && activityDataByMenu[mainMenu]) {
          const progressEntriesRef = collection(db, 'activities', activityDoc.id, 'progressEntries');
          const progressSnap = await getDocs(progressEntriesRef);
          
          console.log('📊     ✓ Activity qualifies! Fetching progress entries...');
          console.log('📊     Found', progressSnap.docs.length, 'progress entries');
          
          let completed = 0;
          if (!progressSnap.empty) {
            completed = progressSnap.docs.reduce((sum, entry) => {
              const entryData = entry.data();
              const val = entryData.value || 0;
              console.log('📊       Entry value:', val);
              return sum + val;
            }, 0);
          } else {
            completed = activityData.completedToday || 0;
            console.log('📊       Using completedToday:', completed);
          }
          
          activityDataByMenu[mainMenu].completed += completed;
          activityDataByMenu[mainMenu].unverifiedCompleted += supervisorInputValue;
          activityDataByMenu[mainMenu].scope += scopeValue;
          
          let unit = 'units';
          if (typeof activityData.unit === 'string') {
            unit = activityData.unit;
          } else if (activityData.unit && typeof activityData.unit === 'object' && 'canonical' in activityData.unit) {
            unit = String(activityData.unit.canonical || 'units');
          }
          if (activityDataByMenu[mainMenu].unit === 'units' || unit !== 'units') {
            activityDataByMenu[mainMenu].unit = unit;
          }
          activityDataByMenu[mainMenu].count += 1;
          
          console.log(`📊     ✅ ${mainMenu.toUpperCase()}: +${completed}/${supervisorInputValue}/${scopeValue} (TOTAL NOW: QC ${activityDataByMenu[mainMenu].completed} | Unverified ${activityDataByMenu[mainMenu].unverifiedCompleted} | Scope ${activityDataByMenu[mainMenu].scope})`);
        }
      }
    }
    
    const activities: ActivityProgress[] = allMainMenuKeys.map(menu => {
      const data = activityDataByMenu[menu.key];
      const progressPercent = data.scope > 0 ? (data.completed / data.scope) * 100 : 0;
      const unverifiedProgressPercent = data.scope > 0 ? (data.unverifiedCompleted / data.scope) * 100 : 0;
      
      return {
        title: menu.name,
        progressPercent,
        unverifiedProgressPercent,
        completed: data.completed,
        unverifiedCompleted: data.unverifiedCompleted,
        totalScope: data.scope,
        unit: data.unit,
        mainMenu: menu.key,
      };
    });
    
    let totalCompleted = 0;
    let totalUnverifiedCompleted = 0;
    let totalScope = 0;
    for (const activity of activities) {
      totalCompleted += activity.completed;
      totalUnverifiedCompleted += activity.unverifiedCompleted;
      totalScope += activity.totalScope;
    }
    
    const totalProgressPercent = totalScope > 0 ? (totalCompleted / totalScope) * 100 : 0;
    const unverifiedProgressPercent = totalScope > 0 ? (totalUnverifiedCompleted / totalScope) * 100 : 0;
    
    console.log('📊 ==============================================');
    console.log('📊 calculateSiteProgress - FINAL RESULT:');
    console.log('📊 QC Verified Progress:', totalProgressPercent.toFixed(2) + '%');
    console.log('📊 Unverified Progress:', unverifiedProgressPercent.toFixed(2) + '%');
    console.log('📊 Total QC Completed:', totalCompleted);
    console.log('📊 Total Unverified Completed:', totalUnverifiedCompleted);
    console.log('📊 Total Scope:', totalScope);
    console.log('📊 Activities:');
    activities.forEach(a => {
      console.log(`📊   - ${a.title}: QC ${a.progressPercent.toFixed(1)}% | Unverified ${a.unverifiedProgressPercent.toFixed(1)}% (${a.completed}/${a.unverifiedCompleted}/${a.totalScope} ${a.unit})`);
    });
    console.log('📊 ==============================================');
    
    return {
      totalProgressPercent,
      unverifiedProgressPercent,
      totalCompleted,
      unverifiedCompleted: totalUnverifiedCompleted,
      totalScope,
      activities,
    };
  } catch (error) {
    console.error('❌ calculateSiteProgress - ERROR:', error);
    
    return {
      totalProgressPercent: 0,
      unverifiedProgressPercent: 0,
      totalCompleted: 0,
      unverifiedCompleted: 0,
      totalScope: 0,
      activities: [],
    };
  }
}
