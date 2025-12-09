import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, DocumentData } from 'firebase/firestore';

const USERS_CACHE_KEY = '@cached_users';
const CACHE_TIMESTAMP_KEY = '@users_cache_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const LOGIN_IDENTIFIER_FIELDS = [
  'userId',
  'loginId',
  'employeeId',
  'employeeCode',
  'employeeRecordId',
  'employeeIdNumber',
  'staffId',
  'idNumber',
  'username',
  'email',
] as const;

const LOGIN_ALIAS_FIELDS = [
  'aliases',
  'alias',
  'alternateIds',
  'alternateId',
  'legacyIds',
  'altIds',
  'loginAliases',
  'loginAlias',
] as const;

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const normalizeOptionalPin = (value: unknown): string | undefined => {
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (!isNonEmptyString(value)) {
    return undefined;
  }
  return value.trim();
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : undefined))
    .filter((item): item is string => isNonEmptyString(item));
};

const collectLoginIdentifiers = (data: Record<string, unknown>, fallbackId: string): string[] => {
  const identifiers = new Set<string>();

  LOGIN_IDENTIFIER_FIELDS.forEach((field) => {
    const raw = data[field];
    if (isNonEmptyString(raw)) {
      identifiers.add(raw.trim());
    }
  });

  LOGIN_ALIAS_FIELDS.forEach((field) => {
    const raw = data[field];
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        if (isNonEmptyString(item)) {
          identifiers.add(item.trim());
        }
      });
      return;
    }
    if (isNonEmptyString(raw)) {
      identifiers.add(raw.trim());
    }
  });

  if (fallbackId.trim().length > 0) {
    identifiers.add(fallbackId.trim());
  }

  return Array.from(identifiers);
};

export interface CachedUser {
  id: string;
  userId: string;
  name: string;
  role: string;
  pin?: string;
  siteId?: string;
  siteName?: string;
  companyName?: string;
  masterAccountId?: string;
  disabledMenus?: string[];
  loginIdentifiers?: string[];
  isLocked?: boolean;
}

export async function precacheUsers(siteId?: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log('[UserCache] Pre-caching users for siteId:', siteId || 'all');
    
    const usersRef = collection(db, 'users');
    const usersQuery = siteId 
      ? query(usersRef, where('siteId', '==', siteId))
      : usersRef;
    
    const snapshot = await getDocs(usersQuery);
    
    const users: CachedUser[] = [];
    snapshot.forEach(doc => {
      const data = doc.data() as DocumentData;
      const record = data as Record<string, unknown>;
      const identifiers = collectLoginIdentifiers(record, doc.id);
      const primaryIdentifier = identifiers[0] ?? doc.id;
      const resolvedName = toOptionalString(record['name']) ?? primaryIdentifier;
      const resolvedRole = toOptionalString(record['role']) ?? '';

      users.push({
        id: doc.id,
        userId: primaryIdentifier,
        name: resolvedName,
        role: resolvedRole,
        pin: normalizeOptionalPin(record['pin']),
        siteId: toOptionalString(record['siteId']),
        siteName: toOptionalString(record['siteName']),
        companyName: toOptionalString(record['companyName']),
        masterAccountId: toOptionalString(record['masterAccountId']),
        disabledMenus: normalizeStringArray(record['disabledMenus']),
        loginIdentifiers: identifiers,
      });
    });
    
    await AsyncStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users));
    await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    
    console.log('[UserCache] Successfully cached', users.length, 'users');
    return { success: true, count: users.length };
  } catch (error: any) {
    console.error('[UserCache] Error pre-caching users:', error);
    return { success: false, count: 0, error: error.message };
  }
}

export async function getCachedUsers(): Promise<CachedUser[]> {
  try {
    const cached = await AsyncStorage.getItem(USERS_CACHE_KEY);
    if (!cached) {
      console.log('[UserCache] No cached users found');
      return [];
    }
    
    const users: CachedUser[] = JSON.parse(cached);
    console.log('[UserCache] Retrieved', users.length, 'cached users');
    return users;
  } catch (error) {
    console.error('[UserCache] Error retrieving cached users:', error);
    return [];
  }
}

export async function getCachedUserById(userId: string): Promise<CachedUser | null> {
  try {
    const normalizedUserId = userId.trim().toLowerCase();
    const users = await getCachedUsers();
    const user = users.find((candidate) => {
      const identifiers = new Set<string>();
      if (candidate.loginIdentifiers) {
        candidate.loginIdentifiers.forEach((identifier) => {
          if (isNonEmptyString(identifier)) {
            identifiers.add(identifier.trim());
          }
        });
      }
      if (isNonEmptyString(candidate.userId)) {
        identifiers.add(candidate.userId.trim());
      }
      identifiers.add(candidate.id.trim());

      return Array.from(identifiers).some(
        (identifier) => identifier.toLowerCase() === normalizedUserId
      );
    });
    
    if (user) {
      console.log('[UserCache] Found cached user:', userId);
      return user;
    }
    
    console.log('[UserCache] User not found in cache:', userId);
    return null;
  } catch (error) {
    console.error('[UserCache] Error finding cached user:', error);
    return null;
  }
}

export async function getCacheAge(): Promise<{ age: number; isStale: boolean; formatted: string }> {
  try {
    const timestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (!timestamp) {
      return { age: 0, isStale: true, formatted: 'Never cached' };
    }
    
    const age = Date.now() - parseInt(timestamp);
    const isStale = age > CACHE_DURATION;
    
    const hours = Math.floor(age / (60 * 60 * 1000));
    const minutes = Math.floor((age % (60 * 60 * 1000)) / (60 * 1000));
    
    let formatted = '';
    if (hours > 0) {
      formatted = `${hours}h ${minutes}m ago`;
    } else {
      formatted = `${minutes}m ago`;
    }
    
    return { age, isStale, formatted };
  } catch (error) {
    console.error('[UserCache] Error getting cache age:', error);
    return { age: 0, isStale: true, formatted: 'Unknown' };
  }
}

export async function clearUserCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USERS_CACHE_KEY);
    await AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY);
    console.log('[UserCache] Cache cleared');
  } catch (error) {
    console.error('[UserCache] Error clearing cache:', error);
  }
}

export async function shouldRefreshCache(): Promise<boolean> {
  const { isStale } = await getCacheAge();
  return isStale;
}

export function getCachedUserName(userId: string): string | null {
  return null;
}

export async function getCachedUserNameAsync(userId: string): Promise<string | null> {
  try {
    const user = await getCachedUserById(userId);
    return user?.name || null;
  } catch (error) {
    console.error('[UserCache] Error getting cached user name:', error);
    return null;
  }
}
