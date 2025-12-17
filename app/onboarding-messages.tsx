import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ArrowLeft, MessageCircle, CheckCircle, Clock, AlertCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/utils/hooks/useTheme';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

type MessageType = 'employee_request' | 'asset_request' | 'induction_update' | 'general';
type MessageStatus = 'unread' | 'read' | 'actioned';

type Message = {
  id: string;
  type: MessageType;
  status: MessageStatus;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  subject: string;
  content: string;
  siteId: string;
  createdAt: any;
  read: boolean;
  actionRequired?: boolean;
  entityId?: string;
  entityType?: 'employee' | 'asset';
};

export default function OnboardingMessagesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, commonStyles } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'actioned'>('all');

  const loadMessages = useCallback(async () => {
    if (!user?.id || !user?.siteId) return;

    try {
      setIsLoading(true);
      const messagesRef = collection(db, 'onboardingMessages');
      const q = query(
        messagesRef,
        where('siteId', '==', user.siteId),
        where('toUserId', '==', user.id),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      const loadedMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        loadedMessages.push({
          id: doc.id,
          ...doc.data(),
        } as Message);
      });

      setMessages(loadedMessages);
    } catch (error) {
      console.error('[OnboardingMessages] Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.siteId]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages])
  );

  const handleMarkAsRead = async (messageId: string) => {
    try {
      const messageRef = doc(db, 'onboardingMessages', messageId);
      await updateDoc(messageRef, {
        read: true,
        status: 'read',
      });
      
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, read: true, status: 'read' as MessageStatus } : m
        )
      );
    } catch (error) {
      console.error('[OnboardingMessages] Error marking as read:', error);
      Alert.alert('Error', 'Failed to mark message as read');
    }
  };

  const handleMessagePress = async (message: Message) => {
    if (!message.read) {
      await handleMarkAsRead(message.id);
    }

    if (message.entityType === 'employee' && message.entityId) {
      router.push(`/onboarding-employee-detail?employeeId=${message.entityId}` as any);
    } else if (message.entityType === 'asset' && message.entityId) {
      router.push(`/onboarding-asset-detail?assetId=${message.entityId}` as any);
    }
  };

  const getMessageIcon = (type: MessageType) => {
    switch (type) {
      case 'employee_request':
        return <AlertCircle size={20} color="#f59e0b" />;
      case 'asset_request':
        return <AlertCircle size={20} color="#3b82f6" />;
      case 'induction_update':
        return <CheckCircle size={20} color="#10b981" />;
      default:
        return <MessageCircle size={20} color="#64748b" />;
    }
  };

  const getMessageTypeLabel = (type: MessageType) => {
    switch (type) {
      case 'employee_request':
        return 'Employee Request';
      case 'asset_request':
        return 'Asset Request';
      case 'induction_update':
        return 'Induction Update';
      default:
        return 'General';
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (filter === 'unread') return !msg.read;
    if (filter === 'actioned') return msg.status === 'actioned';
    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;

  if (isLoading) {
    return (
      <View style={[commonStyles.container, styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[commonStyles.container, styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Messages</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.backButton} />
      </View>

      <View style={[styles.filterContainer, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: theme.surface }, filter === 'all' && { backgroundColor: theme.accent }]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, { color: theme.textSecondary }, filter === 'all' && { color: theme.background }]}>
            All ({messages.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: theme.surface }, filter === 'unread' && { backgroundColor: theme.accent }]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterText, { color: theme.textSecondary }, filter === 'unread' && { color: theme.background }]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: theme.surface }, filter === 'actioned' && { backgroundColor: theme.accent }]}
          onPress={() => setFilter('actioned')}
        >
          <Text style={[styles.filterText, { color: theme.textSecondary }, filter === 'actioned' && { color: theme.background }]}>
            Actioned
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {filteredMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <MessageCircle size={48} color={theme.border} />
            <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No Messages</Text>
            <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
              {filter === 'unread'
                ? 'All caught up! No unread messages.'
                : filter === 'actioned'
                ? 'No actioned messages yet.'
                : 'You have no messages in your inbox.'}
            </Text>
          </View>
        ) : (
          filteredMessages.map((message) => (
            <TouchableOpacity
              key={message.id}
              style={[
                styles.messageCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
                !message.read && styles.messageCardUnread,
              ]}
              onPress={() => handleMessagePress(message)}
              activeOpacity={0.7}
            >
              <View style={styles.messageCardHeader}>
                <View style={[styles.messageIconContainer, { backgroundColor: theme.background }]}>
                  {getMessageIcon(message.type)}
                </View>
                <View style={styles.messageHeaderContent}>
                  <Text style={[styles.messageType, { color: theme.text }]}>
                    {getMessageTypeLabel(message.type)}
                  </Text>
                  <Text style={[styles.messageTime, { color: theme.textSecondary }]}>
                    {message.createdAt?.toDate
                      ? new Date(message.createdAt.toDate()).toLocaleDateString()
                      : 'Recently'}
                  </Text>
                </View>
                {!message.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={[styles.messageSubject, { color: theme.text }]} numberOfLines={1}>{message.subject}</Text>
              <Text style={[styles.messageContent, { color: theme.textSecondary }]} numberOfLines={2}>
                {message.content}
              </Text>
              {message.actionRequired && (
                <View style={styles.actionRequiredBadge}>
                  <Clock size={12} color="#f59e0b" />
                  <Text style={styles.actionRequiredText}>Action Required</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  messageCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  messageCardUnread: {
    borderWidth: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD600',
  },
  messageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  messageIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageHeaderContent: {
    flex: 1,
  },
  messageType: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  messageTime: {
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  messageSubject: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionRequiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 12,
  },
  actionRequiredText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#f59e0b',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
