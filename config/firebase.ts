import Constants from 'expo-constants';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, persistentLocalCache, persistentMultipleTabManager, initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Platform } from 'react-native';

const firebaseOptionKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const;
type FirebaseOptionKey = (typeof firebaseOptionKeys)[number];

type FirebaseRuntimeConfig = Record<FirebaseOptionKey, string>;

type FirebaseConfigKey =
  | 'EXPO_PUBLIC_FIREBASE_API_KEY'
  | 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'
  | 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'
  | 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'
  | 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  | 'EXPO_PUBLIC_FIREBASE_APP_ID';

const firebaseEnvKeyMap: Record<FirebaseConfigKey, FirebaseOptionKey> = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'apiKey',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'authDomain',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'projectId',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'storageBucket',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'messagingSenderId',
  EXPO_PUBLIC_FIREBASE_APP_ID: 'appId',
};

const DEFAULT_FIREBASE_CONFIG: FirebaseRuntimeConfig = {
  apiKey: 'AIzaSyBMhp3eYWbouy3a9xdp8fhDrNAuFDCsVpQ',
  authDomain: 'project-tracker-app-33cff.firebaseapp.com',
  projectId: 'project-tracker-app-33cff',
  storageBucket: 'project-tracker-app-33cff.appspot.com',
  messagingSenderId: '235534188025',
  appId: '1:235534188025:web:b7c49ea0c361988cf41128',
};

type FirebaseEnvironment = 'default' | string;

type ExpoFirebaseExtra = {
  firebase?: Partial<FirebaseRuntimeConfig>;
  firebaseEnvironments?: Record<string, Partial<FirebaseRuntimeConfig>>;
};


function normalizeFirebaseConfig(input: Partial<FirebaseRuntimeConfig> | undefined): Partial<FirebaseRuntimeConfig> {
  if (!input) {
    return {};
  }
  const normalized: Partial<FirebaseRuntimeConfig> = {};
  firebaseOptionKeys.forEach((optionKey) => {
    const rawValue = input[optionKey];
    if (typeof rawValue === 'string') {
      const trimmedValue = rawValue.trim();
      if (trimmedValue.length > 0) {
        normalized[optionKey] = trimmedValue;
      }
    }
  });
  return normalized;
}

function getExpoExtraFirebaseConfig(environment: FirebaseEnvironment): Partial<FirebaseRuntimeConfig> {
  const expoExtra = Constants?.expoConfig?.extra as ExpoFirebaseExtra | undefined;
  const manifestExtra = (Constants.manifest as { extra?: ExpoFirebaseExtra } | null)?.extra;
  const extrasSource = expoExtra ?? manifestExtra;
  if (!extrasSource) {
    console.log('[Firebase] No expo extra firebase configuration found');
    return {};
  }

  const normalizedEnvironment = environment.toLowerCase();
  const baseConfig = normalizeFirebaseConfig(extrasSource.firebase);
  const environmentConfig = normalizeFirebaseConfig(
    extrasSource.firebaseEnvironments?.[normalizedEnvironment] ??
      extrasSource.firebaseEnvironments?.[environment] ??
      extrasSource.firebaseEnvironments?.default,
  );

  return { ...baseConfig, ...environmentConfig };
}

function resolveFirebaseConfig(): FirebaseRuntimeConfig {
  const envInput = process.env.EXPO_PUBLIC_FIREBASE_ENV;
  if (!envInput) {
    console.log('[Firebase] EXPO_PUBLIC_FIREBASE_ENV not set, using single environment configuration');
  }
  const firebaseEnvironment: FirebaseEnvironment = (envInput ?? 'default').trim() || 'default';
  const suffix = firebaseEnvironment === 'default' ? '' : `_${firebaseEnvironment.toUpperCase()}`;
  console.log(`[Firebase] Target environment: ${firebaseEnvironment}`);

  const envSnapshot = JSON.parse(JSON.stringify(process.env ?? {})) as Record<string, string | undefined>;
  const resolvedConfig: Partial<FirebaseRuntimeConfig> = {};
  const missingKeys: FirebaseConfigKey[] = [];
  const extraConfig = getExpoExtraFirebaseConfig(firebaseEnvironment);

  (Object.keys(firebaseEnvKeyMap) as FirebaseConfigKey[]).forEach((envKey) => {
    const firebaseKey = firebaseEnvKeyMap[envKey];
    const candidates = suffix.length > 0 ? [`${envKey}${suffix}`, envKey] : [envKey];

    let resolvedValue: string | undefined;
    let sourceLabel = '';

    for (const candidate of candidates) {
      const candidateValue = envSnapshot[candidate];
      if (typeof candidateValue === 'string') {
        const trimmedCandidateValue = candidateValue.trim();
        if (trimmedCandidateValue.length > 0) {
          resolvedValue = trimmedCandidateValue;
          sourceLabel = `env:${candidate}`;
          break;
        }
      }
    }

    if (!resolvedValue) {
      const extraValue = extraConfig[firebaseKey];
      if (extraValue) {
        resolvedValue = extraValue;
        sourceLabel = `extra:${firebaseEnvironment}`;
      }
    }

    if (resolvedValue) {
      resolvedConfig[firebaseKey] = resolvedValue;
      console.log(`[Firebase] Loaded ${firebaseKey} from ${sourceLabel.length > 0 ? sourceLabel : 'extra:base'}`);
    } else {
      missingKeys.push(envKey);
    }
  });

  const combinedConfig = { ...DEFAULT_FIREBASE_CONFIG, ...resolvedConfig } as Partial<FirebaseRuntimeConfig>;

  if (missingKeys.length > 0) {
    console.warn(`[Firebase] Missing configuration for ${missingKeys.join(', ')}. Falling back to default Firebase project (Project Tracker - Live).`);
    console.warn('[Firebase] Add .env values if you need to switch environments; otherwise the app will use the live project.');
  }

  const missingAfterFallback = firebaseOptionKeys.filter((key) => {
    const candidate = combinedConfig[key];
    return typeof candidate !== 'string' || candidate.trim().length === 0;
  });

  if (missingAfterFallback.length > 0) {
    throw new Error(
      `[Firebase] Default configuration incomplete. Missing values for ${missingAfterFallback.join(', ')}.`,
    );
  }

  const finalConfig = combinedConfig as FirebaseRuntimeConfig;
  console.log(`[Firebase] Using Firebase project ${finalConfig.projectId}`);
  return finalConfig;
}

const firebaseConfig = resolveFirebaseConfig();

export const isDemoFirebaseProject = firebaseConfig.projectId === 'demo-project';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
console.log('[Firebase] App initialized');

const auth = getAuth(app);
console.log('[Firebase] Auth initialized');

let db: ReturnType<typeof getFirestore>;

if (Platform.OS === 'web') {
  console.log('[Firebase] Initializing web Firestore with persistence');
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
    console.log('[Firebase] Web Firestore initialized');
  } catch (error) {
    console.warn('[Firebase] Web persistence failed, using default:', error);
    db = getFirestore(app);
  }
} else {
  console.log('[Firebase] Initializing native Firestore');
  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    });
    console.log('[Firebase] Native Firestore initialized');
  } catch (error) {
    console.warn('[Firebase] Firestore init failed, using default:', error);
    db = getFirestore(app);
  }
}

export async function clearFirestoreCache() {
  if (typeof window === 'undefined') return;
  console.log('[Firebase] Cache clearing not available with new persistence API');
}

export { db, auth };
