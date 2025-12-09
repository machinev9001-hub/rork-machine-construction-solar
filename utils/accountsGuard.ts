import { User } from '@/types';

export function isAccountsOrMaster(user: User | null): boolean {
  if (!user) {
    return false;
  }
  
  return user.role === 'Accounts' || user.role === 'master';
}

export function requireAccountsAccess(user: User | null): void {
  if (!isAccountsOrMaster(user)) {
    throw new Error('Access denied. Accounts role or Master access required.');
  }
}
