import { collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Subcontractor } from '@/types';

export const addSubcontractor = async (
  subcontractorData: Omit<Subcontractor, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  createdBy: string
): Promise<string> => {
  try {
    console.log('[SubcontractorManager] Adding subcontractor:', subcontractorData.name);
    
    const subcontractorsRef = collection(db, 'subcontractors');
    
    const docRef = await addDoc(subcontractorsRef, {
      ...subcontractorData,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    console.log('[SubcontractorManager] Subcontractor added with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[SubcontractorManager] Error adding subcontractor:', error);
    throw error;
  }
};

export const updateSubcontractor = async (
  subcontractorId: string,
  updates: Partial<Subcontractor>
): Promise<void> => {
  try {
    console.log('[SubcontractorManager] Updating subcontractor:', subcontractorId);
    
    const subcontractorRef = doc(db, 'subcontractors', subcontractorId);
    
    await updateDoc(subcontractorRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    
    console.log('[SubcontractorManager] Subcontractor updated successfully');
  } catch (error) {
    console.error('[SubcontractorManager] Error updating subcontractor:', error);
    throw error;
  }
};

export const getSubcontractorsByMasterAccount = async (
  masterAccountId: string,
  status?: 'Active' | 'Inactive' | 'Archived',
  siteId?: string
): Promise<Subcontractor[]> => {
  try {
    console.log('[SubcontractorManager] Fetching subcontractors for masterAccountId:', masterAccountId, 'siteId:', siteId);
    
    const subcontractorsRef = collection(db, 'subcontractors');
    
    let q;
    
    // If siteId is provided, filter by both masterAccountId and siteId for proper site isolation
    if (siteId) {
      if (status) {
        q = query(
          subcontractorsRef,
          where('masterAccountId', '==', masterAccountId),
          where('siteId', '==', siteId),
          where('status', '==', status),
          orderBy('name', 'asc')
        );
      } else {
        q = query(
          subcontractorsRef,
          where('masterAccountId', '==', masterAccountId),
          where('siteId', '==', siteId),
          orderBy('name', 'asc')
        );
      }
    } else {
      // Fallback to master account only (legacy behavior)
      if (status) {
        q = query(
          subcontractorsRef,
          where('masterAccountId', '==', masterAccountId),
          where('status', '==', status),
          orderBy('name', 'asc')
        );
      } else {
        q = query(
          subcontractorsRef,
          where('masterAccountId', '==', masterAccountId),
          orderBy('name', 'asc')
        );
      }
    }
    
    console.log('[SubcontractorManager] Executing query...');
    const querySnapshot = await getDocs(q);
    console.log('[SubcontractorManager] Query returned', querySnapshot.size, 'documents');
    
    const subcontractors: Subcontractor[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('[SubcontractorManager] Document:', doc.id, 'siteId:', data.siteId, 'masterAccountId:', data.masterAccountId, 'name:', data.name);
      subcontractors.push({
        id: doc.id,
        ...data,
      } as Subcontractor);
    });
    
    console.log('[SubcontractorManager] Found', subcontractors.length, 'subcontractors');
    
    if (siteId && subcontractors.length === 0) {
      console.log('[SubcontractorManager] No subcontractors found with siteId filter. Checking if any exist without siteId...');
      const fallbackQuery = query(
        subcontractorsRef,
        where('masterAccountId', '==', masterAccountId),
        orderBy('name', 'asc')
      );
      const fallbackSnapshot = await getDocs(fallbackQuery);
      console.log('[SubcontractorManager] Found', fallbackSnapshot.size, 'subcontractors without siteId filter');
      if (fallbackSnapshot.size > 0) {
        console.warn('[SubcontractorManager] WARNING: Subcontractors exist but are missing siteId field!');
        fallbackSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('[SubcontractorManager] Legacy document:', doc.id, 'has siteId:', !!data.siteId, 'name:', data.name);
        });
      }
    }
    
    return subcontractors;
  } catch (error) {
    console.error('[SubcontractorManager] Error fetching subcontractors:', error);
    throw error;
  }
};

export const getActiveSubcontractorNames = async (masterAccountId: string, siteId?: string): Promise<string[]> => {
  try {
    const subcontractors = await getSubcontractorsByMasterAccount(masterAccountId, 'Active', siteId);
    return subcontractors.map((sc) => sc.name);
  } catch (error) {
    console.error('[SubcontractorManager] Error fetching active subcontractor names:', error);
    return [];
  }
};

export const getSubcontractorById = async (subcontractorId: string): Promise<Subcontractor | null> => {
  try {
    console.log('[SubcontractorManager] Fetching subcontractor by ID:', subcontractorId);
    
    const subcontractorsRef = collection(db, 'subcontractors');
    const q = query(subcontractorsRef, where('__name__', '==', subcontractorId));
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('[SubcontractorManager] Subcontractor not found');
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Subcontractor;
  } catch (error) {
    console.error('[SubcontractorManager] Error fetching subcontractor:', error);
    throw error;
  }
};

export const archiveSubcontractor = async (subcontractorId: string): Promise<void> => {
  try {
    console.log('[SubcontractorManager] Archiving subcontractor:', subcontractorId);
    await updateSubcontractor(subcontractorId, { status: 'Archived' });
    console.log('[SubcontractorManager] Subcontractor archived successfully');
  } catch (error) {
    console.error('[SubcontractorManager] Error archiving subcontractor:', error);
    throw error;
  }
};

export const activateSubcontractor = async (subcontractorId: string): Promise<void> => {
  try {
    console.log('[SubcontractorManager] Activating subcontractor:', subcontractorId);
    await updateSubcontractor(subcontractorId, { status: 'Active' });
    console.log('[SubcontractorManager] Subcontractor activated successfully');
  } catch (error) {
    console.error('[SubcontractorManager] Error activating subcontractor:', error);
    throw error;
  }
};

export const migrateSubcontractorsSiteId = async (
  masterAccountId: string,
  siteId: string
): Promise<{ total: number; updated: number; errors: number }> => {
  try {
    console.log('[SubcontractorManager] Starting migration for masterAccountId:', masterAccountId, 'siteId:', siteId);
    
    const subcontractorsRef = collection(db, 'subcontractors');
    const q = query(
      subcontractorsRef,
      where('masterAccountId', '==', masterAccountId),
      orderBy('name', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    console.log('[SubcontractorManager] Found', querySnapshot.size, 'subcontractors to check');
    
    let updated = 0;
    let errors = 0;
    const total = querySnapshot.size;
    
    for (const docSnapshot of querySnapshot.docs) {
      const data = docSnapshot.data();
      
      if (!data.siteId) {
        console.log('[SubcontractorManager] Updating subcontractor:', docSnapshot.id, data.name, 'with siteId:', siteId);
        try {
          const subcontractorRef = doc(db, 'subcontractors', docSnapshot.id);
          await updateDoc(subcontractorRef, {
            siteId: siteId,
            updatedAt: serverTimestamp(),
          });
          updated++;
          console.log('[SubcontractorManager] ✓ Updated:', data.name);
        } catch (err) {
          console.error('[SubcontractorManager] ✗ Failed to update:', data.name, err);
          errors++;
        }
      } else {
        console.log('[SubcontractorManager] - Skipping (already has siteId):', data.name, data.siteId);
      }
    }
    
    console.log('[SubcontractorManager] Migration complete. Total:', total, 'Updated:', updated, 'Errors:', errors);
    return { total, updated, errors };
  } catch (error) {
    console.error('[SubcontractorManager] Error during migration:', error);
    throw error;
  }
};
