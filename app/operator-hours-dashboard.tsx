import { Stack, useFocusEffect } from 'expo-router';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { 
  TrendingUp, 
  Clock, 
  Calendar,
  Filter,
  Download,
  Search,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  Truck
} from 'lucide-react-native';
import { useState, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Platform } from 'react-native';

type OperatorHours = {
  id: string;
  operatorId: string;
  operatorName: string;
  assetId: string;
  assetType: string;
  assetNumber: string;
  date: Date;
  openHours: number;
  closingHours: number;
  totalHours: number;
  location: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
};

type FilterPeriod = 'today' | 'week' | 'month' | 'all';
type FilterStatus = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

export default function OperatorHoursDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [operatorHours, setOperatorHours] = useState<OperatorHours[]>([]);
  const [filteredHours, setFilteredHours] = useState<OperatorHours[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('week');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedHours, setSelectedHours] = useState<OperatorHours | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [approvalNotes, setApprovalNotes] = useState('');

  const loadOperatorHours = useCallback(async () => {
    if (!user?.masterAccountId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const hoursRef = collection(db, 'operatorAssetHours');
      
      // Build query with filters
      let q = query(
        hoursRef,
        where('masterAccountId', '==', user.masterAccountId),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      
      const hours: OperatorHours[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        hours.push({
          id: doc.id,
          operatorId: data.operatorId,
          operatorName: data.operatorName,
          assetId: data.assetId,
          assetType: data.assetType,
          assetNumber: data.assetNumber,
          date: data.date.toDate(),
          openHours: data.openHours,
          closingHours: data.closingHours,
          totalHours: data.totalHours,
          location: data.location,
          status: data.status,
          submittedAt: data.submittedAt.toDate(),
          approvedBy: data.approvedBy,
          approvedAt: data.approvedAt?.toDate(),
          notes: data.notes
        });
      });

      setOperatorHours(hours);
      applyFilters(hours, searchQuery, filterPeriod, filterStatus, selectedOperator);
    } catch (error) {
      console.error('[OperatorDashboard] Error loading hours:', error);
      Alert.alert('Error', 'Failed to load operator hours');
    } finally {
      setIsLoading(false);
    }
  }, [user?.masterAccountId]);

  const applyFilters = useCallback((
    hours: OperatorHours[], 
    search: string, 
    period: FilterPeriod, 
    status: FilterStatus,
    operator: string
  ) => {
    let filtered = [...hours];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(h => 
        h.operatorName.toLowerCase().includes(searchLower) ||
        h.assetNumber.toLowerCase().includes(searchLower) ||
        h.assetType.toLowerCase().includes(searchLower) ||
        h.location.toLowerCase().includes(searchLower)
      );
    }

    // Apply period filter
    const now = new Date();
    switch (period) {
      case 'today':
        filtered = filtered.filter(h => {
          const hDate = new Date(h.date);
          return hDate.toDateString() === now.toDateString();
        });
        break;
      case 'week':
        const weekStart = startOfWeek(now);
        const weekEnd = endOfWeek(now);
        filtered = filtered.filter(h => {
          const hDate = new Date(h.date);
          return hDate >= weekStart && hDate <= weekEnd;
        });
        break;
      case 'month':
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        filtered = filtered.filter(h => {
          const hDate = new Date(h.date);
          return hDate >= monthStart && hDate <= monthEnd;
        });
        break;
    }

    // Apply status filter
    if (status !== 'all') {
      filtered = filtered.filter(h => h.status === status);
    }

    // Apply operator filter
    if (operator !== 'all') {
      filtered = filtered.filter(h => h.operatorId === operator);
    }

    setFilteredHours(filtered);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOperatorHours();
    }, [loadOperatorHours])
  );

  const handleApprove = async () => {
    if (!selectedHours || !user) return;

    try {
      const hoursRef = doc(db, 'operatorAssetHours', selectedHours.id);
      await updateDoc(hoursRef, {
        status: 'APPROVED',
        approvedBy: user.name,
        approvedAt: Timestamp.now(),
        approvalNotes: approvalNotes,
        updatedAt: new Date().toISOString()
      });

      Alert.alert('Success', 'Hours approved successfully');
      setShowApprovalModal(false);
      setSelectedHours(null);
      setApprovalNotes('');
      loadOperatorHours();
    } catch (error) {
      console.error('[OperatorDashboard] Error approving hours:', error);
      Alert.alert('Error', 'Failed to approve hours');
    }
  };

  const handleReject = async () => {
    if (!selectedHours || !user || !approvalNotes.trim()) {
      Alert.alert('Error', 'Please provide rejection notes');
      return;
    }

    try {
      const hoursRef = doc(db, 'operatorAssetHours', selectedHours.id);
      await updateDoc(hoursRef, {
        status: 'REJECTED',
        approvedBy: user.name,
        approvedAt: Timestamp.now(),
        approvalNotes: approvalNotes,
        updatedAt: new Date().toISOString()
      });

      Alert.alert('Success', 'Hours rejected');
      setShowApprovalModal(false);
      setSelectedHours(null);
      setApprovalNotes('');
      loadOperatorHours();
    } catch (error) {
      console.error('[OperatorDashboard] Error rejecting hours:', error);
      Alert.alert('Error', 'Failed to reject hours');
    }
  };

  const exportToCSV = async () => {
    try {
      let csv = 'Date,Operator,Asset Type,Asset Number,Location,Open Hours,Closing Hours,Total Hours,Status,Approved By,Notes\n';
      
      filteredHours.forEach(h => {
        csv += `"${format(h.date, 'yyyy-MM-dd')}","${h.operatorName}","${h.assetType}","${h.assetNumber}","${h.location}",`;
        csv += `${h.openHours},${h.closingHours},${h.totalHours},"${h.status}","${h.approvedBy || ''}","${h.notes || ''}"\n`;
      });

      // For web, create a downloadable link
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `operator_hours_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'CSV file downloaded');
      } else {
        // For mobile, show data summary
        Alert.alert(
          'Export Summary',
          `Total Records: ${filteredHours.length}\nTotal Hours: ${getStatistics.totalHours}h\nPending: ${getStatistics.pendingCount}\nApproved: ${getStatistics.approvedCount}\nRejected: ${getStatistics.rejectedCount}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[OperatorDashboard] Export error:', error);
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const getStatistics = useMemo(() => {
    const stats = {
      totalHours: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      uniqueOperators: new Set<string>(),
      uniqueAssets: new Set<string>()
    };

    filteredHours.forEach(h => {
      stats.totalHours += h.totalHours;
      stats.uniqueOperators.add(h.operatorId);
      stats.uniqueAssets.add(h.assetId);
      
      switch (h.status) {
        case 'PENDING':
          stats.pendingCount++;
          break;
        case 'APPROVED':
          stats.approvedCount++;
          break;
        case 'REJECTED':
          stats.rejectedCount++;
          break;
      }
    });

    return stats;
  }, [filteredHours]);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderHoursCard = (hours: OperatorHours) => {
    const isExpanded = expandedCards.has(hours.id);
    
    return (
      <View key={hours.id} style={styles.hoursCard}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleCard(hours.id)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.operatorInfo}>
                <User size={16} color="#64748b" />
                <Text style={styles.operatorName}>{hours.operatorName}</Text>
              </View>
              <View style={styles.assetInfo}>
                <Truck size={14} color="#94a3b8" />
                <Text style={styles.assetText}>{hours.assetType} - {hours.assetNumber}</Text>
              </View>
            </View>
            <View style={styles.cardHeaderRight}>
              <View style={[
                styles.statusBadge,
                hours.status === 'APPROVED' && styles.statusApproved,
                hours.status === 'PENDING' && styles.statusPending,
                hours.status === 'REJECTED' && styles.statusRejected
              ]}>
                <Text style={[
                  styles.statusText,
                  hours.status === 'APPROVED' && styles.statusTextApproved,
                  hours.status === 'PENDING' && styles.statusTextPending,
                  hours.status === 'REJECTED' && styles.statusTextRejected
                ]}>
                  {hours.status}
                </Text>
              </View>
              {isExpanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
            </View>
          </View>

          <View style={styles.cardMetrics}>
            <View style={styles.metricItem}>
              <Calendar size={14} color="#64748b" />
              <Text style={styles.metricText}>{format(hours.date, 'MMM dd, yyyy')}</Text>
            </View>
            <View style={styles.metricItem}>
              <Clock size={14} color="#64748b" />
              <Text style={styles.metricText}>{hours.totalHours}h ({hours.openHours} - {hours.closingHours})</Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location:</Text>
              <Text style={styles.detailValue}>{hours.location}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Submitted:</Text>
              <Text style={styles.detailValue}>{format(hours.submittedAt, 'MMM dd, yyyy HH:mm')}</Text>
            </View>

            {hours.approvedBy && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Approved By:</Text>
                <Text style={styles.detailValue}>{hours.approvedBy}</Text>
              </View>
            )}

            {hours.notes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Notes:</Text>
                <Text style={styles.detailValue}>{hours.notes}</Text>
              </View>
            )}

            {hours.status === 'PENDING' && user?.role === 'Plant Manager' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => {
                    setSelectedHours(hours);
                    setShowApprovalModal(true);
                  }}
                >
                  <XCircle size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => {
                    setSelectedHours(hours);
                    setShowApprovalModal(true);
                  }}
                >
                  <CheckCircle size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Approve</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Operator Hours Dashboard',
          headerStyle: { backgroundColor: '#f59e0b' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' }
        }}
      />

      {/* Statistics Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
        <View style={styles.statCard}>
          <TrendingUp size={24} color="#3b82f6" />
          <Text style={styles.statValue}>{getStatistics.totalHours}h</Text>
          <Text style={styles.statLabel}>Total Hours</Text>
        </View>
        
        <View style={styles.statCard}>
          <User size={24} color="#8b5cf6" />
          <Text style={styles.statValue}>{getStatistics.uniqueOperators.size}</Text>
          <Text style={styles.statLabel}>Operators</Text>
        </View>

        <View style={styles.statCard}>
          <Truck size={24} color="#10b981" />
          <Text style={styles.statValue}>{getStatistics.uniqueAssets.size}</Text>
          <Text style={styles.statLabel}>Assets Used</Text>
        </View>

        <View style={styles.statCard}>
          <Clock size={24} color="#f59e0b" />
          <Text style={styles.statValue}>{getStatistics.pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </ScrollView>

      {/* Search and Filter Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search operator, asset, location..."
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              applyFilters(operatorHours, text, filterPeriod, filterStatus, selectedOperator);
            }}
            placeholderTextColor="#94a3b8"
          />
        </View>
        
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Filter size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={exportToCSV}
        >
          <Download size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterPills}>
        {filterPeriod !== 'all' && (
          <View style={styles.filterPill}>
            <Text style={styles.filterPillText}>Period: {filterPeriod}</Text>
          </View>
        )}
        {filterStatus !== 'all' && (
          <View style={styles.filterPill}>
            <Text style={styles.filterPillText}>Status: {filterStatus}</Text>
          </View>
        )}
        {selectedOperator !== 'all' && (
          <View style={styles.filterPill}>
            <Text style={styles.filterPillText}>Operator Filter</Text>
          </View>
        )}
      </View>

      {/* Hours List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Loading operator hours...</Text>
        </View>
      ) : filteredHours.length === 0 ? (
        <View style={styles.emptyState}>
          <Clock size={48} color="#cbd5e1" />
          <Text style={styles.emptyStateTitle}>No Hours Found</Text>
          <Text style={styles.emptyStateText}>
            No operator hours match your current filters
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.hoursList} showsVerticalScrollIndicator={false}>
          {filteredHours.map(renderHoursCard)}
        </ScrollView>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Options</Text>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Time Period</Text>
              <View style={styles.filterOptions}>
                {(['today', 'week', 'month', 'all'] as FilterPeriod[]).map(period => (
                  <TouchableOpacity
                    key={period}
                    style={[styles.filterOption, filterPeriod === period && styles.filterOptionActive]}
                    onPress={() => setFilterPeriod(period)}
                  >
                    <Text style={[styles.filterOptionText, filterPeriod === period && styles.filterOptionTextActive]}>
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Status</Text>
              <View style={styles.filterOptions}>
                {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as FilterStatus[]).map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[styles.filterOption, filterStatus === status && styles.filterOptionActive]}
                    onPress={() => setFilterStatus(status)}
                  >
                    <Text style={[styles.filterOptionText, filterStatus === status && styles.filterOptionTextActive]}>
                      {status === 'all' ? 'All' : status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonApply]}
                onPress={() => {
                  applyFilters(operatorHours, searchQuery, filterPeriod, filterStatus, selectedOperator);
                  setShowFilterModal(false);
                }}
              >
                <Text style={styles.modalButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Approval Modal */}
      <Modal
        visible={showApprovalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowApprovalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Review Hours</Text>
            
            {selectedHours && (
              <View style={styles.reviewDetails}>
                <Text style={styles.reviewOperator}>{selectedHours.operatorName}</Text>
                <Text style={styles.reviewAsset}>{selectedHours.assetType} - {selectedHours.assetNumber}</Text>
                <Text style={styles.reviewHours}>Total Hours: {selectedHours.totalHours}h</Text>
                <Text style={styles.reviewDate}>{format(selectedHours.date, 'MMMM dd, yyyy')}</Text>
              </View>
            )}

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Notes (Optional for approval, required for rejection)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={approvalNotes}
                onChangeText={setApprovalNotes}
                placeholder="Enter notes..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.rejectButton]}
                onPress={handleReject}
              >
                <Text style={styles.modalButtonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.approveButton]}
                onPress={handleApprove}
              >
                <Text style={styles.modalButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 120
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 8
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 8,
    fontSize: 15,
    color: '#1e293b'
  },
  filterButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  exportButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterPills: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8
  },
  filterPill: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  filterPillText: {
    fontSize: 12,
    color: '#0369a1',
    fontWeight: '600'
  },
  hoursList: {
    flex: 1,
    padding: 16
  },
  hoursCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 6
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  operatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  operatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b'
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  assetText: {
    fontSize: 13,
    color: '#64748b'
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  statusPending: {
    backgroundColor: '#fef3c7'
  },
  statusApproved: {
    backgroundColor: '#d1fae5'
  },
  statusRejected: {
    backgroundColor: '#fee2e2'
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600'
  },
  statusTextPending: {
    color: '#f59e0b'
  },
  statusTextApproved: {
    color: '#10b981'
  },
  statusTextRejected: {
    color: '#ef4444'
  },
  cardMetrics: {
    flexDirection: 'row',
    gap: 16
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  metricText: {
    fontSize: 13,
    color: '#475569'
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0'
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500'
  },
  detailValue: {
    fontSize: 13,
    color: '#1e293b',
    flex: 1,
    textAlign: 'right'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 4
  },
  approveButton: {
    backgroundColor: '#10b981'
  },
  rejectButton: {
    backgroundColor: '#ef4444'
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748b'
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b'
  },
  emptyStateText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 32
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16
  },
  filterSection: {
    marginBottom: 20
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  filterOptionActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6'
  },
  filterOptionText: {
    fontSize: 14,
    color: '#475569'
  },
  filterOptionTextActive: {
    color: '#fff'
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  modalButtonCancel: {
    backgroundColor: '#f1f5f9'
  },
  modalButtonApply: {
    backgroundColor: '#3b82f6'
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff'
  },
  modalButtonTextCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569'
  },
  reviewDetails: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16
  },
  reviewOperator: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4
  },
  reviewAsset: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8
  },
  reviewHours: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 4
  },
  reviewDate: {
    fontSize: 13,
    color: '#64748b'
  },
  modalField: {
    marginBottom: 16
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b'
  },
  modalTextArea: {
    minHeight: 100,
    paddingTop: 12
  }
});