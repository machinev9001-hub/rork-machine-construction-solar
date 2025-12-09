import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Share2, Copy } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'qrcode';

export default function GenerateQRScreen() {
  const { userId, userName } = useLocalSearchParams<{ userId?: string; userName?: string }>();
  const [isCopying, setIsCopying] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>('');

  const qrData = userId && typeof userId === 'string' ? `user/${userId}` : '';

  useEffect(() => {
    if (!qrData) return;
    
    const generateQR = async () => {
      try {
        const svgString = await QRCode.toString(qrData, {
          type: 'svg',
          width: 240,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff'
          }
        });
        setQrSvg(svgString);
      } catch (error) {
        console.error('[GenerateQR] Error generating QR code:', error);
      }
    };
    generateQR();
  }, [qrData]);

  if (!userId || typeof userId !== 'string') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User ID not provided</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleCopyUserId = async () => {
    try {
      setIsCopying(true);
      await Clipboard.setStringAsync(userId);
      Alert.alert('Copied', 'User ID copied to clipboard');
    } catch (error) {
      console.error('[GenerateQR] Error copying:', error);
      Alert.alert('Error', 'Failed to copy user ID');
    } finally {
      setIsCopying(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareData = {
        message: `User ID: ${userId}${userName ? `\nName: ${userName}` : ''}\n\nThis is my Machine App user identifier.`,
        title: 'User Information',
      };

      await Share.share(shareData);
      console.log('[GenerateQR] User info shared');
    } catch (error) {
      console.error('[GenerateQR] Share error:', error);
      Alert.alert('Error', 'Failed to share user information');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Code</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.content}>
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            {qrSvg ? (
              <SvgXml xml={qrSvg} width={240} height={240} />
            ) : (
              <View style={{ width: 240, height: 240, backgroundColor: '#f8fafc' }} />
            )}
          </View>
          
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue}>{userId}</Text>
            {userName && (
              <>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{userName}</Text>
              </>
            )}
          </View>

          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>How to use this code:</Text>
            <Text style={styles.instructionText}>• Show this to scan for quick login</Text>
            <Text style={styles.instructionText}>• HSE can scan to view your profile</Text>
            <Text style={styles.instructionText}>• Admin can scan to manage your account</Text>
            <Text style={styles.instructionNote}>Keep this code private and secure</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCopyUserId}
            disabled={isCopying}
          >
            <Copy size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Copy User ID</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleShare}
          >
            <Share2 size={20} color="#3b82f6" />
            <Text style={styles.actionButtonTextSecondary}>Share Info</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  qrContainer: {
    alignItems: 'center',
    gap: 24,
  },
  qrWrapper: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748b',
    textTransform: 'uppercase' as const,
  },
  infoValue: {
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 8,
  },
  instructionCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e40af',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 20,
  },
  instructionNote: {
    fontSize: 12,
    color: '#3b82f6',
    fontStyle: 'italic' as const,
    marginTop: 8,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  actionButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
