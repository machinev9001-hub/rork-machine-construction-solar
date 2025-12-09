import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { collection, doc, getDoc, getDocs, query, where, setDoc, addDoc, serverTimestamp, updateDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db, clearFirestoreCache, isDemoFirebaseProject } from '@/config/firebase';
import { DEMO_MASTER_ACCOUNTS, DEMO_USERS, DEMO_DEFAULT_PIN, DEMO_USER_ALIASES, DEMO_MASTER_ALIASES } from '@/constants/demoAuthData';
import { useQueryClient } from '@tanstack/react-query';
import { precacheUsers, getCachedUserById } from '@/utils/userCache';
import { getCachedEmployeeWithUser } from '@/utils/employeeCache';
import { OFFLINE_CONFIG } from '@/constants/colors';
import { hashPin, verifyPin } from '@/utils/pinSecurity';
import { validateActivationCode, markActivationCodeAsRedeemed } from '@/utils/activationCode';

export type UserRole = 
  | 'master'
  | 'Admin'
  | 'Planner'
  | 'Supervisor'
  | 'QC'
  | 'Operator'
  | 'Plant Manager'
  | 'Surveyor'
  | 'Staff Manager'
  | 'Logistics Manager'
  | 'HR'
  | 'Onboarding & Inductions'
  | 'General Worker'
  | 'HSE'
  | 'Accounts';

export type MasterAccount = {
  id: string;
  masterId: string;
  name: string;
  pin: string;
  companyIds: string[];
  currentCompanyId?: string;
  createdAt: any;
};

export type User = {
  id: string;
  userId: string;
  name: string;
  role: UserRole;
  companyIds: string[];
  currentCompanyId?: string;
  companyName?: string;
  companyContactMobile?: string;
  supervisorName?: string;
  supervisorMobile?: string;
  siteId?: string;
  siteName?: string;
  pin?: string;
  masterAccountId?: string;
  createdAt: any;
  disabledMenus?: string[];
  isLocked?: boolean;
  employeeIdNumber?: string;
};

export type Site = {
  id: string;
  name: string;
  companyId: string;
  masterAccountId: string;
  description?: string;
  location?: string;
  status?: 'Active' | 'Inactive' | 'Archived' | 'Deleted';
  deletedAt?: any;
  createdAt: any;
  updatedAt?: any;
};

const STORAGE_KEYS = {
  USER: '@user',
  PIN: '@pin',
  OFFLINE_MODE: '@offline_mode',
  LAST_ACTIVITY: '@last_activity',
  LAST_KNOWN_USER: '@user_last_known',
  SELECTED_COMPANY: '@selected_company',
};

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

const normalizeLoginIdentifier = (value: string) => value.trim().toLowerCase();

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : undefined))
    .filter((item): item is string => isNonEmptyString(item));
};

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

const extractLoginIdentifiers = (data: Record<string, unknown>, docId: string): string[] => {
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

  if (docId.trim().length > 0) {
    identifiers.add(docId.trim());
  }

  return Array.from(identifiers);
};

const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

