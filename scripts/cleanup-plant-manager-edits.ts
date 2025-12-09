import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';

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

async function cleanupPlantManagerEdits() {
  console.log('🧹 Starting cleanup of plant manager edit entries...\n');

  let totalDeleted = 0;
  let totalUpdated = 0;

  console.log('📋 Step 1: Cleaning up Man Hours adjustments (operatorTimesheets)...');
  
  // Get all documents and filter in memory (no index needed)
  const manHoursSnapshot = await getDocs(collection(db, 'operatorTimesheets'));
  const adjustmentDocs = manHoursSnapshot.docs.filter(doc => doc.data().isAdjustment === true);
  console.log(`Found ${adjustmentDocs.length} man hours adjustment entries out of ${manHoursSnapshot.size} total`);
  
  for (const adjustmentDoc of adjustmentDocs) {
    const data = adjustmentDoc.data();
    console.log(`  Deleting adjustment ${adjustmentDoc.id} for ${data.operatorName} on ${data.date}`);
    
    await deleteDoc(doc(db, 'operatorTimesheets', adjustmentDoc.id));
    
    if (data.originalEntryId) {
      console.log(`  Clearing adjustment flags on original entry ${data.originalEntryId}`);
      try {
        await updateDoc(doc(db, 'operatorTimesheets', data.originalEntryId), {
          hasAdjustment: false,
          adjustmentId: null
        });
        totalUpdated++;
      } catch {
        console.log(`  ⚠️ Could not update original entry (might not exist)`);
      }
    }
    
    totalDeleted++;
  }

  console.log('\n📋 Step 2: Cleaning up Plant Hours adjustments (plantAssets/*/timesheets subcollections)...');
  
  // First get all plant assets
  const plantAssetsSnapshot = await getDocs(collection(db, 'plantAssets'));
  console.log(`Found ${plantAssetsSnapshot.size} plant assets to scan`);
  
  for (const plantAssetDoc of plantAssetsSnapshot.docs) {
    const plantAssetId = plantAssetDoc.id;
    const plantAssetData = plantAssetDoc.data();
    console.log(`\n  Scanning Plant Asset: ${plantAssetData.assetName || plantAssetId}`);
    
    // Get all timesheets and filter in memory (no index needed)
    const timesheetsSnapshot = await getDocs(
      collection(db, 'plantAssets', plantAssetId, 'timesheets')
    );
    
    const adjustmentDocs = timesheetsSnapshot.docs.filter(doc => doc.data().isAdjustment === true);
    
    if (adjustmentDocs.length > 0) {
      console.log(`    Found ${adjustmentDocs.length} adjustment entries out of ${timesheetsSnapshot.size} total`);
      
      for (const adjustmentDoc of adjustmentDocs) {
        const data = adjustmentDoc.data();
        console.log(`    Deleting adjustment ${adjustmentDoc.id} for ${data.operatorName || 'Unknown'} on ${data.date}`);
        
        await deleteDoc(doc(db, 'plantAssets', plantAssetId, 'timesheets', adjustmentDoc.id));
        
        if (data.originalEntryId) {
          console.log(`    Clearing adjustment flags on original entry ${data.originalEntryId}`);
          try {
            await updateDoc(doc(db, 'plantAssets', plantAssetId, 'timesheets', data.originalEntryId), {
              hasAdjustment: false,
              adjustmentId: null
            });
            totalUpdated++;
          } catch {
            console.log(`    ⚠️ Could not update original entry (might not exist)`);
          }
        }
        
        totalDeleted++;
      }
    }
  }

  console.log('\n✅ Cleanup complete!');
  console.log(`   Deleted: ${totalDeleted} adjustment entries`);
  console.log(`   Updated: ${totalUpdated} original entries (cleared adjustment flags)`);
}

cleanupPlantManagerEdits()
  .then(() => {
    console.log('\n🎉 All done!');
  })
  .catch((error) => {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  });
