import React, { useState } from 'react';
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
import { Camera, CheckCircle2, AlertCircle, User } from 'lucide-react-native';
import { captureFaceImage, runLivenessCheck, computeEmbedding } from '@/utils/faceCapture';
import { saveLocalTemplate, hasLocalTemplate } from '@/utils/secureFaceStore';

export default function FaceEnrollmentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'idle' | 'capturing' | 'liveness' | 'embedding' | 'saving'>('idle');
  const [hasEnrolled, setHasEnrolled] = useState(false);

  const checkEnrollmentStatus = React.useCallback(async () => {
    if (!user?.id) return;
    const enrolled = await hasLocalTemplate(user.id);
    setHasEnrolled(enrolled);
  }, [user?.id]);

  React.useEffect(() => {
    checkEnrollmentStatus();
  }, [checkEnrollmentStatus]);

  const handleEnroll = async () => {
    if (!user?.id || !user?.name) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    if (!user.masterAccountId) {
      Alert.alert('Error', 'Master account ID not found');
      return;
    }

    try {
      setIsProcessing(true);

      setCurrentStep('capturing');
      const image = await captureFaceImage();
      if (!image) {
        Alert.alert('Cancelled', 'Face capture was cancelled');
        return;
      }

      setCurrentStep('liveness');
      const livenessResult = await runLivenessCheck(image);
      if (!livenessResult.passed) {
        Alert.alert('Liveness Failed', livenessResult.reason || 'Please try again with better lighting');
        return;
      }

      setCurrentStep('embedding');
      const embeddingResult = await computeEmbedding(image);
      if (embeddingResult.embedding.length === 0) {
        Alert.alert('Error', 'Failed to process face image');
        return;
      }

      setCurrentStep('saving');
      const result = await saveLocalTemplate(
        user.id,
        user.name,
        embeddingResult.embedding,
        user.masterAccountId,
        user.currentCompanyId,
        user.siteId
      );

      if (result.success) {
        setHasEnrolled(true);
        Alert.alert(
          'Success',
          'Face enrolled successfully! You can now use face clock-in.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to save face template');
      }
    } catch (error) {
      console.error('[FaceEnrollment] Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
      setCurrentStep('idle');
    }
  };

  const getStepText = () => {
    switch (currentStep) {
      case 'capturing': return 'Capturing face...';
      case 'liveness': return 'Checking liveness...';
      case 'embedding': return 'Processing face data...';
      case 'saving': return 'Saving template...';
      default: return '';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Face Enrollment',
          headerStyle: { backgroundColor: '#1A73E8' },
          headerTintColor: '#FFF',
        }}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <User size={48} color="#1A73E8" />
          </View>
          <Text style={styles.title}>Enroll Your Face</Text>
          <Text style={styles.subtitle}>
            Set up face recognition for quick and secure clock-in
          </Text>
        </View>

        {hasEnrolled && (
          <View style={styles.statusCard}>
            <CheckCircle2 size={24} color="#10B981" />
            <Text style={styles.statusText}>Face already enrolled</Text>
          </View>
        )}

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Instructions</Text>
          <View style={styles.instructionItem}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.instructionText}>
              Ensure good lighting on your face
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.instructionText}>
              Remove glasses or caps if possible
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.instructionText}>
              Look directly at the camera
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.instructionText}>
              Keep a neutral expression
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <AlertCircle size={20} color="#F59E0B" />
          <Text style={styles.infoText}>
            Your face data is encrypted and stored securely on your device and server.
          </Text>
        </View>

        {isProcessing && (
          <View style={styles.progressCard}>
            <ActivityIndicator size="small" color="#1A73E8" />
            <Text style={styles.progressText}>{getStepText()}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.enrollButton, isProcessing && styles.enrollButtonDisabled]}
          onPress={handleEnroll}
          disabled={isProcessing}
        >
          <Camera size={24} color="#FFF" />
          <Text style={styles.enrollButtonText}>
            {hasEnrolled ? 'Re-enroll Face' : 'Start Enrollment'}
          </Text>
        </TouchableOpacity>
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
    paddingHorizontal: 20,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#065F46',
  },
  instructionsCard: {
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
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#1A73E8',
    marginRight: 12,
    fontWeight: '700' as const,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '600' as const,
  },
  enrollButton: {
    flexDirection: 'row',
    backgroundColor: '#1A73E8',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  enrollButtonDisabled: {
    opacity: 0.5,
  },
  enrollButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