// Helper function to fetch company name
const fetchCompanyName = async (companyId: string): Promise<string | undefined> => {
  try {
    const companyRef = doc(db, 'companies', companyId);
    const companyDoc = await getDoc(companyRef);
    if (companyDoc.exists()) {
      const companyData = companyDoc.data();
      return companyData.alias || companyData.legalEntityName;
    }
  } catch (error) {
    console.warn('[Auth] Could not fetch company name:', error);
  }
  return undefined;
};

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [masterAccount, setMasterAccount] = useState<MasterAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastActivityTime = useRef<number>(Date.now());
  const inactivityTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasInitialized = useRef(false);

  const loadUserFromStorage = useCallback(async () => {
    
    try {
      console.log('[Auth] Starting loadUserFromStorage...');
      
      // CRITICAL FIX: Shorter timeout for AsyncStorage to prevent blocking
      const asyncStorageTimeout = new Promise<string | null>((_, reject) => 
        setTimeout(() => reject(new Error('AsyncStorage timeout')), 1000)
      );
      
      const storedUser = await Promise.race([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        asyncStorageTimeout
      ]).catch(err => {
        console.warn('[Auth] AsyncStorage.getItem timed out or failed:', err);
        return null as string | null;
      });
      
      console.log('[Auth] AsyncStorage check complete, storedUser:', storedUser ? 'found' : 'none');
      
      const lastActivity = await Promise.race([
        AsyncStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY),
        new Promise<string | null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
      ]).catch(() => null);
      
      if (storedUser) {
        console.log('[Auth] Found stored session, checking validity...');
        
        // Check if session is still valid (within inactivity timeout)
        if (lastActivity) {
          const lastTime = parseInt(lastActivity);
          const timeSinceLastActivity = Date.now() - lastTime;
          
          if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
            console.log('[Auth] Session expired due to inactivity, clearing...');
            await AsyncStorage.removeItem(STORAGE_KEYS.USER);
            await AsyncStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
            setUser(null);
            setMasterAccount(null);
            setIsLoading(false);
            return;
          }
        }
        
        // Session is valid, restore user
        const userData = JSON.parse(storedUser);
        console.log('[Auth] Restoring valid session for user:', userData.userId);
        console.log('[Auth] User role:', userData.role);
        
        // If user has currentCompanyId but no companyName, fetch it
        if (userData.currentCompanyId && !userData.companyName) {
          console.log('[Auth] User has currentCompanyId but no companyName, fetching...');
          try {
            const companyName = await fetchCompanyName(userData.currentCompanyId);
            if (companyName) {
              userData.companyName = companyName;
              console.log('[Auth] Fetched and updated company name:', companyName);
            }
          } catch (error) {
            console.warn('[Auth] Failed to fetch company name during session restore:', error);
          }
        }
        
        // Update last activity time
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
        
        // Set user state
        setUser(userData);
        
        // If it's a master account, also set masterAccount state
        if (userData.role === 'master' && userData.masterAccountId) {
          const masterData: MasterAccount = {
            id: userData.masterAccountId,
            masterId: userData.userId,
            name: userData.name,
            pin: userData.pin || '',
            companyIds: userData.companyIds || [],
            currentCompanyId: userData.currentCompanyId,
            createdAt: userData.createdAt
          };
          setMasterAccount(masterData);
        }
        
        console.log('[Auth] Session restored successfully');
        setIsLoading(false);
        setAuthInitializing(false);
      } else {
        setUser(null);
        setMasterAccount(null);
        setIsLoading(false);
        setAuthInitializing(false);
      }
    } catch (error) {
      console.error('[Auth] Load error:', error);
      setUser(null);
      setMasterAccount(null);
      setIsLoading(false);
      setAuthInitializing(false);
    }
  }, []);

  const logout = useCallback(async (clearCache = false, reason?: string) => {
    try {
      console.log('[Auth] ========================================');
      console.log('[Auth] LOGOUT INITIATED');
      console.log('[Auth] Reason:', reason || 'user-initiated');
      console.log('[Auth] Previous user:', user?.userId, 'Role:', user?.role);
      console.log('[Auth] ========================================');
      console.log('[Auth] Clearing session but KEEPING all cached data');
      
      // CRITICAL: Clear state FIRST to prevent any race conditions
      setUser(null);
      setMasterAccount(null);
      console.log('[Auth] State cleared - user and masterAccount set to null');
      
      // Clear all auth-related storage keys
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      await AsyncStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
      await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_COMPANY);
      await AsyncStorage.removeItem(STORAGE_KEYS.LAST_KNOWN_USER);
      console.log('[Auth] Cleared user session, selected company, and last known user');
      
      console.log('[Auth] Clearing query client (in-memory cache only)');
      queryClient.clear();
      queryClient.removeQueries();
      
      if (clearCache) {
        try {
          await clearFirestoreCache();
          console.log('[Auth] Firestore cache cleared - user will need internet to re-login');
        } catch (error) {
          console.warn('[Auth] Could not clear Firestore cache (may be offline):', error);
        }
      } else {
        console.log('[Auth] Keeping Firestore cache AND AsyncStorage data - user can re-login offline with full data access');
      }
      
      console.log('[Auth] ========================================');
      console.log('[Auth] LOGOUT COMPLETE');
      console.log('[Auth] AsyncStorage data preserved for offline use');
      console.log('[Auth] ========================================');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  }, [queryClient]);

  const updateActivity = useCallback(async () => {
    lastActivityTime.current = Date.now();
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, lastActivityTime.current.toString());
  }, []);

  const checkInactivity = useCallback(async () => {
    if (!user) return;

    const lastActivity = await AsyncStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY);
    const lastTime = lastActivity ? parseInt(lastActivity) : Date.now();
    const timeSinceLastActivity = Date.now() - lastTime;

    if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
      console.log('[Auth] Inactivity timeout (5 minutes), logging out');
      await logout(false, 'inactivity-timeout-5min');
      await logout(false, 'inactivity-timeout');
    }
  }, [user, logout]);

  useEffect(() => {
    if (hasInitialized.current) {
      console.log('[Auth] Already initialized, skipping');
      return;
    }
    hasInitialized.current = true;
    
    console.log('[Auth] Initializing auth system...');
    
    const safetyTimeout = setTimeout(() => {
      console.warn('[Auth] Safety timeout triggered - forcing auth to complete');
      setIsLoading(false);
      setAuthInitializing(false);
    }, 1500);
    
    loadUserFromStorage()
      .then(() => {
        console.log('[Auth] loadUserFromStorage completed successfully');
        clearTimeout(safetyTimeout);
      })
      .catch(err => {
        console.error('[Auth] Load failed:', err?.message || 'Unknown error');
        clearTimeout(safetyTimeout);
        setIsLoading(false);
        setAuthInitializing(false);
      });
    
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [loadUserFromStorage]);

  useEffect(() => {
    if (!user?.id) return;
    
    // Skip real-time listener for employees (they don't have documents in users collection)
    // Employees are identified by having an employeeIdNumber as their userId
    const isEmployee = user.userId && /^\d+$/.test(user.userId); // Check if userId is all digits (ID number)
    if (isEmployee) {
      console.log('[Auth] Skipping real-time listener for employee user:', user.userId);
      return;
    }

    console.log('[Auth] Setting up real-time listener for user:', user.id);
    const userRef = doc(db, 'users', user.id);
    
    let listenerTimeout: ReturnType<typeof setTimeout> | null = null;
    let hasReceivedFirstSnapshot = false;
    
    listenerTimeout = setTimeout(() => {
      if (!hasReceivedFirstSnapshot) {
        console.warn('[Auth] Listener setup timed out, continuing anyway');
      }
    }, 5000);
    
    const unsubscribe = onSnapshot(
      userRef,
      async (docSnap) => {
        hasReceivedFirstSnapshot = true;
        if (listenerTimeout) {
          clearTimeout(listenerTimeout);
          listenerTimeout = null;
        }
        
        if (!docSnap.exists()) {
          console.log('[Auth] User document deleted, logging out');
          await logout();
          return;
        }

        const docData = docSnap.data();
        const updatedUserData = { 
          id: docSnap.id, 
          ...docData,
          disabledMenus: docData.disabledMenus || []
        } as User;
        
        if (updatedUserData.role !== user.role) {
          console.log('[Auth] User role changed from', user.role, 'to', updatedUserData.role);
        }
        
        console.log('[Auth] Real-time update - disabledMenus:', updatedUserData.disabledMenus);
        
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(updatedUserData));
        setUser(updatedUserData);
        console.log('[Auth] User data updated from real-time listener');
      },
      (error: any) => {
        hasReceivedFirstSnapshot = true;
        if (listenerTimeout) {
          clearTimeout(listenerTimeout);
          listenerTimeout = null;
        }
        
        if (error?.code === 'permission-denied') {
          console.warn('[Auth] Permission denied for user listener - this is normal with current rules. Updates will work via manual refresh.');
        } else if (error?.code === 'unavailable') {
          console.warn('[Auth] Firestore temporarily unavailable - will retry automatically');
        } else {
          console.error('[Auth] Error in user listener:', error?.code, error?.message);
        }
      }
    );

    return () => {
      console.log('[Auth] Cleaning up user listener');
      if (listenerTimeout) {
        clearTimeout(listenerTimeout);
      }
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    updateActivity();

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[Auth] App became active, checking inactivity');
        await checkInactivity();
      }

      if (nextAppState === 'active') {
        await updateActivity();
      }

      appState.current = nextAppState;
    });

    // Check for inactivity every 30 seconds
    inactivityTimer.current = setInterval(async () => {
      if (AppState.currentState === 'active') {
        const lastActivity = await AsyncStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY);
        const lastTime = lastActivity ? parseInt(lastActivity) : Date.now();
        const timeSinceLastActivity = Date.now() - lastTime;
        
        if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
          console.log('[Auth] Session expired due to 5 minutes of inactivity');
          await logout(false, 'inactivity-timeout-5min');
        } else {
          // Keep activity updated while active
          await updateActivity();
        }
      }
    }, 30 * 1000); // Check every 30 seconds

    return () => {
      subscription.remove();
      if (inactivityTimer.current) {
        clearInterval(inactivityTimer.current);
      }
    };
  }, [user, checkInactivity, updateActivity]);

  const createMasterAccount = useCallback(async (
    name: string,
    masterId: string,
    pin: string,
    activationCode: string
  ): Promise<{ success: boolean; error?: string; masterAccount?: MasterAccount }> => {
    try {
      console.log('[Auth] Creating master account...');
      console.log('[Auth]   masterId:', masterId);
      console.log('[Auth]   activationCode:', activationCode);
      
      const codeValidation = await validateActivationCode(activationCode);
      if (!codeValidation.isValid) {
        console.log('[Auth] Activation code validation failed:', codeValidation.error);
        return { success: false, error: codeValidation.error || 'Invalid activation code' };
      }

      const masterAccountsRef = collection(db, 'masterAccounts');
      const masterQuery = query(masterAccountsRef, where('masterId', '==', masterId));
      const masterSnapshot = await getDocs(masterQuery);
      
      if (!masterSnapshot.empty) {
        console.log('[Auth] Master ID already exists (pre-check)');
        return { success: false, error: 'Master ID already exists' };
      }

      const { hash: pinHash, salt: pinSalt } = hashPin(pin);

      let newMasterDocId: string | null = null;

      try {
        await runTransaction(db, async (transaction) => {
          const checkSnapshot = await getDocs(masterQuery);
          
          if (!checkSnapshot.empty) {
            throw new Error('DUPLICATE_MASTER_ID');
          }

          const newMasterRef = doc(collection(db, 'masterAccounts'));
          transaction.set(newMasterRef, {
            masterId,
            name,
            pin: pinHash,
            pinSalt,
            activationCodeId: codeValidation.activationCode?.id,
            companyId: codeValidation.activationCode?.companyId,
            companyName: codeValidation.activationCode?.companyName,
            companyIds: [],
            createdAt: serverTimestamp(),
          });

          newMasterDocId = newMasterRef.id;
        });
      } catch (txError: any) {
        if (txError?.message === 'DUPLICATE_MASTER_ID') {
          console.log('[Auth] Master ID already exists (transaction check)');
          return { success: false, error: 'Master ID already exists' };
        }
        throw txError;
      }

      if (codeValidation.activationCode?.id && newMasterDocId) {
        await markActivationCodeAsRedeemed(
          codeValidation.activationCode.id,
          newMasterDocId
        );
      }

      if (!newMasterDocId) {
        throw new Error('Failed to create master account document');
      }

      const newMasterAccount: MasterAccount = {
        id: newMasterDocId,
        masterId,
        name,
        pin: pinHash,
        companyIds: [],
        createdAt: serverTimestamp(),
      };

      console.log('[Auth] Master account created successfully, setting state...');
      setMasterAccount(newMasterAccount);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(newMasterAccount));
      console.log('[Auth] Master account state set, ready to navigate');
      
      return { success: true, masterAccount: newMasterAccount };
    } catch (error) {
      console.error('[Auth] Error creating master account:', error);
      return { success: false, error: 'Failed to create master account' };
    }
  }, []);

  const loginWithId = useCallback(async (
    userId: string,
    pin?: string,
    isSettingUpPin?: boolean
  ): Promise<{ success: boolean; user?: User; error?: string; requiresPin?: boolean; isFirstTime?: boolean; isMaster?: boolean; masterAccount?: MasterAccount }> => {
    try {

      const normalizedUserId = userId.trim();
      const normalizedUserIdLower = normalizedUserId.toLowerCase();
      const normalizedPin: string | undefined = typeof pin === 'string' ? pin.trim() : undefined;

      if (isDemoFirebaseProject) {
        console.log('[Auth] Demo environment detected, using in-memory dataset');
        const resolvedMasterLookupId = DEMO_MASTER_ALIASES[normalizedUserIdLower] ?? normalizedUserIdLower;
        const demoMaster = DEMO_MASTER_ACCOUNTS.find((account) => account.masterId.trim().toLowerCase() === resolvedMasterLookupId);

        if (demoMaster) {
          if (!normalizedPin) {
            return { success: false, requiresPin: true };
          }
          const storedPin = demoMaster.pin.trim();
          if (storedPin !== normalizedPin) {
            return { success: false, error: `Incorrect PIN. Expected ${storedPin.length} chars, got ${normalizedPin.length} chars` };
          }
          const masterPayload: MasterAccount = { ...demoMaster };
          setMasterAccount(masterPayload);
          setIsOffline(false);
          return { success: true, isMaster: true, masterAccount: masterPayload };
        }

        const resolvedUserLookupId = DEMO_USER_ALIASES[normalizedUserIdLower] ?? normalizedUserIdLower;
        const demoUser = DEMO_USERS.find((candidate) => candidate.userId.trim().toLowerCase() === resolvedUserLookupId);

        if (!demoUser) {
          return { success: false, error: 'User not found' };
        }

        const userPayload: User = {
          ...demoUser,
          disabledMenus: demoUser.disabledMenus ?? [],
        };

        if (!userPayload.pin && !isSettingUpPin) {
          return { success: false, isFirstTime: true };
        }

        if (isSettingUpPin && !userPayload.pin) {
          if (!normalizedPin) {
            return { success: false, error: 'PIN is required' };
          }
          userPayload.pin = normalizedPin;
        } else {
          const storedPin = (userPayload.pin ?? DEMO_DEFAULT_PIN).trim();
          if (!normalizedPin) {
            return { success: false, requiresPin: true };
          }
          if (storedPin !== normalizedPin) {
            return { success: false, error: `Incorrect PIN. Expected ${storedPin.length} chars, got ${normalizedPin.length} chars` };
          }
        }

        await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(userPayload));
        setUser(userPayload);
        setIsOffline(false);
        return { success: true, user: userPayload };
      }

      if (!db) {
        console.error('[Auth] Firebase db not initialized!');
        return { success: false, error: 'Database not ready, please try again' };
      }

      const masterAccountsRef = collection(db, 'masterAccounts');
      const masterQuery = query(masterAccountsRef, where('masterId', '==', normalizedUserId));
      const masterSnapshot = await getDocs(masterQuery);

      let masterDoc = masterSnapshot.docs[0] ?? null;

      if (!masterDoc) {
        const fallbackMasterSnapshot = await getDocs(masterAccountsRef);
        fallbackMasterSnapshot.forEach((docSnap) => {
          if (masterDoc) {
            return;
          }
          const data = docSnap.data() as Partial<MasterAccount>;
          const candidateMasterId = String(data.masterId ?? '').trim().toLowerCase();
          if (candidateMasterId === normalizedUserIdLower) {
            masterDoc = docSnap;
          }
        });
      }

      if (masterDoc) {
        const data = masterDoc.data();
        const storedPinHash = String(data.pin || '').trim();
        const pinSalt = String(data.pinSalt || '').trim();
        
        // Get the associated companyId from the master account
        // Get companyIds from the array field (plural) not the old companyId field (singular)
        const companyIdsArray = data.companyIds || [];
        
        let foundMaster: MasterAccount = {
          id: masterDoc.id,
          masterId: data.masterId as string,
          name: data.name as string,
          pin: storedPinHash,
          companyIds: Array.isArray(companyIdsArray) ? companyIdsArray : [],
          currentCompanyId: undefined, // Don't set to force company selection
          createdAt: data.createdAt,
        };

        if (!normalizedPin) {
          return { success: false, requiresPin: true };
        }
        
        const isValidPin = pinSalt ? verifyPin(normalizedPin, storedPinHash, pinSalt) : (storedPinHash === normalizedPin);
        
        if (!isValidPin) {
          return { success: false, error: 'Incorrect PIN' };
        }

        const refreshedMasterDoc = await getDoc(masterDoc.ref);
        if (refreshedMasterDoc.exists()) {
          const refreshedData = refreshedMasterDoc.data();
          // Get companyIds from the array field (plural) not the old companyId field (singular)
          const companyIdsArray = refreshedData.companyIds || [];
          foundMaster = {
            id: refreshedMasterDoc.id,
            masterId: refreshedData.masterId as string,
            name: refreshedData.name as string,
            pin: String(refreshedData.pin || '').trim(),
            companyIds: Array.isArray(companyIdsArray) ? companyIdsArray : [],
            currentCompanyId: undefined,
            createdAt: refreshedData.createdAt,
          };
        } else {
          console.error('[Auth] ❌ Master account document no longer exists!');
          return { success: false, error: 'Account not found' };
        }
        foundMaster.currentCompanyId = undefined;
        
        // Convert master account to User object for consistent handling
        const masterAsUser: User = {
          id: foundMaster.id,
          userId: foundMaster.masterId,  // Use masterId as userId for consistency
          name: foundMaster.name,
          role: 'master',  // Master role
          companyIds: foundMaster.companyIds,
          currentCompanyId: foundMaster.currentCompanyId,
          pin: foundMaster.pin,
          masterAccountId: foundMaster.id,  // Self-reference for master accounts
          createdAt: foundMaster.createdAt,
          disabledMenus: [],
          isLocked: false
        };
        
        // Save to AsyncStorage for session persistence
        const masterUserData = JSON.stringify(masterAsUser);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, masterUserData);
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, masterUserData);
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
        
        setUser(masterAsUser);
        setMasterAccount(foundMaster);
        return { success: true, user: masterAsUser, isMaster: true, masterAccount: foundMaster };
      }

      const usersRef = collection(db, 'users');
      const userByIdNumberQuery = query(usersRef, where('employeeIdNumber', '==', normalizedUserId));
      const userByIdNumberSnapshot = await getDocs(userByIdNumberQuery);
      
      let foundUser: User | null = null;
      
      if (!userByIdNumberSnapshot.empty) {
        const userDoc = userByIdNumberSnapshot.docs[0];
        const rawData = userDoc.data() as Record<string, unknown>;
        const typedData = rawData as Partial<User>;
        
        foundUser = {
          id: userDoc.id,
          userId: typedData.userId || (rawData['employeeIdNumber'] as string) || normalizedUserId,
          name: typedData.name || 'Unknown User',
          role: (typedData.role ?? 'General Worker') as UserRole,
          companyIds: normalizeStringArray(typedData.companyIds ?? rawData['companyIds']),
          currentCompanyId: toOptionalString(typedData.currentCompanyId ?? rawData['currentCompanyId']),
          companyName: toOptionalString(typedData.companyName ?? rawData['companyName']),
          companyContactMobile: toOptionalString(typedData.companyContactMobile ?? rawData['companyContactMobile']),
          supervisorName: toOptionalString(typedData.supervisorName ?? rawData['supervisorName']),
          supervisorMobile: toOptionalString(typedData.supervisorMobile ?? rawData['supervisorMobile']),
          siteId: toOptionalString(typedData.siteId ?? rawData['siteId']),
          siteName: toOptionalString(typedData.siteName ?? rawData['siteName']),
          pin: normalizeOptionalPin(rawData['pin'] ?? typedData.pin),
          masterAccountId: toOptionalString(typedData.masterAccountId ?? rawData['masterAccountId']) ?? undefined,
          createdAt: typedData.createdAt ?? null,
          disabledMenus: normalizeStringArray(typedData.disabledMenus ?? rawData['disabledMenus']),
          isLocked: typeof (typedData.isLocked ?? rawData['isLocked']) === 'boolean' ? (typedData.isLocked ?? rawData['isLocked']) as boolean : false,
        };
      } else {
        const usersSnapshot = await getDocs(usersRef);
        
        usersSnapshot.forEach((docSnap) => {
          if (foundUser) {
            return;
          }
          const rawData = docSnap.data() as Record<string, unknown>;
          const identifiers = extractLoginIdentifiers(rawData, docSnap.id);
          const hasMatchingIdentifier = identifiers.some(
            (identifier) => normalizeLoginIdentifier(identifier) === normalizedUserIdLower
          );
          if (!hasMatchingIdentifier) {
            return;
          }

          const typedData = rawData as Partial<User>;
          const matchingIdentifier = identifiers.find(
            (identifier) => normalizeLoginIdentifier(identifier) === normalizedUserIdLower
          );
          const resolvedUserId = isNonEmptyString(typedData.userId)
            ? typedData.userId.trim()
            : matchingIdentifier ?? docSnap.id;
          const resolvedName: string = isNonEmptyString(typedData.name)
            ? typedData.name
            : (matchingIdentifier ?? docSnap.id);
          const resolvedPin = normalizeOptionalPin(rawData['pin'] ?? typedData.pin);
          const normalizedDisabledMenus = normalizeStringArray(typedData.disabledMenus ?? rawData['disabledMenus']);

          const isLockedValue = typedData.isLocked ?? rawData['isLocked'];
          const userCompanyIds = normalizeStringArray(typedData.companyIds ?? rawData['companyIds']);
          foundUser = {
            id: docSnap.id,
            userId: resolvedUserId,
            name: resolvedName,
            role: (typedData.role ?? 'master') as UserRole,
            companyIds: userCompanyIds,
            currentCompanyId: toOptionalString(typedData.currentCompanyId ?? rawData['currentCompanyId']),
            companyName: toOptionalString(typedData.companyName ?? rawData['companyName']),
            companyContactMobile: toOptionalString(typedData.companyContactMobile ?? rawData['companyContactMobile']),
            supervisorName: toOptionalString(typedData.supervisorName ?? rawData['supervisorName']),
            supervisorMobile: toOptionalString(typedData.supervisorMobile ?? rawData['supervisorMobile']),
            siteId: toOptionalString(typedData.siteId ?? rawData['siteId']),
            siteName: toOptionalString(typedData.siteName ?? rawData['siteName']),
            pin: resolvedPin,
            masterAccountId: toOptionalString(typedData.masterAccountId ?? rawData['masterAccountId']) ?? undefined,
            createdAt: typedData.createdAt ?? null,
            disabledMenus: normalizedDisabledMenus,
            isLocked: typeof isLockedValue === 'boolean' ? isLockedValue : false,
          };
        });
      }

      if (!foundUser) {
        const employeesRef = collection(db, 'employees');
        const employeeQuery = query(employeesRef, where('employeeIdNumber', '==', normalizedUserId));
        const employeeSnapshot = await getDocs(employeeQuery);
        
        if (!employeeSnapshot.empty) {
          const employeeDoc = employeeSnapshot.docs[0];
          const employeeData = employeeDoc.data();
          
          const employeeAsUser: User = {
            id: employeeDoc.id,
            userId: employeeData.employeeIdNumber || employeeDoc.id, // Use employeeIdNumber as login ID
            name: employeeData.name || 'Unknown Employee',
            role: (employeeData.role as UserRole) || 'General Worker',
            companyIds: employeeData.companyId ? [employeeData.companyId] : normalizeStringArray(employeeData.companyIds || []), // Ensure companyIds array
            currentCompanyId: employeeData.companyId || undefined, // Use companyId field from employee
            siteId: employeeData.siteId,
            siteName: employeeData.siteName || undefined,
            masterAccountId: employeeData.masterAccountId || employeeData.companyId, // Use companyId if no masterAccountId
            pin: employeeData.pin || undefined,
            createdAt: employeeData.createdAt,
            disabledMenus: [],
            isLocked: false,
          };
          
          if (!employeeAsUser.pin && !isSettingUpPin) {
            return { success: false, isFirstTime: true };
          }
          
          if (isSettingUpPin && !employeeAsUser.pin) {
            // Setting up PIN for first time
            if (!normalizedPin) {
              return { success: false, error: 'PIN is required' };
            }
            
            // Update employee document with new PIN
            const employeeRef = doc(db, 'employees', employeeAsUser.id);
            await updateDoc(employeeRef, { pin: normalizedPin });
            employeeAsUser.pin = normalizedPin;
          } else if (employeeAsUser.pin) {
            if (!normalizedPin) {
              return { success: false, requiresPin: true };
            }
            
            if (employeeAsUser.pin !== normalizedPin) {
              return { success: false, error: 'Incorrect PIN' };
            }
          }
          
          const userDataToStore = JSON.stringify(employeeAsUser);
          await AsyncStorage.setItem(STORAGE_KEYS.USER, userDataToStore);
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, userDataToStore);
          
          setUser(employeeAsUser);
          setIsOffline(false);
          
          return { success: true, user: employeeAsUser };
        }
        
        return { success: false, error: 'User not found' };
      }

      const userToLogin: User = foundUser;

      if (userToLogin.isLocked && userToLogin.role !== 'master') {
        return { success: false, error: 'Account is locked. Contact administrator.' };
      }

      if (!userToLogin.pin && !isSettingUpPin) {
        return { success: false, isFirstTime: true };
      }

      if (isSettingUpPin && !userToLogin.pin) {
        if (!normalizedPin) {
          return { success: false, error: 'PIN is required' };
        }
        
        const userRef = doc(db, 'users', userToLogin.id);
        await setDoc(userRef, { pin: normalizedPin }, { merge: true });
        userToLogin.pin = normalizedPin;
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(userToLogin));
      } else if (userToLogin.pin) {
        if (!normalizedPin) {
          return { success: false, requiresPin: true };
        }
        
        const storedPin = userToLogin.pin;
        const providedPin = normalizedPin;
        
        if (storedPin !== providedPin) {
          return { success: false, error: 'Incorrect PIN' };
        }
      }
      
      // Save to AsyncStorage for session persistence  
      const userDataToStore = JSON.stringify(userToLogin);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, userDataToStore);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, userDataToStore);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());

      setUser(userToLogin);
      setIsOffline(false);
      
      if (OFFLINE_CONFIG.ENABLE_OFFLINE_QUEUE && userToLogin.siteId) {
        console.log('[Auth] Pre-caching users for offline access...');
        const cacheResult = await precacheUsers(userToLogin.siteId);
        if (cacheResult.success) {
          console.log('[Auth] Successfully cached', cacheResult.count, 'users for offline access');
        } else {
          console.warn('[Auth] Failed to cache users:', cacheResult.error);
        }
      }
      
      return { success: true, user: userToLogin };
    } catch (error) {
      console.error('[Auth] Login error:', error);
      setIsOffline(true);
      
      const normalizedUserId = userId.trim();
      const normalizedPin = pin ? pin.trim() : '';
      
      const cachedUser = await getCachedUserById(normalizedUserId);
      if (cachedUser) {
        if (cachedUser.pin) {
          const cachedStoredPin = String(cachedUser.pin).trim();
          const cachedProvidedPin = normalizedPin;
          if (cachedStoredPin !== cachedProvidedPin) {
            return { success: false, error: 'Incorrect PIN (offline mode)' };
          }
        }
        
        if (!cachedUser.pin && !isSettingUpPin) {
          return { success: false, isFirstTime: true };
        }
        
        const userToLogin: User = {
          id: cachedUser.id,
          userId: cachedUser.userId,
          name: cachedUser.name,
          role: cachedUser.role as UserRole,
          companyIds: normalizeStringArray((cachedUser as any).companyIds),
          currentCompanyId: (cachedUser as any).currentCompanyId,
          pin: cachedUser.pin,
          siteId: cachedUser.siteId,
          siteName: cachedUser.siteName,
          companyName: cachedUser.companyName,
          masterAccountId: cachedUser.masterAccountId,
          createdAt: null,
          disabledMenus: cachedUser.disabledMenus ?? [],
          isLocked: cachedUser.isLocked ?? false,
        };
        
        if (userToLogin.isLocked && userToLogin.role !== 'master') {
          return { success: false, error: 'Account is locked. Contact administrator.' };
        }
        
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(userToLogin));
        setUser(userToLogin);
        return { success: true, user: userToLogin };
      }
      
      const { employee, user: linkedUser } = await getCachedEmployeeWithUser(normalizedUserId);
      if (employee || linkedUser) {
        const dataToUse = linkedUser || employee;
        
        if (dataToUse && dataToUse.pin) {
          const cachedStoredPin = String(dataToUse.pin).trim();
          const cachedProvidedPin = normalizedPin;
          if (cachedStoredPin !== cachedProvidedPin) {
            return { success: false, error: 'Incorrect PIN (offline mode)' };
          }
          
          const userToLogin: User = linkedUser ? {
            id: linkedUser.id,
            userId: linkedUser.userId,
            name: linkedUser.name,
            role: linkedUser.role as UserRole,
            companyIds: [],
            siteId: linkedUser.siteId,
            siteName: linkedUser.siteName,
            masterAccountId: linkedUser.masterAccountId,
            pin: linkedUser.pin,
            createdAt: null,
            disabledMenus: linkedUser.disabledMenus || [],
            isLocked: linkedUser.isLocked || false,
          } : {
            id: employee!.id,
            userId: employee!.employeeId,
            name: employee!.name + (employee!.surname ? ` ${employee!.surname}` : ''),
            role: (employee!.linkedUserRole || 'Operator') as UserRole,
            companyIds: [],
            siteId: employee!.siteId,
            siteName: employee!.siteName,
            masterAccountId: employee!.companyId || '',
            pin: employee!.pin,
            createdAt: null,
            disabledMenus: [],
            isLocked: false,
          };
          
          if (userToLogin.isLocked && userToLogin.role !== 'master') {
            return { success: false, error: 'Account is locked. Contact administrator.' };
          }
          
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(userToLogin));
          setUser(userToLogin);
          return { success: true, user: userToLogin };
        }
        
        if (!dataToUse?.pin && !isSettingUpPin) {
          return { success: false, isFirstTime: true };
        }
      }
      
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const lastKnownUser = storedUser ? null : await AsyncStorage.getItem(STORAGE_KEYS.LAST_KNOWN_USER);
      const fallbackPayload = storedUser ?? lastKnownUser;
      if (fallbackPayload) {
        const userData = JSON.parse(fallbackPayload);
        const storedUserId = String(userData.userId ?? '').trim();
        if (storedUserId.toLowerCase() === normalizedUserId.toLowerCase()) {
          if (userData.pin) {
            const fallbackStoredPin = String(userData.pin).trim();
            const fallbackProvidedPin = normalizedPin;
            if (fallbackStoredPin !== fallbackProvidedPin) {
              return { success: false, error: 'Incorrect PIN (offline mode)' };
            }
          }
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(userData));
          setUser(userData);
          return { success: true, user: userData };
        }
      }

      return { success: false, error: 'No internet connection and no offline data' };
    }
  }, [user]);

  const setupPin = useCallback(async (pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!user) {
        return { success: false, error: 'No user logged in' };
      }

      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, { pin }, { merge: true });

      const updatedUser = { ...user, pin };
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(updatedUser));
      setUser(updatedUser);

      console.log('[Auth] PIN setup successful');
      return { success: true };
    } catch (error) {
      console.error('[Auth] Error setting up PIN:', error);
      return { success: false, error: 'Failed to setup PIN' };
    }
  }, [user]);

  const createSite = useCallback(async (
    siteName: string,
    description?: string,
    location?: string
  ): Promise<{ success: boolean; error?: string; siteId?: string }> => {
    try {
      // Check for master role in either user or masterAccount
      const isMaster = user?.role === 'master' || !!masterAccount;
      const masterData = user?.role === 'master' ? user : masterAccount;
      
      if (!isMaster || !masterData) {
        return { success: false, error: 'Not logged in as master' };
      }

      // Get the current company ID from various sources
      // First check if there's a selected company ID in AsyncStorage
      const selectedCompanyId = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_COMPANY);
      
      const companyId = selectedCompanyId || 
                       masterData.currentCompanyId || 
                       (masterData.companyIds && masterData.companyIds.length > 0 ? masterData.companyIds[0] : null);
      
      if (!companyId) {
        return { success: false, error: 'No company selected. Please select a company first.' };
      }

      const sitesRef = collection(db, 'sites');
      const siteQuery = query(
        sitesRef, 
        where('name', '==', siteName), 
        where('companyId', '==', companyId)
      );
      const siteSnapshot = await getDocs(siteQuery);
      
      if (!siteSnapshot.empty) {
        return { success: false, error: 'Site name already exists for this company' };
      }

      const siteRef = await addDoc(collection(db, 'sites'), {
        name: siteName,
        companyId: companyId,
        masterAccountId: masterData.id,
        description: description || '',
        location: location || '',
        status: 'Active' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('[Auth] Site created:', siteRef.id);
      return { success: true, siteId: siteRef.id };
    } catch (error) {
      console.error('[Auth] Error creating site:', error);
      return { success: false, error: 'Failed to create site' };
    }
  }, [user, masterAccount]);

  const updateSite = useCallback(async (
    siteId: string,
    updates: Partial<Pick<Site, 'name' | 'description' | 'location' | 'status'>>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Check for master role in either user or masterAccount
      const isMaster = user?.role === 'master' || !!masterAccount;
      const masterData = user?.role === 'master' ? user : masterAccount;
      
      console.log('[Auth] updateSite check - isMaster:', isMaster, 'user role:', user?.role, 'masterAccount:', !!masterAccount);
      
      if (!isMaster || !masterData) {
        console.log('[Auth] updateSite - Not authorized as master');
        return { success: false, error: 'Not logged in as master' };
      }

      const siteRef = doc(db, 'sites', siteId);
      await updateDoc(siteRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      console.log('[Auth] Site updated:', siteId);
      return { success: true };
    } catch (error) {
      console.error('[Auth] Error updating site:', error);
      return { success: false, error: 'Failed to update site' };
    }
  }, [user, masterAccount]);

  const archiveSite = useCallback(async (
    siteId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Check for master role in either user or masterAccount
      const isMaster = user?.role === 'master' || !!masterAccount;
      const masterData = user?.role === 'master' ? user : masterAccount;
      
      console.log('[Auth] archiveSite check - isMaster:', isMaster, 'user role:', user?.role, 'masterAccount:', !!masterAccount);
      
      if (!isMaster || !masterData) {
        console.log('[Auth] archiveSite - Not authorized as master');
        return { success: false, error: 'Not logged in as master' };
      }

      const siteRef = doc(db, 'sites', siteId);
      await updateDoc(siteRef, {
        status: 'Archived' as const,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('[Auth] Site archived:', siteId);
      return { success: true };
    } catch (error) {
      console.error('[Auth] Error archiving site:', error);
      return { success: false, error: 'Failed to archive site' };
    }
  }, [user, masterAccount]);

  const openSite = useCallback(async (
    siteId: string,
    siteName: string,
    siteCompanyId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const activeMaster: MasterAccount | null = masterAccount ?? (user?.role === 'master'
        ? {
            id: user.masterAccountId ?? user.id,
            masterId: user.userId,
            name: user.name,
            pin: user.pin ?? '',
            companyIds: user.companyIds || [],
            currentCompanyId: user.currentCompanyId,
            createdAt: user.createdAt,
          }
        : null);

      if (!activeMaster) {
        return { success: false, error: 'Not logged in as master' };
      }

      const storedSelectedCompany = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_COMPANY);
      const resolvedCompanyId = siteCompanyId ?? storedSelectedCompany ?? activeMaster.currentCompanyId ?? user?.currentCompanyId ?? null;

      const usersRef = collection(db, 'users');
      const userQuery = query(
        usersRef,
        where('siteId', '==', siteId),
        where('role', '==', 'master'),
        where('masterAccountId', '==', activeMaster.id)
      );
      const userSnapshot = await getDocs(userQuery);

      let masterUser: User;

      if (userSnapshot.empty) {
        const newUserRef = await addDoc(collection(db, 'users'), {
          userId: `master-${activeMaster.masterId}`,
          name: activeMaster.name,
          role: 'master',
          companyIds: activeMaster.companyIds || [],
          siteId,
          siteName,
          masterAccountId: activeMaster.id,
          pin: activeMaster.pin,
          currentCompanyId: resolvedCompanyId,
          createdAt: serverTimestamp(),
        });

        masterUser = {
          id: newUserRef.id,
          userId: `master-${activeMaster.masterId}`,
          name: activeMaster.name,
          role: 'master',
          companyIds: activeMaster.companyIds || [],
          currentCompanyId: resolvedCompanyId ?? undefined,
          siteId,
          siteName,
          masterAccountId: activeMaster.id,
          pin: activeMaster.pin,
          createdAt: serverTimestamp(),
        };
      } else {
        const docSnap = userSnapshot.docs[0];
        const data = docSnap.data();
        const existingCompanyIds = Array.isArray(data.companyIds) ? data.companyIds : [];
        const mergedCompanyIds = resolvedCompanyId && !existingCompanyIds.includes(resolvedCompanyId)
          ? [...existingCompanyIds, resolvedCompanyId]
          : existingCompanyIds;

        masterUser = {
          id: docSnap.id,
          userId: data.userId || '',
          name: data.name || '',
          role: 'master',
          companyIds: mergedCompanyIds,
          currentCompanyId: resolvedCompanyId ?? data.currentCompanyId,
          siteId: data.siteId,
          siteName: data.siteName,
          masterAccountId: data.masterAccountId,
          pin: data.pin,
          createdAt: data.createdAt,
        };
      }

      if (resolvedCompanyId && !(masterUser.companyIds || []).includes(resolvedCompanyId)) {
        masterUser = {
          ...masterUser,
          companyIds: [...(masterUser.companyIds || []), resolvedCompanyId],
        };
      }

      // Fetch and add company name to masterUser
      if (resolvedCompanyId) {
        const companyName = await fetchCompanyName(resolvedCompanyId);
        if (companyName) {
          masterUser = {
            ...masterUser,
            companyName,
          };
          console.log('[Auth] openSite - Added company name to user:', companyName);
        }
      }

      // CRITICAL: Always save both user and masterAccount status to AsyncStorage
      const userDataToStore = JSON.stringify(masterUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, userDataToStore);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, userDataToStore);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
      if (resolvedCompanyId) {
        await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_COMPANY, resolvedCompanyId);
      }

      console.log('[Auth] openSite - Setting user and masterAccount states');
      console.log('[Auth] openSite - masterUser role:', masterUser.role);
      console.log('[Auth] openSite - activeMaster:', activeMaster);
      
      // CRITICAL: Update masterAccount's currentCompanyId to match
      const updatedMasterAccount: MasterAccount = {
        ...activeMaster,
        currentCompanyId: resolvedCompanyId ?? activeMaster.currentCompanyId
      };
      
      setUser(masterUser);
      // ALWAYS set/update masterAccount state to preserve master permissions
      setMasterAccount(updatedMasterAccount);
      
      console.log('[Auth] openSite - States set successfully');

      return { success: true };
    } catch (error) {
      console.error('[Auth] Error opening site:', error);
      return { success: false, error: 'Failed to open site' };
    }
  }, [masterAccount, user]);

  const refreshMasterAccount = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[Auth] Refreshing master account data from database...');
      
      const currentMaster = masterAccount || (user?.role === 'master' && user.masterAccountId ? { id: user.masterAccountId } : null);
      
      if (!currentMaster?.id) {
        console.log('[Auth] No master account to refresh');
        return { success: false, error: 'No master account found' };
      }

      const masterRef = doc(db, 'masterAccounts', currentMaster.id);
      const masterDoc = await getDoc(masterRef);
      
      if (!masterDoc.exists()) {
        console.log('[Auth] Master account document not found');
        return { success: false, error: 'Master account not found' };
      }

      const data = masterDoc.data();
      const companyIdsArray = data.companyIds || [];
      
      const refreshedMaster: MasterAccount = {
        id: masterDoc.id,
        masterId: data.masterId as string,
        name: data.name as string,
        pin: String(data.pin || '').trim(),
        companyIds: Array.isArray(companyIdsArray) ? companyIdsArray : [],
        currentCompanyId: data.currentCompanyId,
        createdAt: data.createdAt,
      };
      
      console.log('[Auth] Master account refreshed with', refreshedMaster.companyIds.length, 'companies');
      setMasterAccount(refreshedMaster);
      
      // Also update user state if master is logged in as user
      if (user?.role === 'master') {
        const updatedUser = {
          ...user,
          companyIds: refreshedMaster.companyIds,
        };
        setUser(updatedUser);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(updatedUser));
      }
      
      return { success: true };
    } catch (error) {
      console.error('[Auth] Error refreshing master account:', error);
      return { success: false, error: 'Failed to refresh master account' };
    }
  }, [masterAccount, user]);

  const selectCompany = useCallback(async (
    companyId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[Auth] Selecting company:', companyId);
      
      if (!user && !masterAccount) {
        return { success: false, error: 'Not logged in' };
      }

      // Fetch company details to get company name
      const companyName = await fetchCompanyName(companyId);
      console.log('[Auth] Fetched company name:', companyName);

      // Handle master accounts that are logged in as users (unified system)
      if (user && user.role === 'master') {
        const updatedUser = { ...user, currentCompanyId: companyId, companyName };
        setUser(updatedUser);
        
        // Also update masterAccount if it exists
        if (masterAccount) {
          const updatedMaster = { ...masterAccount, currentCompanyId: companyId };
          setMasterAccount(updatedMaster);
        }
        
        // Save updated user to storage
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(updatedUser));
        await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_COMPANY, companyId);
        console.log('[Auth] Company selected for master user:', companyId, companyName);
        return { success: true };
      }

      // Handle regular users
      if (user) {
        const updatedUser = { ...user, currentCompanyId: companyId, companyName };
        setUser(updatedUser);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(updatedUser));
        console.log('[Auth] Company selected for user');
        return { success: true };
      }

      // Handle legacy masterAccount only (shouldn't happen with new unified login)
      if (masterAccount) {
        const updatedMaster = { ...masterAccount, currentCompanyId: companyId };
        setMasterAccount(updatedMaster);
        
        // Also create a user representation for compatibility
        const masterAsUser: User = {
          id: updatedMaster.id,
          userId: updatedMaster.masterId,
          name: updatedMaster.name,
          role: 'master',
          companyIds: updatedMaster.companyIds,
          currentCompanyId: companyId,
          companyName,
          pin: updatedMaster.pin,
          masterAccountId: updatedMaster.id,
          createdAt: updatedMaster.createdAt,
          disabledMenus: [],
          isLocked: false
        };
        setUser(masterAsUser);
        
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(masterAsUser));
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_USER, JSON.stringify(masterAsUser));
        console.log('[Auth] Company selected for legacy master');
        return { success: true };
      }

      return { success: false, error: 'Unknown error' };
    } catch (error) {
      console.error('[Auth] Error selecting company:', error);
      return { success: false, error: 'Failed to select company' };
    }
  }, [user, masterAccount]);

  return useMemo(
    () => ({
      user,
      masterAccount,
      isLoading,
      authInitializing,
      isOffline,
      createMasterAccount,
      loginWithId,
      setupPin,
      logout,
      updateActivity,
      createSite,
      updateSite,
      archiveSite,
      openSite,
      selectCompany,
      refreshMasterAccount,
    }),
    [user, masterAccount, isLoading, authInitializing, isOffline, createMasterAccount, loginWithId, setupPin, logout, updateActivity, createSite, updateSite, archiveSite, openSite, selectCompany, refreshMasterAccount]
  );
});
