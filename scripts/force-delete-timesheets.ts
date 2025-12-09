import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function forceDeleteAllTimesheets(masterAccountId: string, siteId: string) {
  console.log('[ForceDelete] Starting deletion process...');
  console.log(`[ForceDelete] Master Account: ${masterAccountId}`);
  console.log(`[ForceDelete] Site: ${siteId}`);
  
  let totalDeleted = 0;

  try {
    console.log('\n[ForceDelete] Step 1: Deleting operator timesheets...');
    const operatorQuery = query(
      collection(db, 'operatorTimesheets'),
      where('masterAccountId', '==', masterAccountId),
      where('siteId', '==', siteId)
    );
    
    const operatorSnapshot = await getDocs(operatorQuery);
    console.log(`[ForceDelete] Found ${operatorSnapshot.size} operator timesheet documents`);
    
    for (const docSnapshot of operatorSnapshot.docs) {
      await deleteDoc(doc(db, 'operatorTimesheets', docSnapshot.id));
      totalDeleted++;
      console.log(`[ForceDelete] Deleted operator timesheet: ${docSnapshot.id}`);
    }

    console.log('\n[ForceDelete] Step 2: Deleting plant asset timesheets...');
    const assetsQuery = query(
      collection(db, 'plantAssets'),
      where('masterAccountId', '==', masterAccountId),
      where('siteId', '==', siteId)
    );
    
    const assetsSnapshot = await getDocs(assetsQuery);
    console.log(`[ForceDelete] Found ${assetsSnapshot.size} plant assets`);
    
    for (const assetDoc of assetsSnapshot.docs) {
      const timesheetsRef = collection(db, 'plantAssets', assetDoc.id, 'timesheets');
      const timesheetsSnapshot = await getDocs(timesheetsRef);
      
      console.log(`[ForceDelete] Asset ${assetDoc.id}: Found ${timesheetsSnapshot.size} timesheets`);
      
      for (const timesheetDoc of timesheetsSnapshot.docs) {
        await deleteDoc(doc(db, 'plantAssets', assetDoc.id, 'timesheets', timesheetDoc.id));
        totalDeleted++;
        console.log(`[ForceDelete] Deleted plant timesheet: ${timesheetDoc.id}`);
      }
    }

    console.log(`\n[ForceDelete] ✅ SUCCESS: Deleted ${totalDeleted} total timesheet documents`);
    console.log('[ForceDelete] All timesheets cleared from database');
    
  } catch (error) {
    console.error('[ForceDelete] ❌ ERROR:', error);
    throw error;
  }
}

const masterAccountId = process.argv[2];
const siteId = process.argv[3];

if (!masterAccountId || !siteId) {
  console.error('Usage: bun run scripts/force-delete-timesheets.ts <masterAccountId> <siteId>');
  console.error('Example: bun run scripts/force-delete-timesheets.ts abc123 site456');
  process.exit(1);
}

forceDeleteAllTimesheets(masterAccountId, siteId)
  .then(() => {
    console.log('\n[ForceDelete] Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[ForceDelete] Script failed:', error);
    process.exit(1);
  });
