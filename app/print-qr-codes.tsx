import { Stack, router } from 'expo-router';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { ArrowLeft, Search, X, Download, Printer, CheckSquare, Square, Filter } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Employee, User } from '@/types';
import { Svg, Path } from 'react-native-svg';
import QRCode from 'qrcode';

type QRItem = {
  id: string;
  name: string;
  role: string;
  type: 'employee' | 'user' | 'asset';
  contact?: string;
  email?: string;
  inductionDate?: any;
  createdAt?: any;
  qrSvgPath?: string;
};



export default function PrintQRCodesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<QRItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<QRItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'employee' | 'user' | 'asset'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const loadItems = useCallback(async () => {
    if (!user?.masterAccountId) {
      Alert.alert('Error', 'No master account found');
      return;
    }

    try {
      setIsLoading(true);
      const loadedItems: QRItem[] = [];

      const employeesRef = collection(db, 'employees');
      const usersRef = collection(db, 'users');

      let employeeQuery;
      let userQuery;

      if (user.siteId) {
        employeeQuery = query(
          employeesRef,
          where('siteId', '==', user.siteId),
          orderBy('name', 'asc')
        );
        userQuery = query(
          usersRef,
          where('siteId', '==', user.siteId),
          orderBy('name', 'asc')
        );
      } else {
        employeeQuery = query(
          employeesRef,
          where('masterAccountId', '==', user.masterAccountId),
          orderBy('name', 'asc')
        );
        userQuery = query(
          usersRef,
          where('masterAccountId', '==', user.masterAccountId),
          orderBy('name', 'asc')
        );
      }

      const [employeeSnapshot, userSnapshot] = await Promise.all([
        getDocs(employeeQuery),
        getDocs(userQuery),
      ]);

      employeeSnapshot.forEach((doc) => {
        const data = doc.data() as Employee;
        loadedItems.push({
          id: doc.id,
          name: data.name,
          role: data.role,
          type: 'employee',
          contact: data.contact,
          email: data.email,
          inductionDate: data.inductionDate,
          createdAt: data.createdAt,
        });
      });

      userSnapshot.forEach((doc) => {
        const data = doc.data() as User;
        loadedItems.push({
          id: doc.id,
          name: data.name,
          role: data.role,
          type: 'user',
          createdAt: data.createdAt,
        });
      });

      console.log('[PrintQR] Loaded', loadedItems.length, 'items');
      setItems(loadedItems);
      setFilteredItems(loadedItems);
    } catch (error) {
      console.error('[PrintQR] Error loading items:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [user?.siteId, user?.masterAccountId]);

  const applyFilters = useCallback(() => {
    let filtered = [...items];

    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      filtered = filtered.filter(item => {
        const itemDate = item.inductionDate?.toDate?.() || item.createdAt?.toDate?.();
        return itemDate && itemDate >= fromDate;
      });
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const itemDate = item.inductionDate?.toDate?.() || item.createdAt?.toDate?.();
        return itemDate && itemDate <= toDate;
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.role.toLowerCase().includes(query) ||
        item.contact?.toLowerCase().includes(query)
      );
    }

    setFilteredItems(filtered);
    setShowFilters(false);
  }, [items, filterType, filterDateFrom, filterDateTo, searchQuery]);

  const clearFilters = () => {
    setFilterType('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchQuery('');
    setFilteredItems(items);
    setShowFilters(false);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleExportPDF = () => {
    if (selectedIds.size === 0) {
      Alert.alert('No Selection', 'Please select at least one person to export');
      return;
    }

    Alert.alert(
      'Export to PDF',
      `Export ${selectedIds.size} QR code(s) as PDF access cards?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: () => {
            console.log('[PrintQR] Exporting selected items:', Array.from(selectedIds));
            Alert.alert(
              'Feature Coming Soon',
              'PDF export functionality will be implemented. Selected items: ' + selectedIds.size
            );
          },
        },
      ]
    );
  };

  const handlePrint = () => {
    if (selectedIds.size === 0) {
      Alert.alert('No Selection', 'Please select at least one person to print');
      return;
    }

    if (Platform.OS === 'web') {
      window.print();
    } else {
      Alert.alert(
        'Print',
        'Print functionality is best accessed from the web version',
        [{ text: 'OK' }]
      );
    }
  };

  useEffect(() => {
    const generateQRs = async () => {
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          if (item.qrSvgPath) return item;
          try {
            const qrData = `user/${item.id}`;
            const svgString = await QRCode.toString(qrData, {
              type: 'svg',
              width: 160,
              margin: 1,
              color: {
                dark: '#1e293b',
                light: '#ffffff'
              }
            });
            const pathMatch = svgString.match(/<path[^>]*d="([^"]*)"/i);
            if (pathMatch && pathMatch[1]) {
              return { ...item, qrSvgPath: pathMatch[1] };
            }
          } catch (error) {
            console.error('[PrintQR] Error generating QR for', item.id, error);
          }
          return item;
        })
      );
      setItems(updatedItems);
      setFilteredItems(updatedItems);
    };

    if (items.length > 0 && !items[0].qrSvgPath) {
      generateQRs();
    }
  }, [items]);

  const renderQRCard = (item: QRItem) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.qrCard, isSelected && styles.qrCardSelected]}
        onPress={() => toggleSelection(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.selectionIndicator}>
          {isSelected ? (
            <CheckSquare size={24} color="#3b82f6" />
          ) : (
            <Square size={24} color="#94a3b8" />
          )}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.qrCodeContainer}>
            {item.qrSvgPath ? (
              <Svg width={160} height={160} viewBox="0 0 160 160">
                <Path d={item.qrSvgPath} fill="#1e293b" />
              </Svg>
            ) : (
              <View style={{ width: 160, height: 160, backgroundColor: '#f8fafc' }} />
            )}
          </View>

          <View style={styles.cardDetails}>
            <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.cardRole} numberOfLines={1}>{item.role}</Text>
            {item.contact && (
              <Text style={styles.cardContact} numberOfLines={1}>{item.contact}</Text>
            )}
            <View style={styles.cardTypeTag}>
              <Text style={styles.cardTypeText}>
                {item.type === 'employee' ? 'Employee' : item.type === 'user' ? 'User' : 'Asset'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>QR Code Access Cards</Text>
          <Text style={styles.headerSubtitle}>
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select to export'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={24} color={showFilters ? '#3b82f6' : '#64748b'} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterTitle}>Filter Options</Text>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Type</Text>
            <View style={styles.filterTypeButtons}>
              {(['all', 'employee', 'user'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterTypeButton,
                    filterType === type && styles.filterTypeButtonActive,
                  ]}
                  onPress={() => setFilterType(type)}
                >
                  <Text
                    style={[
                      styles.filterTypeButtonText,
                      filterType === type && styles.filterTypeButtonTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Date From</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDateFromPicker(true)}
            >
              <Text style={[styles.dateInputText, !filterDateFrom && styles.dateInputPlaceholder]}>
                {filterDateFrom || 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Date To</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDateToPicker(true)}
            >
              <Text style={[styles.dateInputText, !filterDateTo && styles.dateInputPlaceholder]}>
                {filterDateTo || 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.filterClearButton} onPress={clearFilters}>
              <Text style={styles.filterClearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyButton} onPress={applyFilters}>
              <Text style={styles.filterApplyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Search size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, role, or contact..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (text === '') {
              setFilteredItems(items);
            } else {
              const query = text.toLowerCase();
              setFilteredItems(items.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.role.toLowerCase().includes(query) ||
                item.contact?.toLowerCase().includes(query)
              ));
            }
          }}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => {
            setSearchQuery('');
            setFilteredItems(items);
          }}>
            <X size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionsBar}>
        <TouchableOpacity style={styles.selectAllButton} onPress={selectAll}>
          <Text style={styles.selectAllButtonText}>
            {selectedIds.size === filteredItems.length ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>

        {!isLoading && items.length === 0 && (
          <TouchableOpacity style={styles.loadButton} onPress={loadItems}>
            <Text style={styles.loadButtonText}>Load Data</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Printer size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Data Found</Text>
          <Text style={styles.emptyText}>
            {items.length === 0
              ? 'Tap "Load Data" to get started'
              : 'No items match your search or filters'}
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.gridContainer}
        >
          {filteredItems.map(renderQRCard)}
        </ScrollView>
      )}

      {selectedIds.size > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportPDF}>
            <Download size={20} color="#fff" />
            <Text style={styles.exportButtonText}>Export PDF ({selectedIds.size})</Text>
          </TouchableOpacity>

          {Platform.OS === 'web' && (
            <TouchableOpacity style={styles.printButton} onPress={handlePrint}>
              <Printer size={20} color="#3b82f6" />
              <Text style={styles.printButtonText}>Print</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={showDateFromPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDateFromPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Select Start Date</Text>
              <TouchableOpacity
                onPress={() => setShowDateFromPicker(false)}
                style={styles.datePickerClose}
              >
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.nativeDateInput}
              placeholder="YYYY-MM-DD"
              value={filterDateFrom}
              onChangeText={(text) => {
                setFilterDateFrom(text);
              }}
              autoFocus
            />
            
            {Platform.OS === 'web' && (
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e: any) => {
                  setFilterDateFrom(e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  marginTop: 16,
                }}
              />
            )}

            <View style={styles.datePickerActions}>
              <TouchableOpacity
                style={styles.datePickerClearButton}
                onPress={() => {
                  setFilterDateFrom('');
                  setShowDateFromPicker(false);
                }}
              >
                <Text style={styles.datePickerClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.datePickerDoneButton}
                onPress={() => setShowDateFromPicker(false)}
              >
                <Text style={styles.datePickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDateToPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDateToPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Select End Date</Text>
              <TouchableOpacity
                onPress={() => setShowDateToPicker(false)}
                style={styles.datePickerClose}
              >
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.nativeDateInput}
              placeholder="YYYY-MM-DD"
              value={filterDateTo}
              onChangeText={(text) => {
                setFilterDateTo(text);
              }}
              autoFocus
            />
            
            {Platform.OS === 'web' && (
              <input
                type="date"
                value={filterDateTo}
                onChange={(e: any) => {
                  setFilterDateTo(e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  marginTop: 16,
                }}
              />
            )}

            <View style={styles.datePickerActions}>
              <TouchableOpacity
                style={styles.datePickerClearButton}
                onPress={() => {
                  setFilterDateTo('');
                  setShowDateToPicker(false);
                }}
              >
                <Text style={styles.datePickerClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.datePickerDoneButton}
                onPress={() => setShowDateToPicker(false)}
              >
                <Text style={styles.datePickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  filterPanel: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  filterRow: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#475569',
  },
  filterTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  filterTypeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterTypeButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  filterTypeButtonTextActive: {
    color: '#fff',
  },
  dateInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
  },
  dateInputText: {
    fontSize: 14,
    color: '#1e293b',
  },
  dateInputPlaceholder: {
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  datePickerClose: {
    padding: 4,
  },
  nativeDateInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  datePickerClearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  datePickerClearText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  datePickerDoneButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  datePickerDoneText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  filterClearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  filterClearButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  filterApplyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  filterApplyButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  selectAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  selectAllButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  loadButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
  },
  loadButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    padding: 16,
    gap: 16,
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  qrCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  cardContent: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  qrCodeContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardDetails: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  cardRole: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#3b82f6',
  },
  cardContact: {
    fontSize: 13,
    color: '#64748b',
  },
  cardTypeTag: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    marginTop: 4,
  },
  cardTypeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#475569',
    textTransform: 'uppercase' as const,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  printButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
});
