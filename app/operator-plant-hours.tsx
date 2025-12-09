import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Home, Settings, Truck } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import PlantAssetHoursTimesheet from '@/components/PlantAssetHoursTimesheet';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset } from '@/types';

export default function OperatorPlantHoursScreen() {
  const { plantAssetId } = useLocalSearchParams<{ plantAssetId?: string }>();
  const { user } = useAuth();
  const [scannedAsset, setScannedAsset] = useState<PlantAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      setScannedAsset(null);
    };
  }, []);

  useEffect(() => {
    const checkForScannedPlant = async () => {
      if (plantAssetId && !scannedAsset) {
        setIsLoading(true);
        try {
          const plantAssetsQuery = query(
            collection(db, 'plantAssets'),
            where('assetId', '==', plantAssetId),
            where('masterAccountId', '==', user?.masterAccountId || '')
          );
          
          const snapshot = await getDocs(plantAssetsQuery);
          
          if (!snapshot.empty) {
            const plantDoc = snapshot.docs[0];
            const plantData = { id: plantDoc.id, ...plantDoc.data() } as PlantAsset;
            setScannedAsset(plantData);
          } else {
            Alert.alert('Error', 'Plant asset not found');
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to load plant asset');
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    checkForScannedPlant();
  }, [user?.masterAccountId, scannedAsset, plantAssetId]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{ 
          title: 'Machine Hours',
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTintColor: '#0f172a',
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerBackVisible: true,
          headerBackTitle: 'Back',
        }} 
      />

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading plant asset...</Text>
          </View>
        ) : !scannedAsset ? (
          <View style={styles.scanContainer}>
            <View style={styles.scanCard}>
              <View style={styles.scanIconContainer}>
                <Truck size={64} color="#3b82f6" strokeWidth={2} />
              </View>
              <Text style={styles.scanTitle}>Invalid Access</Text>
              <Text style={styles.scanDescription}>
                Please scan a plant asset QR code first
              </Text>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Text style={styles.backButtonText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <PlantAssetHoursTimesheet
              operatorId={user?.userId || user?.id || ''}
              operatorName={user?.name || ''}
              masterAccountId={user?.masterAccountId || ''}
              companyId={user?.companyIds?.[0]}
              siteId={user?.siteId}
              siteName={user?.siteName}
              scannedAssetId={scannedAsset.assetId}
              scannedAssetType={scannedAsset.type}
              scannedAssetLocation={scannedAsset.location}
              plantAssetDocId={scannedAsset.id!}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.push('/operator-home')}
        >
          <Home size={24} color="#64748b" strokeWidth={2} />
          <Text style={styles.navButtonText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.push('/operator-home')}
        >
          <Settings size={24} color="#64748b" strokeWidth={2} />
          <Text style={styles.navButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748b',
  },
  scanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scanCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxWidth: 400,
    width: '100%',
  },
  scanIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  scanTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  scanDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  backButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#fff',
    textAlign: 'center' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  navButtonText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500' as const,
  },
});
