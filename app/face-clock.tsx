import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LogIn,
  LogOut,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { haversineKm, formatDistance } from '@/utils/geo';
import {
  captureFaceImage,
  runLivenessCheck,
  computeEmbedding,
  compareEmbeddings,
  getDeviceInfo,
  checkOnline,
} from '@/utils/faceCapture';
import {
  getLocalTemplate,
  decryptAndGetEmbedding,
} from '@/utils/secureFaceStore';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { LatLon, Site } from '@/types';
import type { UserRole } from '@/contexts/AuthContext';

const ALLOWED_ROLES = new Set<UserRole>(['Planner', 'Supervisor', 'HSE', 'HR']);

type ClockStep =
  | 'idle'
  | 'checking_permissions'
  | 'getting_location'
  | 'checking_distance'
  | 'capturing_face'
  | 'checking_liveness'
  | 'computing_embedding'
  | 'matching'
  | 'saving';

export default function FaceClockScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [site, setSite] = useState<Site | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<ClockStep>('idle');
  const [locationInfo, setLocationInfo] = useState<{
    location?: LatLon;
    distanceKm?: number;
    accuracy?: number;
  }>({});

  const fetchSiteData = React.useCallback(async () => {
    if (!user?.siteId) return;
    try {
      const siteDoc = await getDoc(doc(db, 'sites', user.siteId));
      if (siteDoc.exists()) {
        setSite({ id: siteDoc.id, ...siteDoc.data() } as Site);
      }
    } catch (error) {
      console.error('[FaceClock] Error fetching site:', error);
    }
  }, [user?.siteId]);

  useEffect(() => {
    fetchSiteData();
  }, [fetchSiteData]);

  const handleFaceClock = async (isClockIn: boolean) => {
    if (!user || !site) {
      Alert.alert('Error', 'User or site information not available');
      return;
    }

    const hasPermission = ALLOWED_ROLES.has(user.role);
    if (!hasPermission) {
      Alert.alert('Permission Denied', "You don&apos;t have permission to use face clock-in");
      return;
    }

    if (!site.faceClockInEnabled) {
      Alert.alert('Not Enabled', 'Face clock-in is not enabled for this site');
      return;
    }

    if (!site.faceGeoCenter || !site.faceGeoRadiusKm) {
      Alert.alert(
        'Not Configured',
        'Site geofence not configured. Please ask Planner/Master to set coordinates and radius.'
      );
      return;
    }

    try {
      setIsProcessing(true);

      setCurrentStep('checking_permissions');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for face clock-in');
        return;
      }

      setCurrentStep('getting_location');
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const devicePos: LatLon = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      const distanceKm = haversineKm(devicePos, site.faceGeoCenter);

      setLocationInfo({
        location: devicePos,
        distanceKm,
        accuracy: loc.coords.accuracy || undefined,
      });

      setCurrentStep('checking_distance');
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (distanceKm > site.faceGeoRadiusKm) {
        await createFaceClockAttempt({
          site,
          user,
          isClockIn,
          devicePos,
          distanceKm,
          accuracy: loc.coords.accuracy || 0,
          matchScore: 0,
          livenessPassed: false,
          verificationState: 'rejected',
          rejectionReason: 'out_of_zone',
        });

        Alert.alert(
          'Out of Range',
          `You are ${formatDistance(distanceKm)} from the site center. Maximum allowed distance is ${formatDistance(site.faceGeoRadiusKm)}.`
        );
        return;
      }

      setCurrentStep('capturing_face');
      const image = await captureFaceImage();
      if (!image) {
        Alert.alert('Cancelled', 'Face capture was cancelled');
        return;
      }

      const requireLiveness = site.facePolicy?.requireLiveness ?? true;
      let livenessPassed = true;

      if (requireLiveness) {
        setCurrentStep('checking_liveness');
        const livenessResult = await runLivenessCheck(image);
        livenessPassed = livenessResult.passed;

        if (!livenessPassed) {
          await createFaceClockAttempt({
            site,
            user,
            isClockIn,
            devicePos,
            distanceKm,
            accuracy: loc.coords.accuracy || 0,
            matchScore: 0,
            livenessPassed: false,
            verificationState: 'rejected',
            rejectionReason: 'liveness_failed',
          });

          Alert.alert(
            'Liveness Failed',
            livenessResult.reason || 'Please try again with better lighting'
          );
          return;
        }
      }

      const template = await getLocalTemplate(user.id);
      if (!template) {
        const online = await checkOnline();
        if (!online) {
          await createFaceClockAttempt({
            site,
            user,
            isClockIn,
            devicePos,
            distanceKm,
            accuracy: loc.coords.accuracy || 0,
            matchScore: 0,
            livenessPassed,
            verificationState: 'pending',
            rejectionReason: 'no_template',
          });

          Alert.alert(
            'No Template',
            'No face enrollment found and you are offline. Please enroll or connect to the internet.'
          );
          return;
        } else {
          Alert.alert(
            'No Enrollment',
            'No face enrollment found. Please enroll first or use alternate clock-in method.'
          );
          return;
        }
      }

      setCurrentStep('computing_embedding');
      const embeddingResult = await computeEmbedding(image);

      setCurrentStep('matching');
      const templateEmbedding = await decryptAndGetEmbedding(template);
      const matchScore = compareEmbeddings(embeddingResult.embedding, templateEmbedding);

      const minScore = site.facePolicy?.minMatchScore ?? 0.8;
      if (matchScore < minScore) {
        await createFaceClockAttempt({
          site,
          user,
          isClockIn,
          devicePos,
          distanceKm,
          accuracy: loc.coords.accuracy || 0,
          matchScore,
          livenessPassed,
          verificationState: 'rejected',
          rejectionReason: 'face_mismatch',
        });

        Alert.alert(
          'Face Mismatch',
          `Face did not match enrolled template (score: ${(matchScore * 100).toFixed(1)}%, required: ${(minScore * 100).toFixed(0)}%)`
        );
        return;
      }

      setCurrentStep('saving');
      await createFaceClockAttempt({
        site,
        user,
        isClockIn,
        devicePos,
        distanceKm,
        accuracy: loc.coords.accuracy || 0,
        matchScore,
        livenessPassed,
        verificationState: 'verified',
      });

      Alert.alert(
        'Success',
        `${isClockIn ? 'Clock-in' : 'Clock-out'} successful!\n\nMatch Score: ${(matchScore * 100).toFixed(1)}%\nDistance: ${formatDistance(distanceKm)}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('[FaceClock] Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
      setCurrentStep('idle');
    }
  };

  const getStepText = () => {
    switch (currentStep) {
      case 'checking_permissions':
        return 'Checking permissions...';
      case 'getting_location':
        return 'Getting location...';
      case 'checking_distance':
        return 'Checking distance...';
      case 'capturing_face':
        return 'Capturing face...';
      case 'checking_liveness':
        return 'Checking liveness...';
      case 'computing_embedding':
        return 'Processing face data...';
      case 'matching':
        return 'Matching face...';
      case 'saving':
        return 'Saving record...';
      default:
        return '';
    }
  };

  const canUseFaceClock =
    user &&
    ALLOWED_ROLES.has(user.role) &&
    site?.faceClockInEnabled;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Face Clock In/Out',
          headerStyle: { backgroundColor: '#1A73E8' },
          headerTintColor: '#FFF',
        }}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Clock size={48} color="#1A73E8" />
          </View>
          <Text style={styles.title}>Face Recognition Clock</Text>
          <Text style={styles.subtitle}>Quick and secure attendance tracking</Text>
        </View>

        {!canUseFaceClock && (
          <View style={styles.warningCard}>
            <XCircle size={24} color="#DC2626" />
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>Not Available</Text>
              <Text style={styles.warningText}>
                {!site?.faceClockInEnabled
                  ? 'Face clock-in is not enabled for this site.'
                  : "You don&apos;t have permission to use face clock-in."}
              </Text>
            </View>
          </View>
        )}

        {site && (
          <View style={styles.siteCard}>
            <Text style={styles.siteTitle}>{site.name}</Text>
            {site.faceGeoCenter && site.faceGeoRadiusKm && (
              <View style={styles.siteDetail}>
                <MapPin size={16} color="#6B7280" />
                <Text style={styles.siteDetailText}>
                  Allowed radius: {formatDistance(site.faceGeoRadiusKm)}
                </Text>
              </View>
            )}
            {site.facePolicy && (
              <View style={styles.siteDetail}>
                <CheckCircle2 size={16} color="#6B7280" />
                <Text style={styles.siteDetailText}>
                  Min match score: {(site.facePolicy.minMatchScore * 100).toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
        )}

        {locationInfo.distanceKm !== undefined && (
          <View
            style={[
              styles.locationCard,
              locationInfo.distanceKm <= (site?.faceGeoRadiusKm ?? 0)
                ? styles.locationCardSuccess
                : styles.locationCardError,
            ]}
          >
            <MapPin
              size={20}
              color={
                locationInfo.distanceKm <= (site?.faceGeoRadiusKm ?? 0) ? '#10B981' : '#DC2626'
              }
            />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationTitle}>Current Distance</Text>
              <Text style={styles.locationText}>{formatDistance(locationInfo.distanceKm)}</Text>
              {locationInfo.accuracy && (
                <Text style={styles.locationAccuracy}>
                  GPS accuracy: {Math.round(locationInfo.accuracy)}m
                </Text>
              )}
            </View>
          </View>
        )}

        {isProcessing && (
          <View style={styles.progressCard}>
            <ActivityIndicator size="small" color="#1A73E8" />
            <Text style={styles.progressText}>{getStepText()}</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <AlertCircle size={20} color="#6366F1" />
          <Text style={styles.infoText}>
            Make sure you&apos;re within the allowed radius and have enrolled your face before using this
            feature.
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.clockButton, styles.clockInButton, !canUseFaceClock && styles.buttonDisabled]}
            onPress={() => handleFaceClock(true)}
            disabled={isProcessing || !canUseFaceClock}
          >
            <LogIn size={24} color="#FFF" />
            <Text style={styles.buttonText}>Clock In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.clockButton, styles.clockOutButton, !canUseFaceClock && styles.buttonDisabled]}
            onPress={() => handleFaceClock(false)}
            disabled={isProcessing || !canUseFaceClock}
          >
            <LogOut size={24} color="#FFF" />
            <Text style={styles.buttonText}>Clock Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

async function createFaceClockAttempt(params: {
  site: Site;
  user: any;
  isClockIn: boolean;
  devicePos: LatLon;
  distanceKm: number;
  accuracy: number;
  matchScore: number;
  livenessPassed: boolean;
  verificationState: 'verified' | 'rejected' | 'pending';
  rejectionReason?: string;
}) {
  const {
    site,
    user,
    isClockIn,
    devicePos,
    distanceKm,
    accuracy,
    matchScore,
    livenessPassed,
    verificationState,
    rejectionReason,
  } = params;

  const online = await checkOnline();
  const attemptData = {
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    siteId: site.id,
    siteName: site.name,
    companyId: user.currentCompanyId || null,
    masterAccountId: site.masterAccountId,
    eventType: isClockIn ? 'clock-in' : 'clock-out',
    method: 'face',
    timestampClient: new Date().toISOString(),
    gps: {
      latitude: devicePos.latitude,
      longitude: devicePos.longitude,
      accuracy,
    },
    distanceFromSiteKm: distanceKm,
    matchScore,
    livenessPassed,
    verificationState,
    rejectionReason: rejectionReason || null,
    deviceInfo: getDeviceInfo(),
    offlineMode: !online,
    syncedToServer: online,
    createdAt: serverTimestamp(),
  };

  try {
    if (online) {
      const attemptsRef = collection(db, 'faceClockAttempts');
      await addDoc(attemptsRef, attemptData);
      console.log('[FaceClock] Attempt saved to Firestore');
    } else {
      console.log('[FaceClock] Offline mode: would queue for sync');
    }
  } catch (error) {
    console.error('[FaceClock] Error saving attempt:', error);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#991B1B',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#991B1B',
  },
  siteCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  siteTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
  },
  siteDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  siteDetailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  locationCardSuccess: {
    backgroundColor: '#D1FAE5',
  },
  locationCardError: {
    backgroundColor: '#FEE2E2',
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
  },
  locationAccuracy: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '600' as const,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E0E7FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#3730A3',
    lineHeight: 18,
  },
  buttonsContainer: {
    gap: 12,
  },
  clockButton: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  clockInButton: {
    backgroundColor: '#10B981',
  },
  clockOutButton: {
    backgroundColor: '#F59E0B',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
