import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Check, CheckCheck } from 'lucide-react-native';
import { useTheme } from '@/utils/hooks/useTheme';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

type Message = {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  timestamp: any;
  read: boolean;
  siteId: string;
};

export default function ChatScreen() {
  const { userId, userName } = useLocalSearchParams<{ userId: string; userName: string }>();
  const { user } = useAuth();
  const { theme, roleAccentColor, commonStyles } = useTheme();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user?.userId || !userId || !user?.siteId) return;

    const messagesRef = collection(db, 'messages');
    
    const q1 = query(
      messagesRef,
      where('siteId', '==', user.siteId),
      where('fromUserId', '==', user.userId),
      where('toUserId', '==', userId),
      orderBy('timestamp', 'asc')
    );
    
    const q2 = query(
      messagesRef,
      where('siteId', '==', user.siteId),
      where('fromUserId', '==', userId),
      where('toUserId', '==', user.userId),
      orderBy('timestamp', 'asc')
    );

    const allMessages: Message[] = [];

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const existingIndex = allMessages.findIndex(m => m.id === docSnap.id);
        const message: Message = {
          id: docSnap.id,
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          message: data.message,
          timestamp: data.timestamp,
          read: data.read || false,
          siteId: data.siteId,
        };
        
        if (existingIndex >= 0) {
          allMessages[existingIndex] = message;
        } else {
          allMessages.push(message);
        }
      });
      
      allMessages.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeA - timeB;
      });
      
      setMessages([...allMessages]);
      scrollToBottom();
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const existingIndex = allMessages.findIndex(m => m.id === docSnap.id);
        const message: Message = {
          id: docSnap.id,
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          message: data.message,
          timestamp: data.timestamp,
          read: data.read || false,
          siteId: data.siteId,
        };
        
        if (existingIndex >= 0) {
          allMessages[existingIndex] = message;
        } else {
          allMessages.push(message);
        }

        if (data.toUserId === user.userId && !data.read) {
          const messageRef = doc(db, 'messages', docSnap.id);
          updateDoc(messageRef, { read: true }).catch(err => 
            console.error('Error marking message as read:', err)
          );
        }
      });
      
      allMessages.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeA - timeB;
      });
      
      setMessages([...allMessages]);
      scrollToBottom();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [user?.userId, userId, user?.siteId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending || !user?.userId || !userId || !user?.siteId) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    try {
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        fromUserId: user.userId,
        fromUserName: user.name || user.userId,
        toUserId: userId,
        toUserName: userName || userId,
        message: messageText,
        timestamp: Timestamp.now(),
        read: false,
        siteId: user.siteId,
      });

      console.log('✅ Message sent successfully');
      scrollToBottom();
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setInputMessage(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    
    const date = timestamp.toDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  const renderDateSeparator = (timestamp: any) => {
    if (!timestamp?.toDate) return null;
    
    const date = timestamp.toDate();
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

    let dateString = '';
    if (diffDays === 0) {
      dateString = 'Today';
    } else if (diffDays === 1) {
      dateString = 'Yesterday';
    } else if (diffDays < 7) {
      dateString = date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    return (
      <View style={styles.dateSeparator}>
        <View style={[styles.dateSeparatorBadge, { backgroundColor: theme.border }]}>
          <Text style={[styles.dateSeparatorText, { color: theme.textSecondary }]}>
            {dateString}
          </Text>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.fromUserId === user?.userId;
    const showDateSeparator = index === 0 || (
      messages[index - 1] &&
      new Date(item.timestamp?.toDate()).toDateString() !== 
      new Date(messages[index - 1].timestamp?.toDate()).toDateString()
    );

    return (
      <View>
        {showDateSeparator && renderDateSeparator(item.timestamp)}
        <View style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}>
          <View style={[
            styles.messageBubble,
            isMyMessage 
              ? [styles.myMessageBubble, { backgroundColor: roleAccentColor }]
              : [styles.theirMessageBubble, { backgroundColor: theme.cardBg }],
          ]}>
            <Text style={[
              styles.messageText,
              isMyMessage 
                ? styles.myMessageText
                : { color: theme.text },
            ]}>
              {item.message}
            </Text>
            <View style={styles.messageFooter}>
              <Text style={[
                styles.messageTime,
                isMyMessage 
                  ? styles.myMessageTime
                  : { color: theme.textSecondary },
              ]}>
                {formatTime(item.timestamp)}
              </Text>
              {isMyMessage && (
                <View style={styles.messageStatus}>
                  {item.read ? (
                    <CheckCheck size={16} color="#fff" strokeWidth={2.5} />
                  ) : (
                    <Check size={16} color="#fff" strokeWidth={2.5} />
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[commonStyles.container, styles.container]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: userName || 'Chat',
          headerStyle: { backgroundColor: theme.headerBg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '600' as const, color: theme.text },
        }}
      />
      <View style={[commonStyles.headerBorder, { backgroundColor: roleAccentColor }]} />

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToBottom}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No messages yet
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Send a message to start the conversation
            </Text>
          </View>
        }
      />

      <View style={[styles.inputContainer, { backgroundColor: theme.surface }]}>
        <View style={[styles.inputWrapper, { backgroundColor: theme.background }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textSecondary}
            value={inputMessage}
            onChangeText={setInputMessage}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: inputMessage.trim() ? roleAccentColor : theme.border },
            ]}
            onPress={handleSendMessage}
            disabled={!inputMessage.trim() || isSending}
            activeOpacity={0.7}
          >
            <Send size={20} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  messageContainer: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessageBubble: {
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 11,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  messageStatus: {
    marginLeft: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
