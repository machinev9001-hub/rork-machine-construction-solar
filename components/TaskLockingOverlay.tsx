import { View, Text, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { Shield } from 'lucide-react-native';

type TaskLockingOverlayProps = {
  visible: boolean;
  message?: string;
};

export default function TaskLockingOverlay({ visible, message = 'Checking task access...' }: TaskLockingOverlayProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Shield size={48} color="#4285F4" strokeWidth={2} />
          <ActivityIndicator size="large" color="#4285F4" style={styles.spinner} />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'auto',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 280,
  },
  spinner: {
    marginTop: 20,
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#202124',
    fontWeight: '600' as const,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
