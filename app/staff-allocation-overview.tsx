import { Stack } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Grid, Users, ChevronRight, UserCheck } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useQuery } from '@tanstack/react-query';
import { useSyncOnFocus } from '../utils/hooks/useSyncOnFocus';
import { useState } from 'react';

type PvArea = {
  id: string;
  name: string;
  siteId: string;
};

type BlockArea = {
  id: string;
  name: string;
  pvAreaId: string;
  pvAreaName: string;
  siteId: string;
};

type AllocatedEmployee = {
  id: string;
  name: string;
  role: string;
  idNumber: string;
  allocatedPvArea?: string;
  allocatedBlockNumber?: string;
  allocationStatus?: string;
  allocationDate?: any;
};

type GroupedAllocation = {
  pvArea: string;
  blocks: {
    blockName: string;
    employees: AllocatedEmployee[];
  }[];
};

export default function StaffAllocationOverviewScreen() {
  const { user } = useAuth();
  useSyncOnFocus();
  const insets = useSafeAreaInsets();
  const [expandedPvAreas, setExpandedPvAreas] = useState<Record<string, boolean>>({});
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  const { data: pvAreas = [], isLoading: loadingPvAreas } = useQuery({
    queryKey: ['pvAreas', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      const q = query(
        collection(db, 'pvAreas'),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);
      const areas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as PvArea[];
      
      return areas.sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
    },
    enabled: !!user?.siteId,
  });

  const { data: blockAreas = [], isLoading: loadingBlocks } = useQuery({
    queryKey: ['blockAreas', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      const q = query(
        collection(db, 'blockAreas'),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);
      const blocks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BlockArea[];
      
      return blocks.sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
    },
    enabled: !!user?.siteId,
  });

  const { data: allocatedEmployees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['allocatedEmployees', user?.masterAccountId],
    queryFn: async () => {
      if (!user?.masterAccountId) return [];
      console.log('👥 ==================== LOADING ALLOCATED EMPLOYEES ====================');
      console.log('👥 Query params - masterAccountId:', user.masterAccountId);
      console.log('👥 Query params - allocationStatus: ALLOCATED');
      
      const q = query(
        collection(db, 'employees'),
        where('masterAccountId', '==', user.masterAccountId),
        where('allocationStatus', '==', 'ALLOCATED')
      );
      const snapshot = await getDocs(q);
      const employees = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('👥 Employee found:', {
          id: doc.id,
          name: data.name,
          role: data.role,
          allocationStatus: data.allocationStatus,
          pvArea: data.allocatedPvArea,
          blockArea: data.allocatedBlockNumber,
          allocatedAt: data.allocationDate,
        });
        return {
          id: doc.id,
          ...data,
        };
      }) as AllocatedEmployee[];
      
      console.log('👥 Total allocated employees loaded:', employees.length);
      console.log('👥 ================================================================');
      return employees;
    },
    enabled: !!user?.masterAccountId,
  });

  const groupedData: GroupedAllocation[] = pvAreas.map(pvArea => {
    const blocksForPv = blockAreas.filter(b => b.pvAreaId === pvArea.id);
    
    console.log('📊 Grouping employees for PV Area:', pvArea.name);
    console.log('📊 Blocks in this PV Area:', blocksForPv.map(b => b.name));
    
    return {
      pvArea: pvArea.name,
      blocks: blocksForPv.map(block => {
        const employeesForBlock = allocatedEmployees.filter(
          employee => {
            const matches = employee.allocatedPvArea === pvArea.name &&
                           employee.allocatedBlockNumber === block.name;
            
            if (matches) {
              console.log('✅ Employee matched to', pvArea.name, '-', block.name, ':', employee.name);
            }
            
            return matches;
          }
        );
        
        console.log('📊 Employees in', pvArea.name, '-', block.name, ':', employeesForBlock.length);
        
        return {
          blockName: block.name,
          employees: employeesForBlock,
        };
      }),
    };
  });

  const isLoading = loadingPvAreas || loadingBlocks || loadingEmployees;

  const togglePvArea = (pvArea: string) => {
    setExpandedPvAreas(prev => ({ ...prev, [pvArea]: !prev[pvArea] }));
  };

  const toggleBlock = (key: string) => {
    setExpandedBlocks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const scrollContentStyle = {
    paddingBottom: Math.max(insets.bottom + 120, 160),
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 0) }]}> 
      <Stack.Screen
        options={{
          title: 'Staff Allocation Overview',
          headerStyle: {
            backgroundColor: '#000',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
      >
        <View style={styles.headerCard}>
          <UserCheck size={32} color="#8b5cf6" />
          <Text style={styles.headerTitle}>Staff Allocation by PV & Block</Text>
          <Text style={styles.headerSubtitle}>
            {allocatedEmployees.length} employees allocated across {pvAreas.length} PV areas
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.loadingText}>Loading allocation data...</Text>
          </View>
        ) : groupedData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MapPin size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No PV Areas configured</Text>
            <Text style={styles.emptySubtext}>Set up PV Areas and Blocks in settings first</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {groupedData.map((group, pvIdx) => {
              const isPvExpanded = expandedPvAreas[group.pvArea];
              const totalEmployeesInPv = group.blocks.reduce((sum, b) => sum + b.employees.length, 0);

              return (
                <View key={pvIdx} style={styles.pvAreaCard}>
                  <TouchableOpacity
                    style={styles.pvAreaHeader}
                    onPress={() => togglePvArea(group.pvArea)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pvAreaHeaderLeft}>
                      <MapPin size={24} color="#4285F4" />
                      <View style={styles.pvAreaInfo}>
                        <Text style={styles.pvAreaName}>{group.pvArea}</Text>
                        <Text style={styles.pvAreaSubtext}>
                          {group.blocks.length} blocks • {totalEmployeesInPv} employees
                        </Text>
                      </View>
                    </View>
                    <ChevronRight 
                      size={20} 
                      color="#64748b" 
                      style={{ 
                        transform: [{ rotate: isPvExpanded ? '90deg' : '0deg' }] 
                      }} 
                    />
                  </TouchableOpacity>

                  {isPvExpanded && (
                    <View style={styles.blocksContainer}>
                      {group.blocks.length === 0 ? (
                        <View style={styles.emptyBlocksContainer}>
                          <Grid size={24} color="#cbd5e1" />
                          <Text style={styles.emptyBlocksText}>No blocks in this PV Area</Text>
                        </View>
                      ) : (
                        group.blocks.map((block, blockIdx) => {
                          const blockKey = `${group.pvArea}-${block.blockName}`;
                          const isBlockExpanded = expandedBlocks[blockKey];

                          return (
                            <View key={blockIdx} style={styles.blockCard}>
                              <TouchableOpacity
                                style={styles.blockHeader}
                                onPress={() => toggleBlock(blockKey)}
                                activeOpacity={0.7}
                              >
                                <View style={styles.blockHeaderLeft}>
                                  <Grid size={20} color="#34A853" />
                                  <View style={styles.blockInfo}>
                                    <Text style={styles.blockName}>{block.blockName}</Text>
                                    <Text style={styles.blockSubtext}>
                                      {block.employees.length} {block.employees.length === 1 ? 'employee' : 'employees'} allocated
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.blockHeaderRight}>
                                  {block.employees.length > 0 && (
                                    <View style={styles.employeeCountBadge}>
                                      <Text style={styles.employeeCountText}>{block.employees.length}</Text>
                                    </View>
                                  )}
                                  <ChevronRight 
                                    size={16} 
                                    color="#64748b" 
                                    style={{ 
                                      transform: [{ rotate: isBlockExpanded ? '90deg' : '0deg' }] 
                                    }} 
                                  />
                                </View>
                              </TouchableOpacity>

                              {isBlockExpanded && (
                                <View style={styles.employeesContainer}>
                                  {block.employees.length === 0 ? (
                                    <View style={styles.emptyEmployeesContainer}>
                                      <Users size={20} color="#cbd5e1" />
                                      <Text style={styles.emptyEmployeesText}>No employees allocated to this block</Text>
                                    </View>
                                  ) : (
                                    block.employees.map((employee, empIdx) => (
                                      <View key={empIdx} style={styles.employeeItem}>
                                        <Users size={18} color="#8b5cf6" />
                                        <View style={styles.employeeDetails}>
                                          <Text style={styles.employeeName}>{employee.name}</Text>
                                          <Text style={styles.employeeRole}>{employee.role}</Text>
                                          <Text style={styles.employeeMeta}>ID: {employee.idNumber}</Text>
                                        </View>
                                      </View>
                                    ))
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  headerCard: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 4,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#a0a0a0',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#a0a0a0',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#707070',
  },
  section: {
    gap: 12,
    paddingHorizontal: 16,
  },
  pvAreaCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  pvAreaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1f2937',
    borderBottomWidth: 2,
    borderBottomColor: '#4285F4',
  },
  pvAreaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  pvAreaInfo: {
    flex: 1,
  },
  pvAreaName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  pvAreaSubtext: {
    fontSize: 13,
    color: '#a0a0a0',
    marginTop: 2,
  },
  blocksContainer: {
    padding: 12,
    gap: 8,
  },
  emptyBlocksContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyBlocksText: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  blockCard: {
    backgroundColor: '#0f1419',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2a1f3d',
    borderBottomWidth: 1,
    borderBottomColor: '#8b5cf6',
  },
  blockHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  blockHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockInfo: {
    flex: 1,
  },
  blockName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  blockSubtext: {
    fontSize: 12,
    color: '#a0a0a0',
    marginTop: 2,
  },
  employeeCountBadge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  employeeCountText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  employeesContainer: {
    padding: 8,
    gap: 8,
  },
  emptyEmployeesContainer: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyEmployeesText: {
    fontSize: 13,
    color: '#a0a0a0',
  },
  employeeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  employeeDetails: {
    flex: 1,
    gap: 2,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  employeeRole: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#8b5cf6',
  },
  employeeMeta: {
    fontSize: 11,
    color: '#a0a0a0',
  },
});
