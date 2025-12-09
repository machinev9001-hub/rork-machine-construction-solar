import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ActivationCode, ActivationValidationResult } from '@/types/activation';

export async function validateActivationCode(code: string): Promise<ActivationValidationResult> {
  try {
    console.log('[ActivationCode] Validating code:', code);
    
    const normalizedCode = code.trim().toUpperCase();
    
    if (!normalizedCode) {
      return { isValid: false, error: 'Activation code is required' };
    }
    
    const activationCodesRef = collection(db, 'activation_codes');
    const q = query(activationCodesRef, where('code', '==', normalizedCode));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('[ActivationCode] Code not found');
      return { isValid: false, error: 'Invalid activation code' };
    }
    
    const codeDoc = snapshot.docs[0];
    const data = codeDoc.data();
    
    const activationCode: ActivationCode = {
      id: codeDoc.id,
      code: data.code,
      companyId: data.companyId,
      companyName: data.companyName,
      status: data.status,
      expiryDate: data.expiryDate?.toDate() || null,
      redeemedAt: data.redeemedAt?.toDate() || null,
      redeemedBy: data.redeemedBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || null,
      maxRedemptions: data.maxRedemptions || 1,
      currentRedemptions: data.currentRedemptions || 0,
    };
    
    if (activationCode.status === 'redeemed') {
      console.log('[ActivationCode] Code already redeemed');
      return { isValid: false, error: 'This activation code has already been used' };
    }
    
    if (activationCode.status === 'expired') {
      console.log('[ActivationCode] Code expired');
      return { isValid: false, error: 'This activation code has expired' };
    }
    
    if (activationCode.status === 'revoked') {
      console.log('[ActivationCode] Code revoked');
      return { isValid: false, error: 'This activation code has been revoked' };
    }
    
    if (activationCode.expiryDate && activationCode.expiryDate < new Date()) {
      console.log('[ActivationCode] Code expired by date');
      await updateDoc(doc(db, 'activation_codes', codeDoc.id), {
        status: 'expired',
        updatedAt: Timestamp.now(),
      });
      return { isValid: false, error: 'This activation code has expired' };
    }
    
    if (activationCode.maxRedemptions && activationCode.currentRedemptions && 
        activationCode.currentRedemptions >= activationCode.maxRedemptions) {
      console.log('[ActivationCode] Code reached max redemptions');
      return { isValid: false, error: 'This activation code has reached its usage limit' };
    }
    
    console.log('[ActivationCode] Code is valid');
    return { isValid: true, activationCode };
  } catch (error) {
    console.error('[ActivationCode] Validation error:', error);
    return { isValid: false, error: 'Unable to validate activation code. Please check your connection.' };
  }
}

export async function markActivationCodeAsRedeemed(
  codeId: string,
  redeemedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[ActivationCode] Marking code as redeemed:', codeId);
    
    const codeRef = doc(db, 'activation_codes', codeId);
    const codeSnapshot = await getDocs(query(collection(db, 'activation_codes'), where('__name__', '==', codeId)));
    
    if (codeSnapshot.empty) {
      return { success: false, error: 'Activation code not found' };
    }
    
    const data = codeSnapshot.docs[0].data();
    const currentRedemptions = data.currentRedemptions || 0;
    const maxRedemptions = data.maxRedemptions || 1;
    
    const updates: any = {
      currentRedemptions: currentRedemptions + 1,
      redeemedAt: Timestamp.now(),
      redeemedBy,
      updatedAt: Timestamp.now(),
    };
    
    if (currentRedemptions + 1 >= maxRedemptions) {
      updates.status = 'redeemed';
    }
    
    await updateDoc(codeRef, updates);
    
    console.log('[ActivationCode] Code marked as redeemed');
    return { success: true };
  } catch (error) {
    console.error('[ActivationCode] Error marking code as redeemed:', error);
    return { success: false, error: 'Failed to redeem activation code' };
  }
}

export function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments = 4;
  const segmentLength = 4;
  
  const code = Array.from({ length: segments }, () => {
    return Array.from({ length: segmentLength }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  }).join('-');
  
  return code;
}
