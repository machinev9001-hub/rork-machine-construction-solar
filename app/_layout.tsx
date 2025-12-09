import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, usePathname } from "expo-router";
import React, { useEffect, Component, ErrorInfo, ReactNode, useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, InteractionManager, LayoutChangeEvent } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RootSiblingParent } from 'react-native-root-siblings';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { isManagementRole, isOperatorRole } from "../utils/roles";
import OfflineBanner from "../components/OfflineBanner";
import { offlineQueue } from "../utils/offlineQueue";
import { sitePackManager } from "../utils/sitePackManager";
import { dataFreshnessManager } from "../utils/dataFreshnessSync";
import FreshnessNotificationBanner from "../components/FreshnessNotificationBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorMessage = error?.message || '';
    
    if (errorMessage.includes('Unable to activate keep awake')) {
      console.warn('[ErrorBoundary] Non-critical keep-awake error ignored');
      return { hasError: false, error: null };
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorMessage = error?.message || '';
    
    if (errorMessage.includes('Unable to activate keep awake')) {
      console.warn('[ErrorBoundary] Non-critical keep-awake error suppressed:', error);
      this.setState({ hasError: false, error: null });
      return;
    }
    
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorBoundaryStyles.container}>
          <View style={errorBoundaryStyles.content}>
            <Text style={errorBoundaryStyles.title}>Something went wrong</Text>
            <Text style={errorBoundaryStyles.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            <TouchableOpacity
              style={errorBoundaryStyles.button}
              onPress={() => {
                this.setState({ hasError: false, error: null });
                router.replace('/login');
              }}
            >
              <Text style={errorBoundaryStyles.buttonText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorBoundaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  message: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center' as const,
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});

interface RootLayoutNavProps {
  onReady: () => void;
}

