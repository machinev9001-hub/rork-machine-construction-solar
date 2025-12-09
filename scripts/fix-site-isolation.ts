/**
 * Site Isolation Fix Script
 * 
 * This script fixes site isolation issues by adding siteId to records that are missing it.
 * It handles two main cases:
 * 1. Subcontractors without siteId - assigns to masterAccount's sites
 * 2. Activities (menuItems) without siteId - assigns based on masterAccountId
 */

import { collection, getDocs, doc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

export type FixResult = {
  collection: string;
  totalFixed: number;
  errors: string[];
};

/**
 * Fix subcontractors without siteId
 * Strategy: Assign to a specific siteId (provided by user)
 */
export async function fixSubcontractorsIsolation(
  targetSiteId: string,
  masterAccountId: string
): Promise<FixResult> {
  console.log('[FixSiteIsolation] Fixing subcontractors...');
  
  const result: FixResult = {
    collection: 'subcontractors',
    totalFixed: 0,
    errors: [],
  };

  try {
    const subcontractorsRef = collection(db, 'subcontractors');
    const q = query(
      subcontractorsRef,
      where('masterAccountId', '==', masterAccountId)
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      if (!data.siteId || data.siteId === '') {
        console.log(`  Fixing subcontractor: ${docSnapshot.id} (${data.name || 'Unknown'})`);
        
        const docRef = doc(db, 'subcontractors', docSnapshot.id);
        batch.update(docRef, {
          siteId: targetSiteId,
        });
        
        batchCount++;
        result.totalFixed++;

        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`[FixSiteIsolation] Fixed ${result.totalFixed} subcontractors`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[FixSiteIsolation] Error fixing subcontractors:', errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Fix activities (menuItems) without siteId
 * Strategy: Assign to a specific siteId (provided by user)
 */
export async function fixActivitiesIsolation(
  targetSiteId: string,
  masterAccountId: string
): Promise<FixResult> {
  console.log('[FixSiteIsolation] Fixing activities (menuItems)...');
  
  const result: FixResult = {
    collection: 'activities (menuItems)',
    totalFixed: 0,
    errors: [],
  };

  try {
    const menuItemsRef = collection(db, 'menuItems');
    const q = query(
      menuItemsRef,
      where('masterAccountId', '==', masterAccountId)
    );
    const snapshot = await getDocs(q);

    const batches = [];
    let currentBatch = writeBatch(db);
    let batchCount = 0;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      if (!data.siteId || data.siteId === '') {
        console.log(`  Fixing activity: ${docSnapshot.id} (${data.name || 'Unknown'})`);
        
        const docRef = doc(db, 'menuItems', docSnapshot.id);
        currentBatch.update(docRef, {
          siteId: targetSiteId,
        });
        
        batchCount++;
        result.totalFixed++;

        if (batchCount >= 500) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      batches.push(currentBatch);
    }

    for (let i = 0; i < batches.length; i++) {
      console.log(`  Committing batch ${i + 1}/${batches.length}...`);
      await batches[i].commit();
    }

    console.log(`[FixSiteIsolation] Fixed ${result.totalFixed} activities`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[FixSiteIsolation] Error fixing activities:', errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Fix all site isolation issues for a given siteId and masterAccountId
 */
export async function fixAllSiteIsolationIssues(
  targetSiteId: string,
  masterAccountId: string
): Promise<FixResult[]> {
  console.log('\n=== STARTING SITE ISOLATION FIX ===');
  console.log(`Target Site ID: ${targetSiteId}`);
  console.log(`Master Account ID: ${masterAccountId}\n`);

  const results: FixResult[] = [];

  const subcontractorsResult = await fixSubcontractorsIsolation(targetSiteId, masterAccountId);
  results.push(subcontractorsResult);

  const activitiesResult = await fixActivitiesIsolation(targetSiteId, masterAccountId);
  results.push(activitiesResult);

  console.log('\n=== FIX SUMMARY ===');
  let totalFixed = 0;
  let totalErrors = 0;

  results.forEach((result) => {
    console.log(`\n${result.collection}:`);
    console.log(`  ✓ Fixed: ${result.totalFixed} records`);
    
    if (result.errors.length > 0) {
      console.log(`  ✗ Errors: ${result.errors.length}`);
      result.errors.forEach((error) => {
        console.log(`    - ${error}`);
      });
    }

    totalFixed += result.totalFixed;
    totalErrors += result.errors.length;
  });

  console.log(`\n📊 Overall:`);
  console.log(`  Total Fixed: ${totalFixed}`);
  console.log(`  Total Errors: ${totalErrors}`);
  
  if (totalErrors === 0) {
    console.log('\n✅ All issues fixed successfully!');
  } else {
    console.log('\n⚠️  Some errors occurred during the fix.');
  }

  console.log('\n=== END OF FIX ===\n');

  return results;
}

/**
 * Delete records that don't belong to the current site
 * USE WITH CAUTION - This permanently deletes data
 */
export async function deleteRecordsNotBelongingToSite(
  currentSiteId: string,
  masterAccountId: string,
  collectionName: string
): Promise<{ deleted: number; errors: string[] }> {
  console.log(`[FixSiteIsolation] WARNING: Deleting records from ${collectionName} that don't belong to site ${currentSiteId}...`);
  
  const result = {
    deleted: 0,
    errors: [] as string[],
  };

  try {
    const collectionRef = collection(db, collectionName);
    const q = query(
      collectionRef,
      where('masterAccountId', '==', masterAccountId)
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      if (data.siteId && data.siteId !== currentSiteId) {
        console.log(`  Deleting ${collectionName} record: ${docSnapshot.id} (belongs to site ${data.siteId})`);
        
        const docRef = doc(db, collectionName, docSnapshot.id);
        batch.delete(docRef);
        
        batchCount++;
        result.deleted++;

        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`[FixSiteIsolation] Deleted ${result.deleted} records from ${collectionName}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[FixSiteIsolation] Error deleting from ${collectionName}:`, errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}
