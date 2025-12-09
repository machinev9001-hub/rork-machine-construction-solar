import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, query, where, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteDuplicateTimesheets() {
  console.log('🗑️  Deleting duplicate plant hours timesheets...\n');

  const plantAssetId = '8R7tg8q2GIZXELBrk5tE';
  
  try {
    console.log(`📋 Checking plant asset: ${plantAssetId}`);
    
    const timesheetsRef = collection(db, 'plantAssets', plantAssetId, 'timesheets');
    const snapshot = await getDocs(timesheetsRef);
    
    console.log(`   Found ${snapshot.size} timesheet entries\n`);
    
    if (snapshot.size === 0) {
      console.log('❌ No timesheet entries found. The subcollection might not exist or is empty.');
      return;
    }

    const entries = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));

    entries.sort((a, b) => {
      const dateA = a.data.date?.toDate?.() || new Date(a.data.date);
      const dateB = b.data.date?.toDate?.() || new Date(b.data.date);
      return dateA - dateB;
    });

    console.log('📊 All timesheet entries:');
    entries.forEach((entry, index) => {
      const date = entry.data.date?.toDate?.() || new Date(entry.data.date);
      console.log(`   ${index + 1}. ID: ${entry.id}`);
      console.log(`      Date: ${date.toLocaleDateString()}`);
      console.log(`      Hours: ${entry.data.hours || 0}`);
      console.log(`      Notes: ${entry.data.notes || 'N/A'}`);
      console.log(`      Is Adjustment: ${entry.data.isAdjustment || false}`);
      console.log(`      Has Adjustment: ${entry.data.hasAdjustment || false}`);
      console.log(`      Created By: ${entry.data.createdBy || 'N/A'}`);
      console.log(`      Updated At: ${entry.data.updatedAt?.toDate?.() || 'N/A'}`);
      console.log('');
    });

    const duplicates = entries.filter(e => 
      e.data.isAdjustment === true || 
      e.data.createdBy?.includes('adjustment') ||
      e.data.notes?.toLowerCase().includes('adjustment')
    );

    if (duplicates.length === 0) {
      console.log('⚠️  No obvious duplicates found with isAdjustment flag.');
      console.log('   If you want to delete specific entries, you can modify this script.\n');
      
      if (entries.length > 1) {
        console.log('💡 You have multiple entries. To delete the LAST entry (most recent), uncomment the code below.');
      }
      return;
    }

    console.log(`🎯 Found ${duplicates.length} duplicate entries to delete:\n`);
    
    for (const dup of duplicates) {
      const date = dup.data.date?.toDate?.() || new Date(dup.data.date);
      console.log(`   Deleting: ${dup.id} (Date: ${date.toLocaleDateString()}, Hours: ${dup.data.hours})`);
      
      await deleteDoc(doc(db, 'plantAssets', plantAssetId, 'timesheets', dup.id));
      console.log('   ✅ Deleted\n');
    }

    console.log(`✅ Successfully deleted ${duplicates.length} duplicate entries!`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

deleteDuplicateTimesheets().then(() => {
  console.log('\n🎉 Script complete!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