function RootLayoutNav({ onReady }: RootLayoutNavProps) {
  const { user, masterAccount, isLoading, authInitializing } = useAuth();
  const [renderKey, setRenderKey] = useState(0);
  const navigationAttempted = useRef(false);
  const qrLoginInProgress = useRef(false);
  const pathname = usePathname();
  const previousUserIdRef = useRef<string | null>(null);

  // Debug logging
  useEffect(() => {
    console.log('[RootLayoutNav Debug] State:', JSON.stringify({
      isLoading,
      authInitializing,
      hasUser: !!user,
      userRole: user?.role,
      hasMasterAccount: !!masterAccount,
      pathname
    }));
    
    if (user) {
      console.log('[RootLayoutNav Debug] User details:', JSON.stringify(user));
    }
  }, [isLoading, authInitializing, user, masterAccount, pathname]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useEffect(() => {
    if (!isLoading) {
      setRenderKey(prev => prev + 1);
    }
  }, [isLoading]);

  useEffect(() => {
    if (authInitializing || isLoading) {
      console.log('[RootLayoutNav] Auth initializing or loading, waiting...', { authInitializing, isLoading });
      return;
    }
    
    const currentUserId = user?.userId || masterAccount?.masterId || null;
    const currentUserRole = user?.role || null;
    
    if (currentUserId !== previousUserIdRef.current) {
      console.log('[RootLayout] User changed from', previousUserIdRef.current, 'to', currentUserId, 'role:', currentUserRole);
      console.log('[RootLayout] Resetting navigationAttempted flag and qrLoginInProgress');
      navigationAttempted.current = false;
      qrLoginInProgress.current = false;
      previousUserIdRef.current = currentUserId;
    }
    
    const currentPath = pathname ?? '/';
    console.log('[RootLayout] Current path:', currentPath);
    console.log('[RootLayout] User:', user?.userId, 'Role:', user?.role);
    console.log('[RootLayout] Master:', masterAccount?.masterId);
    console.log('[RootLayout] Navigation attempted:', navigationAttempted.current);
    
    const publicPaths = ['/login', '/master-signup', '/activate', '/setup-master-pin', '/setup-employee-pin', '/admin-pin-verify', '/admin-panel', '/company-selector', '/company-setup', '/qr-scanner'];
    const setupPaths = ['/setup-master-pin', '/setup-employee-pin'];
    
    if (!user && !masterAccount) {
      if (!publicPaths.includes(currentPath) && !navigationAttempted.current) {
        console.log('[RootLayout] No user, redirecting to login from:', currentPath);
        navigationAttempted.current = true;
        router.replace('/login');
      }
      return;
    }
    
    if ((user || masterAccount) && setupPaths.includes(currentPath)) {
      console.log('[RootLayout] User on setup path, not interfering');
      return;
    }
    
    if ((user || masterAccount) && publicPaths.includes(currentPath)) {
      navigationAttempted.current = false;
    }
    
    // CRITICAL: Only check user.role for master routing, NOT masterAccount state
    // masterAccount is just a cached reference and shouldn't affect routing logic
    const isMasterUser = user?.role === 'master';
    if (isMasterUser) {
      const masterData = user;
      const hasCompanies = masterData?.companyIds && masterData.companyIds.length > 0;
      const hasSelectedCompany = !!masterData?.currentCompanyId;
      const hasSelectedSite = !!(user?.siteId && user?.siteName);
      
      console.log('[RootLayout] Master account state:');
      console.log('[RootLayout]   isMasterUser:', isMasterUser);
      console.log('[RootLayout]   hasCompanies:', hasCompanies, 'IDs:', masterData?.companyIds);
      console.log('[RootLayout]   hasSelectedCompany:', hasSelectedCompany, 'Current:', masterData?.currentCompanyId);
      console.log('[RootLayout]   hasSelectedSite:', hasSelectedSite, 'Site:', user?.siteName);
      
      if (!hasCompanies && currentPath !== '/company-setup' && !navigationAttempted.current) {
        console.log('[RootLayout] ✅ Master has no companies → Routing to /company-setup');
        navigationAttempted.current = true;
        router.replace('/company-setup');
        return;
      }
      
      if (hasCompanies && !hasSelectedCompany && currentPath !== '/company-selector' && !navigationAttempted.current) {
        console.log('[RootLayout] ✅ Master has companies but none selected → Routing to /company-selector');
        navigationAttempted.current = true;
        router.replace('/company-selector');
        return;
      }
      
      if (hasSelectedCompany && hasSelectedSite && currentPath !== '/(tabs)' && !publicPaths.includes(currentPath) && !navigationAttempted.current && !currentPath.startsWith('/(tabs)')) {
        console.log('[RootLayout] ✅ Master has selected company and site → Routing to /(tabs)');
        navigationAttempted.current = true;
        router.replace('/(tabs)');
        return;
      }
      
      if (hasSelectedCompany && !hasSelectedSite && currentPath !== '/master-sites' && !publicPaths.includes(currentPath) && !navigationAttempted.current) {
        console.log('[RootLayout] ✅ Master account with selected company but no site → Routing to /master-sites');
        navigationAttempted.current = true;
        router.replace('/master-sites');
      }
      return;
    }
    
    if (user) {
      const hasCompanies = user.companyIds && user.companyIds.length > 0;
      const hasSelectedCompany = !!user.currentCompanyId;
      const isManagementUser = isManagementRole(user.role);
      
      console.log('[RootLayout] User check - role:', user.role, 'isManagement:', isManagementUser, 'path:', currentPath);
      
      if (currentPath === '/qr-scanner') {
        console.log('[RootLayout] ⏸️  User is on QR scanner screen, BLOCKING all auto-navigation');
        qrLoginInProgress.current = true;
        return;
      }
      
      if (qrLoginInProgress.current && currentPath !== '/qr-scanner') {
        console.log('[RootLayout] QR login completed, user is now on:', currentPath);
        qrLoginInProgress.current = false;
      }
      
      if (hasCompanies && !hasSelectedCompany && currentPath !== '/company-selector' && !navigationAttempted.current) {
        console.log('[RootLayout] ✅ User has companies but none selected → Routing to /company-selector');
        navigationAttempted.current = true;
        router.replace('/company-selector');
        return;
      }
      
      if (publicPaths.includes(currentPath) && !navigationAttempted.current && !qrLoginInProgress.current) {
        console.log('[RootLayout] ✅ User logged in from public path, routing to home screen');
        console.log('[RootLayout]   User ID:', user.userId, 'Role:', user.role);
        navigationAttempted.current = true;
        
        const isOperator = isOperatorRole(user.role);
        const destination = isManagementUser ? '/(tabs)' : isOperator ? '/operator-home' : '/employee-timesheet';
        
        console.log('[RootLayout] Is management role:', isManagementUser, '(role:', user.role, ') Routing to:', destination);
        
        setTimeout(() => {
          try {
            router.replace(destination as any);
            console.log('[RootLayout] Navigation completed');
          } catch (error) {
            console.error('[RootLayout] Navigation error:', error);
            navigationAttempted.current = false;
          }
        }, 50);
      }
    }
  }, [user, masterAccount, isLoading, authInitializing, pathname]);

  if (isLoading || authInitializing) {
    console.log('[RootLayout] Rendering loading screen...', { isLoading, authInitializing });
    return (
      <LinearGradient
        colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
        style={{ flex: 1 }}
      >
        <View 
          style={{ 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center'
          }}
        >
          <View style={{ alignItems: 'center', gap: 16 }}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={{ 
              fontSize: 28, 
              color: '#ffffff', 
              fontWeight: '700' as const 
            }}>Machine App</Text>
            <Text style={{ 
              fontSize: 14, 
              color: '#cbd5e1'
            }}>Loading...</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  console.log('[RootLayout] Loading complete, rendering main app');

  return (
    <View key={`app-${renderKey}`} style={{ flex: 1, pointerEvents: 'auto' }} collapsable={false}>
      <OfflineBanner showDetails={false} />
      <FreshnessNotificationBanner />
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: {
            backgroundColor: '#000000',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '600' as const,
            color: '#FFFFFF',
          },
          headerTitleAlign: 'left',
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="activate" options={{ headerShown: false }} />
        <Stack.Screen name="setup-master-pin" options={{ headerShown: false }} />
        <Stack.Screen name="setup-employee-pin" options={{ headerShown: false }} />
        <Stack.Screen name="admin-pin-verify" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="admin-panel" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="supervisor-activity" />
        <Stack.Screen name="supervisor-task-request" />
        <Stack.Screen name="supervisor-task-detail" />
        <Stack.Screen name="company-settings" />
        <Stack.Screen name="manage-users" />
        <Stack.Screen name="add-user" />
        <Stack.Screen name="master-planner" />
        <Stack.Screen name="master-supervisor" />
        <Stack.Screen name="planner-task-requests" />
        <Stack.Screen name="planner-activity-requests" />
        <Stack.Screen name="planner-qc-requests" />
        <Stack.Screen name="planner-cabling-requests" />
        <Stack.Screen name="planner-termination-requests" />
        <Stack.Screen name="master-sites" />
        <Stack.Screen name="planner-surveyor-requests" />
        <Stack.Screen name="edit-user" />
        <Stack.Screen name="master-plant-manager" />
        <Stack.Screen name="master-staff-manager" />
        <Stack.Screen name="master-logistics-manager" />
        <Stack.Screen name="planner-handover-requests" />
        <Stack.Screen name="planner-concrete-requests" />
        <Stack.Screen name="master-dashboard" />
        <Stack.Screen name="plant-allocation-requests" />
        <Stack.Screen name="employee-timesheet" options={{ headerShown: false }} />
        <Stack.Screen name="employee-profile" options={{ headerShown: false }} />
        <Stack.Screen name="operator-home" options={{ headerShown: false }} />
        <Stack.Screen name="operator-man-hours" options={{ headerShown: false }} />
        <Stack.Screen name="operator-plant-hours" options={{ headerShown: false }} />
        <Stack.Screen name="operator-checklist" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  console.log('[RootLayout] Component rendering - TOP LEVEL');
  const hasHiddenSplash = useRef(false);
  const hasInitializedManagers = useRef(false);

  const handleNavReady = useCallback(() => {
    // Navigation ready callback (kept for future use)
  }, []);

  const handleRootLayout = useCallback((_event: LayoutChangeEvent) => {
    if (hasHiddenSplash.current) {
      return;
    }

    hasHiddenSplash.current = true;
    console.log('[RootLayout] Layout ready');
  }, []);

  useEffect(() => {
    if (hasInitializedManagers.current) {
      return;
    }
    hasInitializedManagers.current = true;

    InteractionManager.runAfterInteractions(() => {
      console.log('[RootLayout] Starting non-blocking background initialization...');
      
      const isIOS = Platform.OS === 'ios';
      const offlineTimeout = isIOS ? 600 : 1200;
      const sitePackTimeout = isIOS ? 400 : 800;
      
      (async () => {
        try {
          console.log('[RootLayout] Initializing offlineQueue (timeout:', offlineTimeout, 'ms)...');
          await offlineQueue.init(offlineTimeout);
          console.log('[RootLayout] ✓ offlineQueue initialized');
        } catch (err) {
          console.warn('[RootLayout] offlineQueue init failed, will retry in background:', err);
        }

        try {
          console.log('[RootLayout] Initializing sitePackManager (timeout:', sitePackTimeout, 'ms)...');
          await sitePackManager.init(sitePackTimeout);
          console.log('[RootLayout] ✓ sitePackManager initialized');
        } catch (err) {
          console.warn('[RootLayout] sitePackManager init failed (non-fatal):', err);
        }

        try {
          console.log('[RootLayout] Initializing dataFreshnessManager...');
          await dataFreshnessManager.init();
          console.log('[RootLayout] ✓ dataFreshnessManager initialized');
        } catch (err) {
          console.warn('[RootLayout] dataFreshnessManager init failed (non-fatal):', err);
        }
      })().catch(err => {
        console.warn('[RootLayout] Background initialization error (non-fatal):', err?.message || err);
      });
    });
  }, []);

  console.log('[RootLayout] About to render providers...');
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootSiblingParent>
            <GestureHandlerRootView style={{ flex: 1 }} onLayout={handleRootLayout}>
              <RootLayoutNav onReady={handleNavReady} />
            </GestureHandlerRootView>
          </RootSiblingParent>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
