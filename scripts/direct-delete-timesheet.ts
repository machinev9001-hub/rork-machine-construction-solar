import { initializeApp } from 'firebase/app';
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
  initializeFirestore
} from 'firebase/firestore';
import * as dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBMhp3eYWbouy3a9xdp8fhDrNAuFDCsVpQ',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'project-tracker-app-33cff.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'project-tracker-app-33cff',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'project-tracker-app-33cff.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '235534188025',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:235534188025:web:b7c49ea0c361988cf41128',
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});

async function deleteTimesheets() {
  console.log('🔍 Finding plant assets with timesheets...\n');

  try {
    // Get ALL plantAssets (no filters)
    console.log('1️⃣ Fetching all plantAssets...');
    const plantAssetsRef = collection(db, 'plantAssets');
    const snapshot = await getDocs(plantAssetsRef);
    
    console.log(`   Found ${snapshot.size} plant assets\n`);

    let totalTimesheets = 0;
    let totalDeleted = 0;

    // For each plant asset
    for (const plantDoc of snapshot.docs) {
      const plantAssetId = plantDoc.id;
      const plantData = plantDoc.data();
      
      console.log(`\n📦 Plant Asset: ${plantAssetId}`);
      console.log(`   Type: ${plantData.type || 'N/A'}`);
      console.log(`   Plant Number: ${plantData.plantNumber || 'N/A'}`);
      
      // Check for timesheets subcollection
      const timesheetsRef = collection(db, 'plantAssets', plantAssetId, 'timesheets');
      
      try {
        const timesheetsSnapshot = await getDocs(timesheetsRef);
        
        if (timesheetsSnapshot.size > 0) {
          console.log(`   ✅ Found ${timesheetsSnapshot.size} timesheets!`);
          totalTimesheets += timesheetsSnapshot.size;

          // Show timesheet details
          timesheetsSnapshot.docs.forEach((timesheetDoc, index) => {
            const data = timesheetDoc.data();
            console.log(`      ${index + 1}. ID: ${timesheetDoc.id}`);
            console.log(`         Date: ${data.date || 'N/A'}`);
            console.log(`         Hours: ${data.hours || 'N/A'}`);
            console.log(`         Operator: ${data.operatorName || 'N/A'}`);
          });

          // Delete all timesheets for this asset
          console.log(`   🗑️  Deleting ${timesheetsSnapshot.size} timesheets...`);
          for (const timesheetDoc of timesheetsSnapshot.docs) {
            await deleteDoc(doc(db, 'plantAssets', plantAssetId, 'timesheets', timesheetDoc.id));
            totalDeleted++;
          }
          console.log(`   ✅ Deleted successfully!`);
        } else {
          console.log(`   No timesheets found`);
        }
      } catch (error: any) {
        console.error(`   ❌ Error checking timesheets:`, error.message);
      }
    }

    console.log(`\n\n📊 SUMMARY:`);
    console.log(`   Total plant assets checked: ${snapshot.size}`);
    console.log(`   Total timesheets found: ${totalTimesheets}`);
    console.log(`   Total timesheets deleted: ${totalDeleted}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

deleteTimesheets()
  .then(() => {
    console.log('\n✅ Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed');
    process.exit(1);
  });
