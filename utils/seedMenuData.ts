import { collection, doc, Timestamp, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { mainMenuItems, subMenuActivities } from '@/constants/activities';

type MenuLevel = 'main' | 'sub' | 'activity';

type MenuItem = {
  id: string;
  siteId: string;
  masterAccountId: string;
  level: MenuLevel;
  name: string;
  parentMainMenuId?: string;
  parentSubMenuId?: string;
  sortOrder: number;
  createdAt: any;
};

const subMenuMap: Record<string, string> = {
  'mv-cable-trench': 'trenching',
  'dc-cable-trench': 'trenching',
  'lv-cable-trench': 'trenching',
  'road-crossings': 'trenching',
  'mv-cable': 'cabling',
  'dc-cable': 'cabling',
  'lv-cable': 'cabling',
  'earthing': 'cabling',
  'dc-terminations': 'terminations',
  'lv-terminations': 'terminations',
  'mv-terminations': 'terminations',
  'inverter-stations': 'inverters',
  'inverter-installations': 'inverters',
  'pile-drilling': 'drilling',
  'foundation-drilling': 'drilling',
  'cable-drilling': 'drilling',
  'foundation': 'mechanical',
  'torque-tightening': 'mechanical',
  'module-installation': 'mechanical',
  'tracker-assembly': 'mechanical',
  'functional-testing': 'commissioning',
  'performance-testing': 'commissioning',
  'safety-compliance': 'commissioning',
};

const subMenuDisplayNames: Record<string, string> = {
  'mv-cable-trench': 'MV Cable Trench',
  'dc-cable-trench': 'DC Cable Trench',
  'lv-cable-trench': 'LV Cable Trench',
  'road-crossings': 'Road Crossings',
  'mv-cable': 'MV Cable',
  'dc-cable': 'DC Cable',
  'lv-cable': 'LV Cable',
  'earthing': 'Earthing',
  'dc-terminations': 'DC Terminations',
  'lv-terminations': 'LV Terminations',
  'mv-terminations': 'MV Terminations',
  'inverter-stations': 'Inverter Stations',
  'inverter-installations': 'Inverter Installations',
  'pile-drilling': 'Pile Drilling',
  'foundation-drilling': 'Foundation Drilling',
  'cable-drilling': 'Cable Drilling',
  'foundation': 'Foundation',
  'torque-tightening': 'Torque Tightening',
  'module-installation': 'Module Installation',
  'tracker-assembly': 'Tracker Assembly',
  'functional-testing': 'Functional Testing',
  'performance-testing': 'Performance Testing',
  'safety-compliance': 'Safety Compliance',
};

export async function seedMenuData(siteId: string, masterAccountId: string): Promise<void> {
  console.log('🌱 Starting menu data seeding...');
  console.log(`   Site ID: ${siteId}`);
  console.log(`   Master Account ID: ${masterAccountId}`);
  
  const menusRef = collection(db, 'menuItems');
  const existingQuery = query(menusRef, where('siteId', '==', siteId));
  const existingSnapshot = await getDocs(existingQuery);
  
  if (!existingSnapshot.empty) {
    console.log(`⚠️  Found ${existingSnapshot.size} existing menu items for this site`);
    console.log('   This operation will ADD new items (not replace existing ones)');
  }
  
  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let operationCount = 0;
  const maxOperationsPerBatch = 500;
  
  const mainMenuIdMap: Record<string, string> = {};
  const subMenuIdMap: Record<string, string> = {};
  
  console.log('\n📋 Creating main menus...');
  for (let i = 0; i < mainMenuItems.length; i++) {
    const mainMenuItem = mainMenuItems[i];
    const mainMenuRef = doc(collection(db, 'menuItems'));
    const mainMenuId = mainMenuRef.id;
    mainMenuIdMap[mainMenuItem.id] = mainMenuId;
    
    const menuItem: MenuItem = {
      id: mainMenuId,
      siteId,
      masterAccountId,
      level: 'main',
      name: mainMenuItem.name.toUpperCase(),
      sortOrder: i + 1,
      createdAt: Timestamp.now(),
    };
    
    currentBatch.set(mainMenuRef, menuItem);
    operationCount++;
    console.log(`   ✓ ${mainMenuItem.name}`);
    
    if (operationCount >= maxOperationsPerBatch) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      operationCount = 0;
    }
  }
  
  console.log('\n📂 Creating sub menus...');
  const subMenuKeys = Object.keys(subMenuActivities);
  for (let i = 0; i < subMenuKeys.length; i++) {
    const subMenuKey = subMenuKeys[i];
    const parentMainMenuKey = subMenuMap[subMenuKey];
    
    if (!parentMainMenuKey) {
      console.log(`   ⚠️  Skipping ${subMenuKey} - no parent main menu mapping`);
      continue;
    }
    
    const parentMainMenuId = mainMenuIdMap[parentMainMenuKey];
    if (!parentMainMenuId) {
      console.log(`   ⚠️  Skipping ${subMenuKey} - parent main menu not found`);
      continue;
    }
    
    const subMenuRef = doc(collection(db, 'menuItems'));
    const subMenuId = subMenuRef.id;
    subMenuIdMap[subMenuKey] = subMenuId;
    
    const displayName = subMenuDisplayNames[subMenuKey] || subMenuKey;
    
    const menuItem: MenuItem = {
      id: subMenuId,
      siteId,
      masterAccountId,
      level: 'sub',
      name: displayName.toUpperCase(),
      parentMainMenuId: parentMainMenuId,
      sortOrder: i + 1,
      createdAt: Timestamp.now(),
    };
    
    currentBatch.set(subMenuRef, menuItem);
    operationCount++;
    console.log(`   ✓ ${displayName} → ${mainMenuItems.find(m => m.id === parentMainMenuKey)?.name}`);
    
    if (operationCount >= maxOperationsPerBatch) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      operationCount = 0;
    }
  }
  
  console.log('\n🎯 Creating activities...');
  let totalActivities = 0;
  for (const subMenuKey of subMenuKeys) {
    const activities = subMenuActivities[subMenuKey];
    const subMenuId = subMenuIdMap[subMenuKey];
    
    if (!subMenuId) {
      console.log(`   ⚠️  Skipping activities for ${subMenuKey} - sub menu not created`);
      continue;
    }
    
    const parentMainMenuKey = subMenuMap[subMenuKey];
    const parentMainMenuId = mainMenuIdMap[parentMainMenuKey];
    
    console.log(`\n   ${subMenuDisplayNames[subMenuKey] || subMenuKey}:`);
    
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      const activityRef = doc(collection(db, 'menuItems'));
      
      const menuItem: MenuItem = {
        id: activityRef.id,
        siteId,
        masterAccountId,
        level: 'activity',
        name: activity.name.toUpperCase(),
        parentMainMenuId: parentMainMenuId,
        parentSubMenuId: subMenuId,
        sortOrder: i + 1,
        createdAt: Timestamp.now(),
      };
      
      currentBatch.set(activityRef, menuItem);
      operationCount++;
      totalActivities++;
      console.log(`     ✓ ${activity.name}`);
      
      if (operationCount >= maxOperationsPerBatch) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        operationCount = 0;
      }
    }
  }
  
  if (operationCount > 0) {
    batches.push(currentBatch);
  }
  
  console.log('\n💾 Committing batches to Firebase...');
  for (let i = 0; i < batches.length; i++) {
    console.log(`   Batch ${i + 1}/${batches.length}...`);
    await batches[i].commit();
  }
  
  console.log('\n✅ Menu data seeding completed!');
  console.log(`   Main Menus: ${mainMenuItems.length}`);
  console.log(`   Sub Menus: ${Object.keys(subMenuIdMap).length}`);
  console.log(`   Activities: ${totalActivities}`);
  console.log(`   Total Items: ${mainMenuItems.length + Object.keys(subMenuIdMap).length + totalActivities}`);
}

export async function checkExistingMenus(siteId: string): Promise<number> {
  const menusRef = collection(db, 'menuItems');
  const existingQuery = query(menusRef, where('siteId', '==', siteId));
  const existingSnapshot = await getDocs(existingQuery);
  return existingSnapshot.size;
}
