import { initializeApp } from 'firebase/app';
import { collection, getDocs, deleteDoc, doc, initializeFirestore } from 'firebase/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBMhp3eYWbouy3a9xdp8fhDrNAuFDCsVpQ',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'project-tracker-app-33cff.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'project-tracker-app-33cff',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'project-tracker-app-33cff.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '235534188025',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:235534188025:web:b7c49ea0c361988cf41128',
};

console.log('🔧 Firebase Config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
});

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});

async function deleteAllTimesheets() {
  console.log('🔥 NUCLEAR OPTION: Deleting ALL timesheets from ALL plantAssets...\n');

  try {
    // Get all plantAssets
    console.log('1️⃣ Fetching all plantAssets...');
    const plantAssetsRef = collection(db, 'plantAssets');
    const plantAssetsSnapshot = await getDocs(plantAssetsRef);
    
    console.log(`   Found ${plantAssetsSnapshot.size} plant assets\n`);

    let totalDeleted = 0;

    // For each plant asset
    for (const plantAssetDoc of plantAssetsSnapshot.docs) {
      const plantAssetId = plantAssetDoc.id;
      console.log(`📦 Checking plantAsset: ${plantAssetId}`);

      // Get timesheets subcollection
      const timesheetsRef = collection(db, `plantAssets/${plantAssetId}/timesheets`);
      
      try {
        const timesheetsSnapshot = await getDocs(timesheetsRef);
        
        if (timesheetsSnapshot.size > 0) {
          console.log(`   Found ${timesheetsSnapshot.size} timesheets - DELETING...`);

          // Delete each timesheet
          for (const timesheetDoc of timesheetsSnapshot.docs) {
            await deleteDoc(doc(db, `plantAssets/${plantAssetId}/timesheets/${timesheetDoc.id}`));
            totalDeleted++;
            console.log(`   ✅ Deleted timesheet: ${timesheetDoc.id}`);
          }
        } else {
          console.log(`   No timesheets found`);
        }
      } catch (error) {
        console.error(`   ❌ Error accessing timesheets:`, error);
      }

      console.log('');
    }

    console.log(`\n🎉 Complete! Deleted ${totalDeleted} timesheet entries`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

deleteAllTimesheets()
  .then(() => {
    console.log('\n✅ Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
