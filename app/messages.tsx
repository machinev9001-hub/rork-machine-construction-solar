import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Search, User } from 'lucide-react-native';
import { useTheme } from '@/utils/hooks/useTheme';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { UserRole } from '@/types';
import { getUserRoleOptions } from '@/constants/roles';

type Conversation = {
  id: string;
  userId: string;
  userName: string;
  userRole?: UserRole;
  lastMessage: string;
  lastMessageTime: any;
  unreadCount: number;
  isOnline?: boolean;
};

type SiteUser = {
  id: string;
  name: string;
  role: UserRole;
};

export default function MessagesScreen() {
  const { user } = useAuth();
  const { theme, commonStyles } = useTheme();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [allSiteUsers, setAllSiteUsers] = useState<SiteUser[]>([]);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<UserRole | 'ALL'>('ALL');

  useEffect(() => {
    loadSiteUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.siteId, user?.companyName]);

  useEffect(() => {
    if (!user?.userId || !user?.siteId) {
      setIsLoading(false);
      return;
    }

    const messagesRef = collection(db, 'messages');
    const conversationMap = new Map<string, Conversation>();
    let allMessageDocs: any[] = [];
    
    const q1 = query(
      messagesRef,
      where('siteId', '==', user.siteId),
      where('fromUserId', '==', user.userId),
      orderBy('timestamp', 'desc')
    );
    
    const q2 = query(
      messagesRef,
      where('siteId', '==', user.siteId),
      where('toUserId', '==', user.userId),
      orderBy('timestamp', 'desc')
    );

    const processAllMessages = () => {
      conversationMap.clear();

      allMessageDocs.forEach((doc: any) => {
        const data = doc.data();
        const otherUserId = data.fromUserId === user.userId ? data.toUserId : data.fromUserId;
        const otherUserName = data.fromUserId === user.userId ? data.toUserName : data.fromUserName;

        const existing = conversationMap.get(otherUserId);
        const msgTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0;
        const existingTime = existing?.lastMessageTime?.toMillis ? existing.lastMessageTime.toMillis() : 0;

        if (!existing || msgTime > existingTime) {
          conversationMap.set(otherUserId, {
            id: otherUserId,
            userId: otherUserId,
            userName: otherUserName || otherUserId,
            lastMessage: data.message || '',
            lastMessageTime: data.timestamp,
            unreadCount: 0,
          });
        }
      });

      allMessageDocs.forEach((doc: any) => {
        const data = doc.data();
        if (data.toUserId === user.userId && !data.read) {
          const otherUserId = data.fromUserId;
          const conv = conversationMap.get(otherUserId);
          if (conv) {
            conv.unreadCount += 1;
          }
        }
      });

      const conversationsList = Array.from(conversationMap.values());
      conversationsList.sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        const timeA = a.lastMessageTime?.toMillis ? a.lastMessageTime.toMillis() : 0;
        const timeB = b.lastMessageTime?.toMillis ? b.lastMessageTime.toMillis() : 0;
        return timeB - timeA;
      });

      setConversations(conversationsList);
      setIsLoading(false);
    };

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      const sentDocs = snapshot.docs.map(d => ({ id: d.id, data: () => d.data() }));
      allMessageDocs = [...sentDocs, ...allMessageDocs.filter(d => !sentDocs.find(s => s.id === d.id))];
      processAllMessages();
    });
    
    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const receivedDocs = snapshot.docs.map(d => ({ id: d.id, data: () => d.data() }));
      allMessageDocs = [...allMessageDocs.filter(d => !receivedDocs.find(r => r.id === d.id)), ...receivedDocs];
      processAllMessages();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [user?.userId, user?.siteId]);

  const loadSiteUsers = async () => {
    if (!user?.siteId) return;

    try {
      console.log('[Messages] Loading site users for siteId:', user.siteId);
      console.log('[Messages] Current user.companyName:', user.companyName);
      
      const employeesRef = collection(db, 'employees');
      const employeesQuery = query(employeesRef, where('siteId', '==', user.siteId));
      const employeesSnapshot = await getDocs(employeesQuery);

      console.log('[Messages] Found', employeesSnapshot.docs.length, 'raw employee documents');

      const employees = employeesSnapshot.docs.map(doc => {
        const data = doc.data();
        
        const displayName = data.name || data.employeeIdNumber || doc.id;
        
        console.log('[Messages] Employee doc:', {
          id: doc.id,
          name: data.name,
          employeeIdNumber: data.employeeIdNumber,
          calculatedName: displayName,
          role: data.role,
          linkedUserRole: data.linkedUserRole,
          siteId: data.siteId,
        });
        return {
          id: doc.id,
          name: displayName,
          role: (data.linkedUserRole || data.role || 'General Worker') as UserRole,
        };
      }).filter(emp => emp.id !== user.userId);

      console.log('[Messages] Processed', employees.length, 'employees after filtering out current user');
      console.log('[Messages] Sample employees:', employees.slice(0, 3));
      setAllSiteUsers(employees);
    } catch (error) {
      console.error('❌ Error loading site users:', error);
    }
  };

  const combinedList = useMemo(() => {
    const conversationMap = new Map(conversations.map(c => [c.userId, c]));
    
    const allUsers = allSiteUsers.map(siteUser => {
      const existingConv = conversationMap.get(siteUser.id);
      if (existingConv) {
        return existingConv;
      }
      return {
        id: siteUser.id,
        userId: siteUser.id,
        userName: siteUser.name,
        userRole: siteUser.role,
        lastMessage: 'Start a conversation',
        lastMessageTime: null,
        unreadCount: 0,
        isNewChat: true,
      };
    });

    let filtered = allUsers;

    if (selectedRoleFilter !== 'ALL') {
      filtered = filtered.filter(item => item.userRole === selectedRoleFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.userName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      if ('isNewChat' in a && a.isNewChat) return 1;
      if ('isNewChat' in b && b.isNewChat) return -1;
      const timeA = a.lastMessageTime?.toMillis ? a.lastMessageTime.toMillis() : 0;
      const timeB = b.lastMessageTime?.toMillis ? b.lastMessageTime.toMillis() : 0;
      return timeB - timeA;
    });

    return filtered;
  }, [allSiteUsers, conversations, searchQuery, selectedRoleFilter]);

  const handleItemPress = (item: Conversation & { isNewChat?: boolean }) => {
    router.push({
      pathname: '/chat',
      params: {
        userId: item.userId,
        userName: item.userName,
      },
    });
  };

  const availableRoles = useMemo(() => {
    const roles = getUserRoleOptions();
    return ['ALL' as const, ...roles];
  }, []);

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: Conversation & { isNewChat?: boolean } }) => {
    const isNew = 'isNewChat' in item && item.isNewChat;
    const hasUnread = item.unreadCount > 0;
    
    return (
      <TouchableOpacity
        style={[
          styles.conversationCard,
          { backgroundColor: hasUnread ? '#FFF9E6' : theme.surface },
          hasUnread && styles.conversationCardUnread,
        ]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: isNew ? '#94a3b8' : '#FFD600' }]}>
          <User size={20} color="#fff" strokeWidth={2.5} />
        </View>
        
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text 
              style={[
                styles.conversationName, 
                { color: theme.text },
                hasUnread && styles.conversationNameUnread,
              ]} 
              numberOfLines={1}
            >
              {item.userName}
            </Text>
            {!isNew && (
              <Text style={[styles.conversationTime, { color: theme.textSecondary }]}>
                {formatTime(item.lastMessageTime)}
              </Text>
            )}
          </View>
          
          <View style={styles.conversationFooter}>
            <Text 
              style={[
                styles.lastMessage, 
                { color: hasUnread ? theme.text : theme.textSecondary },
                hasUnread && styles.lastMessageUnread,
              ]} 
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>
            {hasUnread && (
              <View style={[styles.unreadBadge, { backgroundColor: '#FFD600' }]}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };



  const renderRoleFilter = (role: UserRole | 'ALL') => {
    const isSelected = selectedRoleFilter === role;
    return (
      <TouchableOpacity
        key={role}
        style={[
          styles.roleFilterChip,
          { 
            backgroundColor: isSelected ? '#FFD600' : theme.cardBg,
            borderColor: isSelected ? '#FFD600' : theme.border,
          },
        ]}
        onPress={() => setSelectedRoleFilter(role)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.roleFilterText,
            { color: '#000' },
          ]}
        >
          {role}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[commonStyles.container, styles.container]}>
      <Stack.Screen
        options={{
          title: 'Messages',
          headerStyle: { backgroundColor: theme.headerBg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '600' as const },
        }}
      />
      <View style={[commonStyles.headerBorder, { backgroundColor: '#FFD600' }]} />

      <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.background }]}>
          <Search size={18} color={theme.textSecondary} strokeWidth={2} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roleFiltersContainer}
        >
          {availableRoles.map(renderRoleFilter)}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD600" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading conversations...
          </Text>
        </View>
      ) : (
        <FlatList
          data={combinedList}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageCircle size={64} color={theme.border} strokeWidth={1.5} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {selectedRoleFilter !== 'ALL' 
                  ? `No ${selectedRoleFilter} users found`
                  : searchQuery 
                  ? 'No users found' 
                  : 'No users available'}
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                {selectedRoleFilter !== 'ALL'
                  ? 'Try selecting a different role filter'
                  : searchQuery 
                  ? 'Try a different search' 
                  : 'Users will appear here when added to the site'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  roleFiltersContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  roleFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  roleFilterText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 4,
  },
  conversationCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    gap: 12,
  },
  conversationCardUnread: {
    borderWidth: 2,
    borderColor: '#FFD600',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600' as const,
    flex: 1,
    marginRight: 8,
  },
  conversationNameUnread: {
    fontWeight: '700' as const,
  },
  conversationTime: {
    fontSize: 12,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  lastMessageUnread: {
    fontWeight: '600' as const,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
