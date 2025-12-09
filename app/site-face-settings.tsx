import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, Save, Lock, Eye, Globe } from 'lucide-react-native';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Site, LatLon, FacePolicy } from '@/types';
import * as Location from 'expo-location';

export default function SiteFaceSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  
  const [site, setSite] = useState<Site | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusKm, setRadiusKm] = useState('');
  const [minMatchScore, setMinMatchScore] = useState('80');
  const [requireLiveness, setRequireLiveness] = useState(true);

  const canEdit = user?.role === 'master' || user?.role === 'Planner';

  const loadSiteData = React.useCallback(async () => {
    if (!siteId) return;

    try {
      setIsLoading(true);
      const siteDoc = await getDoc(doc(db, 'sites', siteId as string));
      
      if (siteDoc.exists()) {
        const siteData = { id: siteDoc.id, ...siteDoc.data() } as Site;
        setSite(siteData);

        setEnabled(siteData.faceClockInEnabled ?? false);
        
        if (siteData.faceGeoCenter) {
          setLatitude(siteData.faceGeoCenter.latitude.toString());
          setLongitude(siteData.faceGeoCenter.longitude.toString());
        }
        
        if (siteData.faceGeoRadiusKm) {
          setRadiusKm(siteData.faceGeoRadiusKm.toString());
        }
        
        if (siteData.facePolicy) {
          setMinMatchScore((siteData.facePolicy.minMatchScore * 100).toString());
          setRequireLiveness(siteData.facePolicy.requireLiveness);
        }
      }
    } catch (error) {
      console.error('[SiteFaceSettings] Error loading site:', error);
      Alert.alert('Error', 'Failed to load site data');
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    loadSiteData();
  }, [loadSiteData]);

  const getCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to set site coordinates');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLatitude(location.coords.latitude.toFixed(6));
      setLongitude(location.coords.longitude.toFixed(6));
      
      Alert.alert('Success', 'Current location set as site center');
    } catch (error) {
      console.error('[SiteFaceSettings] Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const validateInputs = (): boolean => {
    if (!enabled) return true;

    if (!latitude || !longitude) {
      Alert.alert('Validation Error', 'Please set site coordinates');
      return false;
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    
    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Validation Error', 'Latitude must be between -90 and 90');
      return false;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      Alert.alert('Validation Error', 'Longitude must be between -180 and 180');
      return false;
    }

    if (!radiusKm) {
      Alert.alert('Validation Error', 'Please set allowed radius');
      return false;
    }

    const radius = parseFloat(radiusKm);
    if (isNaN(radius) || radius <= 0) {
      Alert.alert('Validation Error', 'Radius must be greater than 0');
      return false;
    }

    const matchScore = parseFloat(minMatchScore);
    if (isNaN(matchScore) || matchScore < 0 || matchScore > 100) {
      Alert.alert('Validation Error', 'Match score must be between 0 and 100');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!canEdit) {
      Alert.alert('Permission Denied', 'You do not have permission to edit site settings');
      return;
    }

    if (!validateInputs()) return;

    try {
      setIsSaving(true);

      const siteRef = doc(db, 'sites', siteId as string);
      
      const updateData: any = {
        faceClockInEnabled: enabled,
        updatedAt: serverTimestamp(),
      };

      if (enabled) {
        updateData.faceGeoCenter = {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        } as LatLon;
        
        updateData.faceGeoRadiusKm = parseFloat(radiusKm);
        
        updateData.facePolicy = {
          minMatchScore: parseFloat(minMatchScore) / 100,
          requireLiveness,
          allowOfflineMatch: true,
        } as FacePolicy;
      }

      await updateDoc(siteRef, updateData);

      Alert.alert(
        'Success',
        'Face clock-in settings saved successfully',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('[SiteFaceSettings] Error saving:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Face Clock-In Settings',
            headerStyle: { backgroundColor: '#1A73E8' },
            headerTintColor: '#FFF',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A73E8" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Face Clock-In Settings',
          headerStyle: { backgroundColor: '#1A73E8' },
          headerTintColor: '#FFF',
        }}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!canEdit && (
          <View style={styles.readOnlyBanner}>
            <Lock size={20} color="#F59E0B" />
            <Text style={styles.readOnlyText}>
              You can view but not edit these settings
            </Text>
          </View>
        )}

        <View style={styles.siteCard}>
          <Text style={styles.siteTitle}>{site?.name}</Text>
          <Text style={styles.siteSubtitle}>Configure face recognition clock-in</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Eye size={24} color={enabled ? '#10B981' : '#6B7280'} />
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchLabel}>Enable Face Clock-In</Text>
                <Text style={styles.switchDescription}>
                  Allow users to clock in/out using facial recognition
                </Text>
              </View>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              disabled={!canEdit}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={enabled ? '#10B981' : '#F3F4F6'}
            />
          </View>
        </View>

        {enabled && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Globe size={20} color="#1A73E8" />
                <Text style={styles.sectionTitle}>Site Geofence</Text>
              </View>
              
              <Text style={styles.inputLabel}>Latitude</Text>
              <TextInput
                style={[styles.input, !canEdit && styles.inputDisabled]}
                value={latitude}
                onChangeText={setLatitude}
                placeholder="-25.7460"
                keyboardType="numeric"
                editable={canEdit}
              />

              <Text style={styles.inputLabel}>Longitude</Text>
              <TextInput
                style={[styles.input, !canEdit && styles.inputDisabled]}
                value={longitude}
                onChangeText={setLongitude}
                placeholder="28.1880"
                keyboardType="numeric"
                editable={canEdit}
              />

              {canEdit && (
                <TouchableOpacity
                  style={[styles.locationButton, isGettingLocation && styles.buttonDisabled]}
                  onPress={getCurrentLocation}
                  disabled={isGettingLocation}
                >
                  <MapPin size={20} color="#FFF" />
                  <Text style={styles.locationButtonText}>
                    {isGettingLocation ? 'Getting Location...' : 'Use Current Location'}
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={styles.inputLabel}>Allowed Radius (km)</Text>
              <TextInput
                style={[styles.input, !canEdit && styles.inputDisabled]}
                value={radiusKm}
                onChangeText={setRadiusKm}
                placeholder="0.5"
                keyboardType="numeric"
                editable={canEdit}
              />
              <Text style={styles.inputHint}>
                Users must be within this distance to clock in
              </Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Lock size={20} color="#1A73E8" />
                <Text style={styles.sectionTitle}>Face Recognition Policy</Text>
              </View>

              <Text style={styles.inputLabel}>Minimum Match Score (%)</Text>
              <TextInput
                style={[styles.input, !canEdit && styles.inputDisabled]}
                value={minMatchScore}
                onChangeText={setMinMatchScore}
                placeholder="80"
                keyboardType="numeric"
                editable={canEdit}
              />
              <Text style={styles.inputHint}>
                Face must match enrolled template by at least this percentage
              </Text>

              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Require Liveness Check</Text>
                  <Text style={styles.switchDescription}>
                    Verify that a real person is present
                  </Text>
                </View>
                <Switch
                  value={requireLiveness}
                  onValueChange={setRequireLiveness}
                  disabled={!canEdit}
                  trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                  thumbColor={requireLiveness ? '#10B981' : '#F3F4F6'}
                />
              </View>
            </View>
          </>
        )}

        {canEdit && (
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Save size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600' as const,
  },
  siteCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
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
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
  },
  siteSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFF',
    padding: 20,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switchLabelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchTextContainer: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputDisabled: {
    backgroundColor: '#E5E7EB',
    color: '#6B7280',
  },
  inputHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  locationButton: {
    flexDirection: 'row',
    backgroundColor: '#6366F1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
