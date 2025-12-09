/**
 * Site Isolation Diagnostic Script
 * 
 * This script helps diagnose site isolation issues by checking all collections
 * and identifying records that may be incorrectly associated with sites.
 * 
 * Run this in the browser console or as a one-time util to diagnose issues.
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function diagnoseSiteIsolation() {
  console.log('=== STARTING SITE ISOLATION DIAGNOSTIC ===\n');

  // Collections that should be site-isolated
  const collections = [
    'subcontractors',
    'employees', 
    'plantAssets',
    'pvAreas',
    'blockAreas',
    'menuItems',
    'tasks',
    'clockLogs',
    'faceEnrollments',
    'qcRequests',
    'cablingRequests',
    'terminationRequests',
    'surveyorRequests',
    'plannerRequests',
    'activityRequests',
    'scopeRequests',
    'staffAllocationRequests',
    'plantAllocationRequests',
    'handovers',
    'materialsRequests'
  ];

  const results: Record<string, any> = {};

  for (const collectionName of collections) {
    console.log(`\n📋 Checking collection: ${collectionName}`);
    console.log('─'.repeat(50));

    try {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      
      const siteGroups: Record<string, number> = {};
      const noSiteId: any[] = [];
      const allRecords: any[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const record = { id: doc.id, ...data };
        allRecords.push(record);

        if (!data.siteId || data.siteId === '') {
          noSiteId.push({ id: doc.id, ...data });
        } else {
          siteGroups[data.siteId] = (siteGroups[data.siteId] || 0) + 1;
        }
      });

      results[collectionName] = {
        total: allRecords.length,
        siteGroups,
        noSiteId: noSiteId.length,
        noSiteIdRecords: noSiteId,
        allRecords
      };

      console.log(`Total records: ${allRecords.length}`);
      console.log(`Records without siteId: ${noSiteId.length}`);
      console.log('\nRecords grouped by siteId:');
      Object.entries(siteGroups).forEach(([siteId, count]) => {
        console.log(`  - ${siteId}: ${count} records`);
      });

      if (noSiteId.length > 0) {
        console.log('\n⚠️  Records without siteId:');
        noSiteId.forEach((record, index) => {
          console.log(`  ${index + 1}. ID: ${record.id}`);
          if (record.name) console.log(`     Name: ${record.name}`);
          if (record.type) console.log(`     Type: ${record.type}`);
          console.log(`     masterAccountId: ${record.masterAccountId || 'MISSING'}`);
        });
      }

    } catch (error) {
      console.error(`❌ Error checking ${collectionName}:`, error);
      results[collectionName] = { error: String(error) };
    }
  }

  console.log('\n\n=== DIAGNOSTIC SUMMARY ===\n');
  
  let totalIssues = 0;
  Object.entries(results).forEach(([collectionName, data]) => {
    if ('error' in data) {
      console.log(`❌ ${collectionName}: Error - ${data.error}`);
    } else {
      const issues = data.noSiteId;
      totalIssues += issues;
      
      if (issues > 0) {
        console.log(`⚠️  ${collectionName}: ${issues} records without siteId`);
      } else {
        console.log(`✅ ${collectionName}: All records have siteId`);
      }
    }
  });

  if (totalIssues > 0) {
    console.log(`\n⚠️  TOTAL ISSUES FOUND: ${totalIssues} records without proper site isolation`);
    console.log('\n📝 Next Steps:');
    console.log('1. Review the records listed above');
    console.log('2. Identify which site each record should belong to');
    console.log('3. Run the cleanup script to fix these records');
  } else {
    console.log('\n✅ No issues found! All records are properly isolated by site.');
  }

  console.log('\n=== END OF DIAGNOSTIC ===\n');
  
  return results;
}

// Helper function to get unique masterAccountIds
export function getUniqueMasterAccounts(results: Record<string, any>) {
  const masterAccounts = new Set<string>();
  
  Object.values(results).forEach((data: any) => {
    if (data.allRecords) {
      data.allRecords.forEach((record: any) => {
        if (record.masterAccountId) {
          masterAccounts.add(record.masterAccountId);
        }
      });
    }
  });
  
  return Array.from(masterAccounts);
}

// Helper to show distribution of records across sites
export function showSiteDistribution(results: Record<string, any>) {
  console.log('\n=== SITE DISTRIBUTION ANALYSIS ===\n');
  
  const allSites = new Set<string>();
  Object.values(results).forEach((data: any) => {
    if (data.siteGroups) {
      Object.keys(data.siteGroups).forEach(siteId => allSites.add(siteId));
    }
  });

  console.log(`Total unique sites found: ${allSites.size}\n`);
  
  allSites.forEach(siteId => {
    console.log(`\n📍 Site: ${siteId}`);
    console.log('─'.repeat(40));
    
    Object.entries(results).forEach(([collectionName, data]: [string, any]) => {
      if (data.siteGroups && data.siteGroups[siteId]) {
        console.log(`  ${collectionName}: ${data.siteGroups[siteId]} records`);
      }
    });
  });
}
