import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Package, Truck, MapPin, ClipboardList, BarChart3, BookOpen, MessageCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/utils/hooks/useTheme';
import { HeaderTitleWithSync, StandardHeaderRight, StandardSiteIndicator } from '@/components/HeaderSyncStatus';

export default function MasterLogisticsManagerScreen() {
  const { user } = useAuth();
  const { theme, commonStyles } = useTheme();
  const router = useRouter();

  return (
    <View style={commonStyles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitleWithSync title="Logistics Manager" />,
          headerRight: () => <StandardHeaderRight />,
          headerStyle: {
            backgroundColor: theme.headerBg,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />
      <StandardSiteIndicator />
      <View style={commonStyles.headerBorder} />

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={styles.halfButton}
          onPress={() => router.push('/daily-diary')}
          activeOpacity={0.7}
        >
          <BookOpen size={18} color="#ffffff" strokeWidth={2} />
          <Text style={styles.halfButtonText}>Daily Diary</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.halfButton, styles.messagesHalfButton]}
          onPress={() => router.push('/messages')}
          activeOpacity={0.7}
        >
          <MessageCircle size={18} color="#ffffff" strokeWidth={2} />
          <Text style={styles.halfButtonText}>Messages</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={commonStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>Supply Chain & Material Management</Text>
        </View>

        <View style={styles.welcomeCard}>
          <Package size={48} color="#0ea5e9" />
          <Text style={styles.welcomeTitle}>Logistics Manager Dashboard</Text>
          <Text style={styles.welcomeText}>
            Manage material deliveries, track inventory, coordinate transportation, and monitor supply chain operations across the site
          </Text>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#dbeafe' }]}>
              <Package size={28} color="#0ea5e9" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Material Inventory</Text>
              <Text style={styles.menuSubtitle}>Track stock levels and materials</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#fef3c7' }]}>
              <Truck size={28} color="#f59e0b" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Delivery Schedule</Text>
              <Text style={styles.menuSubtitle}>Manage incoming material deliveries</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#cffafe' }]}>
              <MapPin size={28} color="#0891b2" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Site Logistics</Text>
              <Text style={styles.menuSubtitle}>Track material movement on site</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/materials-requests')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#d1fae5' }]}>
              <ClipboardList size={28} color="#059669" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Material Requests</Text>
              <Text style={styles.menuSubtitle}>Process and approve material orders</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#ede9fe' }]}>
              <BarChart3 size={28} color="#8b5cf6" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Supply Reports</Text>
              <Text style={styles.menuSubtitle}>View logistics analytics and reports</Text>
            </View>
          </TouchableOpacity>
        </View>


      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#000000',
  },
  subtitle: {
    fontSize: 14,
    color: '#A0A0A0',
    fontWeight: '400' as const,
  },
  welcomeCard: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  menuContainer: {
    marginHorizontal: 16,
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#A0A0A0',
    lineHeight: 18,
  },
  infoBanner: {
    backgroundColor: '#fef3c7',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  infoText: {
    fontSize: 14,
    color: '#78350f',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    gap: 10,
  },
  halfButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  messagesHalfButton: {
    backgroundColor: '#FFD600',
  },
  halfButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
