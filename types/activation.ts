export type ActivationCodeStatus = 'active' | 'redeemed' | 'expired' | 'revoked';

export type ActivationCode = {
  id: string;
  code: string;
  companyId?: string;
  companyName?: string;
  status: ActivationCodeStatus;
  expiryDate?: Date | null;
  redeemedAt?: Date | null;
  redeemedBy?: string;
  createdAt: Date;
  updatedAt?: Date;
  maxRedemptions?: number;
  currentRedemptions?: number;
};

export type ActivationValidationResult = {
  isValid: boolean;
  error?: string;
  activationCode?: ActivationCode;
};
