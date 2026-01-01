/**
 * Company Ownership Management Utilities
 * 
 * Handles multi-owner company structures with percentage-based ownership
 */

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  runTransaction,
  getDoc 
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { CompanyOwnership, CompanyRole, OwnershipChangeRequest } from '@/types';

/**
 * Add an owner to a company with ownership percentage
 */
export async function addCompanyOwner(params: {
  companyId: string;
  masterAccountId: string;
  masterAccountName: string;
  ownershipPercentage: number;
  votingRights?: boolean;
  economicRights?: boolean;
  grantedBy: string;
  notes?: string;
}): Promise<{ success: boolean; ownershipId?: string; error?: string }> {
  try {
    // Validate ownership percentage
    if (params.ownershipPercentage <= 0 || params.ownershipPercentage > 100) {
      return { success: false, error: 'Ownership percentage must be between 0 and 100' };
    }
    
    return await runTransaction(db, async (transaction) => {
      // Check if master account is verified
      const masterAccountRef = doc(db, 'masterAccounts', params.masterAccountId);
      const masterAccountSnap = await transaction.get(masterAccountRef);
      
      if (!masterAccountSnap.exists()) {
        throw new Error('Master account not found');
      }
      
      const masterData = masterAccountSnap.data();
      
      // Check if account can own companies
      if (!masterData.canOwnCompanies) {
        throw new Error('Master account must be verified before owning companies');
      }
      
      // Get existing ownership for this company
      const ownershipQuery = query(
        collection(db, 'companyOwnership'),
        where('companyId', '==', params.companyId),
        where('status', '==', 'active')
      );
      const ownershipSnapshot = await getDocs(ownershipQuery);
      
      // Calculate total current ownership
      let totalOwnership = 0;
      ownershipSnapshot.forEach(doc => {
        const data = doc.data() as CompanyOwnership;
        totalOwnership += data.ownershipPercentage || 0;
      });
      
      // Check if adding this ownership would exceed 100%
      if (totalOwnership + params.ownershipPercentage > 100) {
        throw new Error(
          `Cannot add ${params.ownershipPercentage}% ownership. Current total: ${totalOwnership}%. Would exceed 100%.`
        );
      }
      
      // Check if this master account already owns part of this company
      const existingOwnership = ownershipSnapshot.docs.find(
        doc => (doc.data() as CompanyOwnership).masterAccountId === params.masterAccountId
      );
      
      if (existingOwnership) {
        throw new Error('Master account already owns part of this company. Use change ownership instead.');
      }
      
      // Create ownership record
      const ownershipRef = doc(collection(db, 'companyOwnership'));
      const ownershipData: Omit<CompanyOwnership, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: params.companyId,
        masterAccountId: params.masterAccountId,
        masterAccountName: params.masterAccountName,
        ownershipPercentage: params.ownershipPercentage,
        status: 'active',
        votingRights: params.votingRights !== false, // Default true
        economicRights: params.economicRights !== false, // Default true
        grantedAt: serverTimestamp(),
        grantedBy: params.grantedBy,
        approvedAt: serverTimestamp(),
        approvedBy: params.grantedBy,
        notes: params.notes
      };
      
      transaction.set(ownershipRef, {
        ...ownershipData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update master account's companyIds array
      const currentCompanyIds = masterData.companyIds || [];
      if (!currentCompanyIds.includes(params.companyId)) {
        transaction.update(masterAccountRef, {
          companyIds: [...currentCompanyIds, params.companyId],
          updatedAt: serverTimestamp()
        });
      }
      
      // Update company's owner count and total ownership
      const companyRef = doc(db, 'companies', params.companyId);
      transaction.update(companyRef, {
        totalOwnershipPercentage: totalOwnership + params.ownershipPercentage,
        ownerCount: ownershipSnapshot.size + 1,
        updatedAt: serverTimestamp()
      });
      
      // Log audit trail
      const auditLogRef = doc(collection(db, 'masterAccountAuditLogs'));
      transaction.set(auditLogRef, {
        masterAccountId: params.masterAccountId,
        masterAccountName: params.masterAccountName,
        companyId: params.companyId,
        actionType: 'company_ownership_added',
        actionDescription: `Added ${params.ownershipPercentage}% ownership`,
        performedBy: params.grantedBy,
        performedByName: '',
        targetEntity: ownershipRef.id,
        targetEntityType: 'ownership',
        newValue: JSON.stringify({ ownershipPercentage: params.ownershipPercentage }),
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      console.log('[CompanyOwnership] Owner added successfully:', ownershipRef.id);
      return { success: true, ownershipId: ownershipRef.id };
    });
  } catch (error: any) {
    console.error('[CompanyOwnership] Error adding owner:', error);
    return { success: false, error: error.message || 'Failed to add owner' };
  }
}

/**
 * Get all owners of a company
 */
export async function getCompanyOwners(
  companyId: string,
  includeInactive = false
): Promise<CompanyOwnership[]> {
  try {
    const ownershipRef = collection(db, 'companyOwnership');
    let q = query(ownershipRef, where('companyId', '==', companyId));
    
    if (!includeInactive) {
      q = query(q, where('status', '==', 'active'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyOwnership));
  } catch (error) {
    console.error('[CompanyOwnership] Error getting owners:', error);
    return [];
  }
}

/**
 * Get all companies owned by a master account
 */
export async function getMasterAccountOwnerships(
  masterAccountId: string,
  includeInactive = false
): Promise<CompanyOwnership[]> {
  try {
    const ownershipRef = collection(db, 'companyOwnership');
    let q = query(ownershipRef, where('masterAccountId', '==', masterAccountId));
    
    if (!includeInactive) {
      q = query(q, where('status', '==', 'active'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyOwnership));
  } catch (error) {
    console.error('[CompanyOwnership] Error getting ownerships:', error);
    return [];
  }
}

/**
 * Change ownership percentage for an existing owner
 */
export async function changeOwnershipPercentage(params: {
  ownershipId: string;
  newPercentage: number;
  changedBy: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (params.newPercentage <= 0 || params.newPercentage > 100) {
      return { success: false, error: 'Ownership percentage must be between 0 and 100' };
    }
    
    return await runTransaction(db, async (transaction) => {
      // Get current ownership record
      const ownershipRef = doc(db, 'companyOwnership', params.ownershipId);
      const ownershipSnap = await transaction.get(ownershipRef);
      
      if (!ownershipSnap.exists()) {
        throw new Error('Ownership record not found');
      }
      
      const currentOwnership = ownershipSnap.data() as CompanyOwnership;
      const previousPercentage = currentOwnership.ownershipPercentage;
      
      // Get all other active ownerships for this company
      const ownershipQuery = query(
        collection(db, 'companyOwnership'),
        where('companyId', '==', currentOwnership.companyId),
        where('status', '==', 'active')
      );
      const ownershipSnapshot = await getDocs(ownershipQuery);
      
      // Calculate total ownership excluding current
      let totalOtherOwnership = 0;
      ownershipSnapshot.forEach(doc => {
        if (doc.id !== params.ownershipId) {
          const data = doc.data() as CompanyOwnership;
          totalOtherOwnership += data.ownershipPercentage || 0;
        }
      });
      
      // Check if change would exceed 100%
      if (totalOtherOwnership + params.newPercentage > 100) {
        throw new Error(
          `Cannot change to ${params.newPercentage}%. Other owners total: ${totalOtherOwnership}%. Would exceed 100%.`
        );
      }
      
      // Update ownership percentage
      transaction.update(ownershipRef, {
        ownershipPercentage: params.newPercentage,
        updatedAt: serverTimestamp()
      });
      
      // Update company's total ownership
      const companyRef = doc(db, 'companies', currentOwnership.companyId);
      transaction.update(companyRef, {
        totalOwnershipPercentage: totalOtherOwnership + params.newPercentage,
        updatedAt: serverTimestamp()
      });
      
      // Log audit trail
      const auditLogRef = doc(collection(db, 'masterAccountAuditLogs'));
      transaction.set(auditLogRef, {
        masterAccountId: currentOwnership.masterAccountId,
        masterAccountName: currentOwnership.masterAccountName,
        companyId: currentOwnership.companyId,
        actionType: 'company_ownership_changed',
        actionDescription: `Changed ownership from ${previousPercentage}% to ${params.newPercentage}%: ${params.reason}`,
        performedBy: params.changedBy,
        performedByName: '',
        targetEntity: params.ownershipId,
        targetEntityType: 'ownership',
        previousValue: JSON.stringify({ ownershipPercentage: previousPercentage }),
        newValue: JSON.stringify({ ownershipPercentage: params.newPercentage }),
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      console.log('[CompanyOwnership] Ownership percentage changed successfully');
      return { success: true };
    });
  } catch (error: any) {
    console.error('[CompanyOwnership] Error changing ownership:', error);
    return { success: false, error: error.message || 'Failed to change ownership percentage' };
  }
}

/**
 * Assign a role to a master account for a company
 */
export async function assignCompanyRole(params: {
  companyId: string;
  masterAccountId: string;
  masterAccountName: string;
  role: 'Director' | 'Admin' | 'Manager' | 'Viewer' | 'Custom';
  customRoleName?: string;
  permissions: string[];
  assignedBy: string;
  notes?: string;
}): Promise<{ success: boolean; roleId?: string; error?: string }> {
  try {
    // Create role record
    const roleData: Omit<CompanyRole, 'id' | 'createdAt' | 'updatedAt'> = {
      companyId: params.companyId,
      masterAccountId: params.masterAccountId,
      masterAccountName: params.masterAccountName,
      role: params.role,
      customRoleName: params.customRoleName,
      permissions: params.permissions,
      status: 'active',
      assignedAt: serverTimestamp(),
      assignedBy: params.assignedBy,
      notes: params.notes
    };
    
    const roleRef = await addDoc(collection(db, 'companyRoles'), {
      ...roleData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Log audit trail
    await addDoc(collection(db, 'masterAccountAuditLogs'), {
      masterAccountId: params.masterAccountId,
      masterAccountName: params.masterAccountName,
      companyId: params.companyId,
      actionType: 'company_role_assigned',
      actionDescription: `Assigned role: ${params.role}${params.customRoleName ? ` (${params.customRoleName})` : ''}`,
      performedBy: params.assignedBy,
      performedByName: '',
      targetEntity: roleRef.id,
      targetEntityType: 'role',
      newValue: JSON.stringify({ role: params.role, permissions: params.permissions }),
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp()
    });
    
    console.log('[CompanyOwnership] Role assigned successfully:', roleRef.id);
    return { success: true, roleId: roleRef.id };
  } catch (error) {
    console.error('[CompanyOwnership] Error assigning role:', error);
    return { success: false, error: 'Failed to assign role' };
  }
}

/**
 * Get all roles for a master account in a company
 */
export async function getMasterAccountRoles(
  masterAccountId: string,
  companyId?: string
): Promise<CompanyRole[]> {
  try {
    const rolesRef = collection(db, 'companyRoles');
    let q = query(
      rolesRef,
      where('masterAccountId', '==', masterAccountId),
      where('status', '==', 'active')
    );
    
    if (companyId) {
      q = query(q, where('companyId', '==', companyId));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyRole));
  } catch (error) {
    console.error('[CompanyOwnership] Error getting roles:', error);
    return [];
  }
}
