/**
 * Master ID Verification Utilities
 * 
 * Handles national ID verification, duplicate detection, and fraud dispute workflows
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
  runTransaction 
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { 
  MasterIDVerification, 
  FraudDispute, 
  IDVerificationStatus,
  DuplicateIDStatus 
} from '@/types';

/**
 * Check if a national ID number is already in use
 */
export async function checkNationalIdExists(
  nationalIdNumber: string
): Promise<{ exists: boolean; masterAccountId?: string; masterAccountName?: string }> {
  try {
    const masterAccountsRef = collection(db, 'masterAccounts');
    const q = query(masterAccountsRef, where('nationalIdNumber', '==', nationalIdNumber));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { exists: false };
    }
    
    const existingAccount = snapshot.docs[0];
    const data = existingAccount.data();
    
    return {
      exists: true,
      masterAccountId: existingAccount.id,
      masterAccountName: data.name || 'Unknown'
    };
  } catch (error) {
    console.error('[MasterIdVerification] Error checking national ID:', error);
    throw error;
  }
}

/**
 * Submit ID verification document
 */
export async function submitIdVerification(params: {
  masterAccountId: string;
  nationalIdNumber: string;
  documentType: 'national_id' | 'passport' | 'drivers_license' | 'other';
  documentUrl: string;
  storagePath: string;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };
}): Promise<{ success: boolean; verificationId?: string; error?: string }> {
  try {
    // Check for duplicate national ID
    const duplicateCheck = await checkNationalIdExists(params.nationalIdNumber);
    
    if (duplicateCheck.exists && duplicateCheck.masterAccountId !== params.masterAccountId) {
      // Duplicate ID detected - flag it but allow submission
      console.warn('[MasterIdVerification] Duplicate national ID detected:', params.nationalIdNumber);
      
      // Update master account with duplicate flag
      const masterAccountRef = doc(db, 'masterAccounts', params.masterAccountId);
      await updateDoc(masterAccountRef, {
        duplicateIdStatus: 'DUPLICATE_DETECTED' as DuplicateIDStatus,
        nationalIdNumber: params.nationalIdNumber,
        updatedAt: serverTimestamp()
      });
      
      return {
        success: false,
        error: `This national ID number is already registered to ${duplicateCheck.masterAccountName}. Please report this if you believe this is an error.`
      };
    }
    
    // Create ID verification record
    const verificationData: Omit<MasterIDVerification, 'id' | 'createdAt' | 'updatedAt'> = {
      masterAccountId: params.masterAccountId,
      nationalIdNumber: params.nationalIdNumber,
      documentType: params.documentType,
      documentUrl: params.documentUrl,
      storagePath: params.storagePath,
      status: 'PENDING_REVIEW',
      submittedAt: serverTimestamp(),
      metadata: params.metadata
    };
    
    const verificationRef = await addDoc(collection(db, 'masterIDVerification'), {
      ...verificationData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Update master account with ID number and pending status
    const masterAccountRef = doc(db, 'masterAccounts', params.masterAccountId);
    await updateDoc(masterAccountRef, {
      nationalIdNumber: params.nationalIdNumber,
      idVerificationStatus: 'PENDING_REVIEW' as IDVerificationStatus,
      idDocumentUrl: params.documentUrl,
      duplicateIdStatus: 'NONE' as DuplicateIDStatus,
      updatedAt: serverTimestamp()
    });
    
    console.log('[MasterIdVerification] ID verification submitted:', verificationRef.id);
    return { success: true, verificationId: verificationRef.id };
  } catch (error) {
    console.error('[MasterIdVerification] Error submitting ID verification:', error);
    return { success: false, error: 'Failed to submit ID verification' };
  }
}

/**
 * Approve ID verification (admin function)
 */
export async function approveIdVerification(
  verificationId: string,
  adminId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await runTransaction(db, async (transaction) => {
      // Get verification document
      const verificationRef = doc(db, 'masterIDVerification', verificationId);
      const verificationSnap = await transaction.get(verificationRef);
      
      if (!verificationSnap.exists()) {
        throw new Error('Verification not found');
      }
      
      const verificationData = verificationSnap.data() as MasterIDVerification;
      
      // Update verification record
      transaction.update(verificationRef, {
        status: 'VERIFIED' as IDVerificationStatus,
        reviewedAt: serverTimestamp(),
        reviewedBy: adminId,
        reviewNotes: notes || 'ID verified successfully',
        verifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update master account - lift all restrictions
      const masterAccountRef = doc(db, 'masterAccounts', verificationData.masterAccountId);
      transaction.update(masterAccountRef, {
        idVerificationStatus: 'VERIFIED' as IDVerificationStatus,
        idVerifiedAt: serverTimestamp(),
        idVerifiedBy: adminId,
        canOwnCompanies: true,
        canReceivePayouts: true,
        canApproveOwnershipChanges: true,
        updatedAt: serverTimestamp()
      });
      
      // Log audit trail
      const auditLogRef = doc(collection(db, 'masterAccountAuditLogs'));
      transaction.set(auditLogRef, {
        masterAccountId: verificationData.masterAccountId,
        masterAccountName: '', // Will be populated by app
        actionType: 'id_verification_approved',
        actionDescription: 'National ID verification approved',
        performedBy: adminId,
        performedByName: '', // Will be populated by app
        targetEntity: verificationId,
        targetEntityType: 'master_account',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      console.log('[MasterIdVerification] ID verification approved:', verificationId);
      return { success: true };
    });
  } catch (error) {
    console.error('[MasterIdVerification] Error approving ID verification:', error);
    return { success: false, error: 'Failed to approve ID verification' };
  }
}

/**
 * Reject ID verification (admin function)
 */
export async function rejectIdVerification(
  verificationId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await runTransaction(db, async (transaction) => {
      // Get verification document
      const verificationRef = doc(db, 'masterIDVerification', verificationId);
      const verificationSnap = await transaction.get(verificationRef);
      
      if (!verificationSnap.exists()) {
        throw new Error('Verification not found');
      }
      
      const verificationData = verificationSnap.data() as MasterIDVerification;
      
      // Update verification record
      transaction.update(verificationRef, {
        status: 'REJECTED' as IDVerificationStatus,
        reviewedAt: serverTimestamp(),
        reviewedBy: adminId,
        rejectionReason: reason,
        updatedAt: serverTimestamp()
      });
      
      // Update master account - keep restrictions
      const masterAccountRef = doc(db, 'masterAccounts', verificationData.masterAccountId);
      transaction.update(masterAccountRef, {
        idVerificationStatus: 'REJECTED' as IDVerificationStatus,
        restrictionReason: reason,
        updatedAt: serverTimestamp()
      });
      
      // Log audit trail
      const auditLogRef = doc(collection(db, 'masterAccountAuditLogs'));
      transaction.set(auditLogRef, {
        masterAccountId: verificationData.masterAccountId,
        masterAccountName: '',
        actionType: 'id_verification_rejected',
        actionDescription: `National ID verification rejected: ${reason}`,
        performedBy: adminId,
        performedByName: '',
        targetEntity: verificationId,
        targetEntityType: 'master_account',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      console.log('[MasterIdVerification] ID verification rejected:', verificationId);
      return { success: true };
    });
  } catch (error) {
    console.error('[MasterIdVerification] Error rejecting ID verification:', error);
    return { success: false, error: 'Failed to reject ID verification' };
  }
}

/**
 * Report a fraud dispute for duplicate national ID
 */
export async function reportFraudDispute(params: {
  nationalIdNumber: string;
  reportedBy: string;
  reportedByName: string;
  reportedByEmail?: string;
  explanation: string;
  supportingDocuments?: {
    url: string;
    storagePath: string;
    fileName: string;
  }[];
}): Promise<{ success: boolean; disputeId?: string; error?: string }> {
  try {
    // Check if ID exists
    const duplicateCheck = await checkNationalIdExists(params.nationalIdNumber);
    
    if (!duplicateCheck.exists) {
      return { success: false, error: 'No account found with this national ID number' };
    }
    
    // Get the new account trying to use this ID
    const masterAccountRef = doc(db, 'masterAccounts', params.reportedBy);
    const masterAccountSnap = await getDocs(query(collection(db, 'masterAccounts'), where('nationalIdNumber', '==', params.nationalIdNumber)));
    
    const newAccount = masterAccountSnap.docs.find(d => d.id !== duplicateCheck.masterAccountId);
    
    // Create fraud dispute
    const disputeData: Omit<FraudDispute, 'id' | 'createdAt' | 'updatedAt'> = {
      nationalIdNumber: params.nationalIdNumber,
      reportedBy: params.reportedBy,
      reportedByName: params.reportedByName,
      reportedByEmail: params.reportedByEmail,
      existingAccountId: duplicateCheck.masterAccountId,
      existingAccountName: duplicateCheck.masterAccountName,
      newAccountId: newAccount?.id || params.reportedBy,
      newAccountName: newAccount?.data()?.name || params.reportedByName,
      status: 'pending',
      priority: 'high',
      disputeType: 'duplicate_id',
      explanation: params.explanation,
      supportingDocuments: params.supportingDocuments?.map(doc => ({
        ...doc,
        uploadedAt: serverTimestamp()
      })),
      reportedAt: serverTimestamp()
    };
    
    const disputeRef = await addDoc(collection(db, 'fraudDisputes'), {
      ...disputeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('[MasterIdVerification] Fraud dispute created:', disputeRef.id);
    return { success: true, disputeId: disputeRef.id };
  } catch (error) {
    console.error('[MasterIdVerification] Error reporting fraud dispute:', error);
    return { success: false, error: 'Failed to report fraud dispute' };
  }
}
