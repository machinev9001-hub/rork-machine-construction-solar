import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function checkAdjustmentData() {
  console.log('🔍 Checking for adjustment-related data...\n');

  console.log('1️⃣ Checking operatorTimesheets collection:');
  const manHoursSnapshot = await getDocs(collection(db, 'operatorTimesheets'));
  
  const withIsAdjustment = manHoursSnapshot.docs.filter(d => d.data().isAdjustment === true);
  const withHasAdjustment = manHoursSnapshot.docs.filter(d => d.data().hasAdjustment === true);
  const withAdjustmentId = manHoursSnapshot.docs.filter(d => d.data().adjustmentId);
  
  console.log(`   Total entries: ${manHoursSnapshot.size}`);
  console.log(`   With isAdjustment=true: ${withIsAdjustment.length}`);
  console.log(`   With hasAdjustment=true: ${withHasAdjustment.length}`);
  console.log(`   With adjustmentId: ${withAdjustmentId.length}`);
  
  if (withIsAdjustment.length > 0) {
    console.log('\n   Entries with isAdjustment=true:');
    withIsAdjustment.slice(0, 5).forEach(d => {
      const data = d.data();
      console.log(`   - ${d.id}: ${data.operatorName} on ${data.date}`);
    });
  }

  console.log('\n2️⃣ Checking plantAssets timesheets subcollections:');
  const plantAssetsSnapshot = await getDocs(collection(db, 'plantAssets'));
  console.log(`   Found ${plantAssetsSnapshot.size} plant assets`);
  
  let totalTimesheets = 0;
  let totalWithIsAdjustment = 0;
  let totalWithHasAdjustment = 0;
  
  for (const plantDoc of plantAssetsSnapshot.docs) {
    const timesheetsSnapshot = await getDocs(
      collection(db, 'plantAssets', plantDoc.id, 'timesheets')
    );
    
    totalTimesheets += timesheetsSnapshot.size;
    const withIsAdj = timesheetsSnapshot.docs.filter(d => d.data().isAdjustment === true);
    const withHasAdj = timesheetsSnapshot.docs.filter(d => d.data().hasAdjustment === true);
    
    totalWithIsAdjustment += withIsAdj.length;
    totalWithHasAdjustment += withHasAdj.length;
    
    if (withIsAdj.length > 0 || withHasAdj.length > 0) {
      console.log(`\n   Asset ${plantDoc.id}:`);
      console.log(`     Total timesheets: ${timesheetsSnapshot.size}`);
      console.log(`     isAdjustment=true: ${withIsAdj.length}`);
      console.log(`     hasAdjustment=true: ${withHasAdj.length}`);
    }
  }
  
  console.log(`\n   Total timesheets across all assets: ${totalTimesheets}`);
  console.log(`   With isAdjustment=true: ${totalWithIsAdjustment}`);
  console.log(`   With hasAdjustment=true: ${totalWithHasAdjustment}`);
  
  console.log('\n✅ Diagnostic complete!');
}

checkAdjustmentData()
  .then(() => console.log('\n🎉 Done!'))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    throw error;
  });
