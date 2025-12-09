import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, Grid3x3, Info, MapPin, Database } from 'lucide-react-native';
import { ActivityModuleConfig, ActivityBaseBlockType, ActivityMicroModule, GridConfiguration, HandoverTarget } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

type ActivityModuleConfigFormProps = {
  initialConfig?: ActivityModuleConfig;
  onChange: (config: ActivityModuleConfig) => void;
};

type PvArea = {
  id: string;
  name: string;
  siteId: string;
  createdAt: any;
};

type RowConfig = {
  row: string;
  columns: string[];
};

type BlockArea = {
  id: string;
  name: string;
  pvAreaId: string;
  pvAreaName: string;
  siteId: string;
  rowConfigs: RowConfig[];
  createdAt: any;
};

const BASE_BLOCK_OPTIONS: { value: ActivityBaseBlockType; label: string; description: string }[] = [
  {
    value: 'STANDARD_COMPLETED_TODAY',
    label: 'Standard Completed Today Block',
    description: 'Default progress block with completed today input',
  },
  {
    value: 'GRID_TYPE_ROW_PROGRESS',
    label: 'Grid Type Block (Row Progress)',
    description: 'Grid-based progress tracking for PV blocks',
  },
];

const MICRO_MODULE_OPTIONS: { value: ActivityMicroModule; label: string; description: string }[] = [
  { value: 'HANDOVER_CARDS', label: 'Cross Teams Handover Cards', description: 'Show handover cards for cross-work teams' },
  { value: 'QC_REQUEST', label: 'QC Request', description: 'Show QC request button' },
  { value: 'CONCRETE_REQUEST', label: 'Concrete Request', description: 'Show concrete request button' },
];

const RESOURCE_PACK_MODULES: ActivityMicroModule[] = ['PLANT_REQUEST', 'MATERIALS_REQUEST', 'STAFF_REQUEST'];

const PLACEMENT_OPTIONS: { value: 'inside' | 'above' | 'between'; label: string }[] = [
  { value: 'inside', label: 'Inside Activity Block' },
  { value: 'above', label: 'Above Activity Block' },
  { value: 'between', label: 'Below Activity Block' },
];

const HANDOVER_TARGET_OPTIONS: { value: HandoverTarget; label: string }[] = [
  { value: 'Surveyor', label: 'Surveyor' },
  { value: 'Cabling', label: 'Cabling' },
  { value: 'Termination', label: 'Termination' },
  { value: 'Inverters', label: 'Inverters' },
  { value: 'Mechanical', label: 'Mechanical' },
  { value: 'Commissioning', label: 'Commissioning' },
  { value: 'Drilling', label: 'Drilling' },
];

const UNIT_OPTIONS = ['m', 'km', 'm²', 'm³', 'units', 'pcs', 'hours'];

export default function ActivityModuleConfigForm({ initialConfig, onChange }: ActivityModuleConfigFormProps) {
  const { user } = useAuth();
  
  const [baseBlockType, setBaseBlockType] = useState<ActivityBaseBlockType>(
    initialConfig?.baseBlockType || 'STANDARD_COMPLETED_TODAY'
  );
  const [microModules, setMicroModules] = useState<ActivityModuleConfig['microModules']>(
    initialConfig?.microModules || {}
  );
  const [gridConfig, setGridConfig] = useState<GridConfiguration>(
    initialConfig?.gridConfig || {
      totalRows: 10,
      totalColumns: 20,
      rowNamingConvention: 'ALPHA' as const,
      columnNamingConvention: 'NUMERIC' as const,
      reverseRowOrder: false,
      reverseColumnOrder: false,
    }
  );

  const [boqQuantity, setBoqQuantity] = useState<string>(
    initialConfig?.boqQuantity?.toString() || ''
  );
  const [boqUnit, setBoqUnit] = useState<string>(
    initialConfig?.boqUnit || 'm'
  );

  const [selectedPvAreaId, setSelectedPvAreaId] = useState<string | null>(
    initialConfig?.gridConfig?.pvAreaId || null
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    initialConfig?.gridConfig?.blockAreaId || null
  );

  const { data: pvAreas = [], isLoading: loadingPvAreas } = useQuery({
    queryKey: ['pvAreas-for-activity', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      const q = query(
        collection(db, 'pvAreas'),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as PvArea[];
    },
    enabled: !!user?.siteId && baseBlockType === 'GRID_TYPE_ROW_PROGRESS',
  });

  const { data: blockAreas = [], isLoading: loadingBlocks } = useQuery({
    queryKey: ['blockAreas-for-activity', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      const q = query(
        collection(db, 'blockAreas'),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BlockArea[];
    },
    enabled: !!user?.siteId && baseBlockType === 'GRID_TYPE_ROW_PROGRESS',
  });

  const filteredBlocks = useMemo(() => {
    if (!selectedPvAreaId) return [];
    return blockAreas.filter(b => b.pvAreaId === selectedPvAreaId);
  }, [blockAreas, selectedPvAreaId]);

  const selectedBlock = useMemo(() => {
    return blockAreas.find(b => b.id === selectedBlockId);
  }, [blockAreas, selectedBlockId]);

  useEffect(() => {
    if (selectedBlock) {
      setGridConfig(prev => ({
        ...prev,
        pvAreaId: selectedBlock.pvAreaId,
        pvAreaName: selectedBlock.pvAreaName,
        blockAreaId: selectedBlock.id,
        blockAreaName: selectedBlock.name,
      }));
    }
  }, [selectedBlock]);

  const resourcePackEnabled = useMemo(() => {
    return RESOURCE_PACK_MODULES.every((module) => microModules[module]?.enabled);
  }, [microModules]);

  const isResourcePackPartial = useMemo(() => {
    const enabledCount = RESOURCE_PACK_MODULES.filter((module) => microModules[module]?.enabled).length;
    return enabledCount > 0 && enabledCount < RESOURCE_PACK_MODULES.length;
  }, [microModules]);

  const resourcePackPlacement = useMemo<'inside' | 'above' | 'between'>(() => {
    for (const module of RESOURCE_PACK_MODULES) {
      const placement = microModules[module]?.placement;
      if (placement) {
        return placement;
      }
    }
    return 'inside';
  }, [microModules]);

  const handleToggleResourcePack = useCallback(() => {
    setMicroModules((prev) => {
      const packActive = RESOURCE_PACK_MODULES.every((module) => prev[module]?.enabled);
      console.log('🔁 Resource pack toggle pressed', { packActive });
      if (packActive) {
        const updated = { ...prev };
        RESOURCE_PACK_MODULES.forEach((module) => {
          delete updated[module];
        });
        console.log('➖ Disabled resource pack modules');
        return updated;
      }
      const updated = { ...prev };
      RESOURCE_PACK_MODULES.forEach((module) => {
        updated[module] = {
          enabled: true,
          placement: resourcePackPlacement,
        };
      });
      console.log('➕ Enabled resource pack modules', { placement: resourcePackPlacement });
      return updated;
    });
  }, [resourcePackPlacement]);

  const handleResourcePackPlacementChange = useCallback((placement: 'inside' | 'above' | 'between') => {
    setMicroModules((prev) => {
      const updated = { ...prev };
      RESOURCE_PACK_MODULES.forEach((module) => {
        updated[module] = {
          ...(updated[module] || { enabled: true }),
          enabled: true,
          placement,
        };
      });
      console.log('🎯 Updated resource pack placement', { placement });
      return updated;
    });
  }, []);

  const handleConfigChange = useCallback(() => {
    const config: ActivityModuleConfig = {
      baseBlockType,
      microModules,
    };

    if (baseBlockType === 'GRID_TYPE_ROW_PROGRESS') {
      config.gridConfig = gridConfig;
    }

    const boqQty = parseFloat(boqQuantity);
    if (!isNaN(boqQty) && boqQty > 0 && boqUnit) {
      config.boqQuantity = boqQty;
      config.boqUnit = boqUnit;
    }

    console.log('🔄 ActivityModuleConfigForm onChange called');
    console.log('📝 Final config:', JSON.stringify(config, null, 2));
    onChange(config);
  }, [baseBlockType, microModules, gridConfig, boqQuantity, boqUnit, onChange]);

  useEffect(() => {
    handleConfigChange();
  }, [handleConfigChange]);

  const toggleMicroModule = (module: ActivityMicroModule) => {
    console.log('✅ toggleMicroModule called:', module);
    setMicroModules((prev) => {
      if (RESOURCE_PACK_MODULES.includes(module)) {
        console.log('  ⚠️ Resource pack modules are managed via the bundle toggle');
        return prev;
      }
      const isEnabled = prev[module]?.enabled;
      
      if (isEnabled) {
        const updated = { ...prev };
        delete updated[module];
        console.log('  ➖ Disabled module:', module);
        console.log('  📝 Updated microModules:', JSON.stringify(updated, null, 2));
        return updated;
      } else {
        const updated = {
          ...prev,
          [module]: {
            enabled: true,
            placement: 'inside' as const,
          },
        };
        console.log('  ➕ Enabled module:', module);
        console.log('  📝 Updated microModules:', JSON.stringify(updated, null, 2));
        return updated;
      }
    });
  };

  const updatePlacement = (module: ActivityMicroModule, placement: 'inside' | 'above' | 'between') => {
    if (RESOURCE_PACK_MODULES.includes(module)) {
      handleResourcePackPlacementChange(placement);
      return;
    }
    setMicroModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module]!,
        placement,
      },
    }));
  };

  const updateHandoverTarget = (module: ActivityMicroModule, target: HandoverTarget) => {
    setMicroModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module]!,
        handoverTarget: target,
      },
    }));
  };



  const handleSelectPvArea = (pvAreaId: string) => {
    setSelectedPvAreaId(pvAreaId);
    setSelectedBlockId(null);
  };

  const handleSelectBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BOQ (Bill of Quantities)</Text>
        <Text style={styles.sectionDescription}>
          Define the total project quantity for this activity type. This will be used as the baseline for global dashboard progress (contractual completion).
        </Text>
        
        <View style={styles.boqInputSection}>
          <View style={styles.boqInputRow}>
            <View style={styles.boqQuantityInput}>
              <Text style={styles.inputLabel}>BOQ Quantity</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={boqQuantity}
                onChangeText={setBoqQuantity}
                placeholder="e.g., 5000"
                placeholderTextColor="#9aa0a6"
              />
            </View>
            
            <View style={styles.boqUnitInput}>
              <Text style={styles.inputLabel}>Unit</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.unitChipsContainer}
              >
                {UNIT_OPTIONS.map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[
                      styles.unitChip,
                      boqUnit === unit && styles.unitChipActive,
                    ]}
                    onPress={() => setBoqUnit(unit)}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        boqUnit === unit && styles.unitChipTextActive,
                      ]}
                    >
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          
          {boqQuantity && !isNaN(parseFloat(boqQuantity)) && parseFloat(boqQuantity) > 0 && (
            <View style={styles.boqPreviewBox}>
              <Database size={16} color="#34A853" strokeWidth={2} />
              <Text style={styles.boqPreviewText}>
                Project BOQ: {parseFloat(boqQuantity).toLocaleString()} {boqUnit}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Base Block Type</Text>
        <Text style={styles.sectionDescription}>
          Select the primary block type for this activity
        </Text>
        {BASE_BLOCK_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.radioOption, baseBlockType === option.value && styles.radioOptionSelected]}
            onPress={() => setBaseBlockType(option.value)}
          >
            <View style={styles.radioCircle}>
              {baseBlockType === option.value && <View style={styles.radioCircleSelected} />}
            </View>
            <View style={styles.radioContent}>
              <Text style={styles.radioLabel}>{option.label}</Text>
              <Text style={styles.radioDescription}>{option.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
        
        {baseBlockType === 'GRID_TYPE_ROW_PROGRESS' && (
          <View style={styles.gridConfigSection}>
            <View style={styles.gridHeader}>
              <Grid3x3 size={20} color="#4285F4" strokeWidth={2} />
              <Text style={styles.gridHeaderTitle}>Grid Configuration</Text>
            </View>
            <Text style={styles.gridHeaderDescription}>
              Select a PV Area and Block to configure this activity&apos;s grid layout and scope
            </Text>

            {loadingPvAreas || loadingBlocks ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4285F4" />
                <Text style={styles.loadingText}>Loading PV Areas & Blocks...</Text>
              </View>
            ) : pvAreas.length === 0 ? (
              <View style={styles.warningBox}>
                <Database size={20} color="#f57c00" />
                <Text style={styles.warningText}>
                  No PV Areas found. Please create PV Areas and Blocks in Settings → PV Areas & Blocks first.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.selectionSection}>
                  <Text style={styles.inputLabel}>1. Select PV Area</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsContainer}
                  >
                    {pvAreas.map((pvArea) => (
                      <TouchableOpacity
                        key={pvArea.id}
                        style={[
                          styles.chip,
                          selectedPvAreaId === pvArea.id && styles.chipActive
                        ]}
                        onPress={() => handleSelectPvArea(pvArea.id)}
                      >
                        <MapPin size={14} color={selectedPvAreaId === pvArea.id ? '#4285F4' : '#5f6368'} strokeWidth={2} />
                        <Text style={[
                          styles.chipText,
                          selectedPvAreaId === pvArea.id && styles.chipTextActive
                        ]}>
                          {pvArea.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {selectedPvAreaId && filteredBlocks.length > 0 && (
                  <View style={styles.selectionSection}>
                    <Text style={styles.inputLabel}>2. Select Block</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipsContainer}
                    >
                      {filteredBlocks.map((block) => (
                        <TouchableOpacity
                          key={block.id}
                          style={[
                            styles.chip,
                            selectedBlockId === block.id && styles.chipActive
                          ]}
                          onPress={() => handleSelectBlock(block.id)}
                        >
                          <Grid3x3 size={14} color={selectedBlockId === block.id ? '#34A853' : '#5f6368'} strokeWidth={2} />
                          <Text style={[
                            styles.chipText,
                            selectedBlockId === block.id && styles.chipTextActive
                          ]}>
                            {block.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {selectedBlock && (
                  <>
                    <View style={styles.infoBox}>
                      <Info size={16} color="#1967d2" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>Selected: {selectedBlock.pvAreaName} → {selectedBlock.name}</Text>
                        <Text style={styles.infoText}>
                          Now define column-row configuration for this activity
                        </Text>
                      </View>
                    </View>

                    <View style={styles.gridDimensionsSection}>
                      <Text style={styles.gridDimensionsTitle}>Define Column-Row Configuration</Text>
                      <Text style={styles.gridDimensionsDescription}>
                        Add columns (A, B, C...) and set how many rows each column contains. Total cells = 100% scope.
                      </Text>
                      
                      <TouchableOpacity 
                        style={styles.addColumnButton}
                        onPress={() => {
                          const flexCols = gridConfig.flexibleColumns || [];
                          const nextColumnIndex = flexCols.length;
                          const nextColumnLabel = String.fromCharCode(65 + nextColumnIndex);
                          
                          setGridConfig(prev => ({
                            ...prev,
                            flexibleColumns: [
                              ...(prev.flexibleColumns || []),
                              { column: nextColumnLabel, rows: 1 }
                            ]
                          }));
                        }}
                      >
                        <Text style={styles.addColumnButtonText}>+ Add Column</Text>
                      </TouchableOpacity>

                      {(gridConfig.flexibleColumns || []).map((col, index) => (
                        <View key={index} style={styles.columnConfigRow}>
                          <View style={styles.columnLabelBox}>
                            <Text style={styles.columnLabel}>Column {col.column}</Text>
                          </View>
                          <View style={styles.columnRowsInput}>
                            <Text style={styles.inputLabel}>Rows:</Text>
                            <TextInput
                              style={styles.textInput}
                              keyboardType="numeric"
                              value={String(col.rows)}
                              onChangeText={(text) => {
                                const num = parseInt(text, 10);
                                const updatedCols = [...(gridConfig.flexibleColumns || [])];
                                updatedCols[index] = {
                                  ...updatedCols[index],
                                  rows: isNaN(num) || num <= 0 ? 1 : num
                                };
                                setGridConfig(prev => ({ ...prev, flexibleColumns: updatedCols }));
                              }}
                              placeholder="e.g., 10"
                              placeholderTextColor="#9aa0a6"
                            />
                          </View>
                          <TouchableOpacity
                            style={styles.removeColumnButton}
                            onPress={() => {
                              const updatedCols = (gridConfig.flexibleColumns || []).filter((_, i) => i !== index);
                              setGridConfig(prev => ({ ...prev, flexibleColumns: updatedCols }));
                            }}
                          >
                            <Text style={styles.removeColumnButtonText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}

                      {(gridConfig.flexibleColumns || []).length > 0 && (
                        <View style={styles.gridSummaryBox}>
                          <Check size={16} color="#34A853" strokeWidth={2.5} />
                          <Text style={styles.gridSummaryText}>
                            Total: {(gridConfig.flexibleColumns || []).reduce((sum, col) => sum + col.rows, 0)} cells (100% scope)
                          </Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Micro-Modules</Text>
        <Text style={styles.sectionDescription}>
          Toggle additional modules for this activity
        </Text>
        <View style={styles.microModuleContainer}>
          <TouchableOpacity
            style={[styles.checkboxOption, resourcePackEnabled && styles.checkboxOptionSelected]}
            onPress={handleToggleResourcePack}
            testID="resource-pack-toggle"
          >
            <View style={[styles.checkbox, resourcePackEnabled && styles.checkboxSelected]}>
              {resourcePackEnabled && <Check size={16} color="#fff" strokeWidth={3} />}
            </View>
            <View style={styles.checkboxContent}>
              <Text style={styles.checkboxLabel}>Request Resources Pack</Text>
              <Text style={styles.checkboxDescription}>
                Enable Plant, Staff, and Materials request cards together so supervisors always get all three options.
              </Text>
            </View>
          </TouchableOpacity>

          {resourcePackEnabled && (
            <>
              <View style={styles.placementSelector}>
                <Text style={styles.placementLabel}>Placement:</Text>
                <View style={styles.placementButtons}>
                  {PLACEMENT_OPTIONS.map((placementOption) => (
                    <TouchableOpacity
                      key={`resource-pack-${placementOption.value}`}
                      style={[
                        styles.placementButton,
                        resourcePackPlacement === placementOption.value && styles.placementButtonSelected,
                      ]}
                      onPress={() => handleResourcePackPlacementChange(placementOption.value)}
                      testID={`resource-pack-placement-${placementOption.value}`}
                    >
                      <Text
                        style={[
                          styles.placementButtonText,
                          resourcePackPlacement === placementOption.value && styles.placementButtonTextSelected,
                        ]}
                      >
                        {placementOption.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.requestCardsInfo}>
                <Text style={styles.requestCardsInfoText}>
                  Request Resources shows Plant, Staff, and Materials cards exactly like the supervisor screen bundle.
                </Text>
              </View>
            </>
          )}

          {!resourcePackEnabled && isResourcePackPartial && (
            <View style={styles.partialPackWarning}>
              <Text style={styles.partialPackWarningText}>
                Some of the resource cards are toggled individually. Enable the pack to keep Plant, Staff, and Materials in sync.
              </Text>
            </View>
          )}
        </View>

        {MICRO_MODULE_OPTIONS.map((option) => {
          const isEnabled = microModules[option.value]?.enabled;
          const currentPlacement = microModules[option.value]?.placement || 'inside';
          const currentHandoverTarget = microModules[option.value]?.handoverTarget;
          const isHandoverCard = option.value === 'HANDOVER_CARDS';

          return (
            <View key={option.value} style={styles.microModuleContainer}>
              <TouchableOpacity
                style={[styles.checkboxOption, isEnabled && styles.checkboxOptionSelected]}
                onPress={() => toggleMicroModule(option.value)}
              >
                <View style={[styles.checkbox, isEnabled && styles.checkboxSelected]}>
                  {isEnabled && <Check size={16} color="#fff" strokeWidth={3} />}
                </View>
                <View style={styles.checkboxContent}>
                  <Text style={styles.checkboxLabel}>{option.label}</Text>
                  <Text style={styles.checkboxDescription}>{option.description}</Text>
                </View>
              </TouchableOpacity>

              {isEnabled && (
                <View style={styles.placementSelector}>
                  <Text style={styles.placementLabel}>Placement:</Text>
                  <View style={styles.placementButtons}>
                    {PLACEMENT_OPTIONS.map((placementOption) => (
                      <TouchableOpacity
                        key={placementOption.value}
                        style={[
                          styles.placementButton,
                          currentPlacement === placementOption.value && styles.placementButtonSelected,
                        ]}
                        onPress={() => updatePlacement(option.value, placementOption.value)}
                      >
                        <Text
                          style={[
                            styles.placementButtonText,
                            currentPlacement === placementOption.value && styles.placementButtonTextSelected,
                          ]}
                        >
                          {placementOption.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {isEnabled && isHandoverCard && (
                <View style={styles.handoverTargetSelector}>
                  <Text style={styles.handoverTargetLabel}>Handover To:</Text>
                  <Text style={styles.handoverTargetDescription}>
                    Select which team this handover card will target
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.handoverTargetChips}
                  >
                    {HANDOVER_TARGET_OPTIONS.map((targetOption) => (
                      <TouchableOpacity
                        key={targetOption.value}
                        style={[
                          styles.handoverChip,
                          currentHandoverTarget === targetOption.value && styles.handoverChipSelected,
                        ]}
                        onPress={() => updateHandoverTarget(option.value, targetOption.value)}
                      >
                        <Text
                          style={[
                            styles.handoverChipText,
                            currentHandoverTarget === targetOption.value && styles.handoverChipTextSelected,
                          ]}
                        >
                          {targetOption.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}


            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#5f6368',
    marginBottom: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e8eaed',
  },
  radioOptionSelected: {
    borderColor: '#4285F4',
    backgroundColor: '#e8f0fe',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#5f6368',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioCircleSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4285F4',
  },
  radioContent: {
    flex: 1,
    marginLeft: 12,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 4,
  },
  radioDescription: {
    fontSize: 13,
    color: '#5f6368',
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e8f0fe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4285F4',
    gap: 10,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1967d2',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#1967d2',
    lineHeight: 16,
  },
  microModuleContainer: {
    marginBottom: 12,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  checkboxOptionSelected: {
    backgroundColor: '#e8f0fe',
    borderColor: '#4285F4',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#5f6368',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxSelected: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  checkboxContent: {
    flex: 1,
    marginLeft: 12,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 2,
  },
  checkboxDescription: {
    fontSize: 12,
    color: '#5f6368',
    lineHeight: 16,
  },
  placementSelector: {
    marginTop: 8,
    marginLeft: 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
  },
  placementLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#5f6368',
    marginBottom: 8,
  },
  placementButtons: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  placementButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  placementButtonSelected: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  placementButtonText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  placementButtonTextSelected: {
    color: '#fff',
  },
  gridConfigSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4285F4',
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  gridHeaderTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#4285F4',
  },
  gridHeaderDescription: {
    fontSize: 13,
    color: '#5f6368',
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#5f6368',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#ffd54f',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#f57c00',
    lineHeight: 16,
  },
  selectionSection: {
    marginBottom: 16,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  chipActive: {
    backgroundColor: '#e8f0fe',
    borderColor: '#4285F4',
    borderWidth: 2,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#5f6368',
  },
  chipTextActive: {
    color: '#4285F4',
    fontWeight: '600' as const,
  },
  scopeSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  scopeTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 4,
  },
  scopeDescription: {
    fontSize: 12,
    color: '#5f6368',
    marginBottom: 12,
  },
  scopeInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scopeValueInput: {
    flex: 1,
  },
  scopeUnitInput: {
    flex: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#5f6368',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#202124',
  },
  unitChipsContainer: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f3f4',
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  unitChipActive: {
    backgroundColor: '#34A853',
    borderColor: '#34A853',
  },
  unitChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  unitChipTextActive: {
    color: '#fff',
  },
  scopePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
  scopePreviewText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#34A853',
  },
  gridPreviewBox: {
    backgroundColor: '#e8f0fe',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  gridPreviewLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1967d2',
    marginBottom: 4,
  },
  gridPreviewText: {
    fontSize: 13,
    color: '#1967d2',
    fontWeight: '500' as const,
  },
  gridDimensionsSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  gridDimensionsTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 4,
  },
  gridDimensionsDescription: {
    fontSize: 12,
    color: '#5f6368',
    marginBottom: 12,
  },
  dimensionInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dimensionInput: {
    flex: 1,
  },
  namingSection: {
    marginBottom: 16,
  },
  namingSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 8,
  },
  namingOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  namingOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    alignItems: 'center',
  },
  namingOptionSelected: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  namingOptionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#5f6368',
    textAlign: 'center',
  },
  namingOptionTextSelected: {
    color: '#fff',
  },
  orderingSection: {
    marginBottom: 16,
  },
  orderingSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  exampleBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  exampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  exampleHeaderText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1967d2',
  },
  exampleText: {
    fontSize: 12,
    color: '#5f6368',
    marginBottom: 4,
  },
  addColumnButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  addColumnButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  columnConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  columnLabelBox: {
    minWidth: 80,
  },
  columnLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#202124',
  },
  columnRowsInput: {
    flex: 1,
    gap: 4,
  },
  removeColumnButton: {
    width: 32,
    height: 32,
    backgroundColor: '#ea4335',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeColumnButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  gridSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  gridSummaryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#34A853',
  },
  handoverTargetSelector: {
    marginTop: 12,
    marginLeft: 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
  },
  handoverTargetLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 4,
  },
  handoverTargetDescription: {
    fontSize: 11,
    color: '#5f6368',
    marginBottom: 12,
  },
  handoverTargetChips: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  handoverChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  handoverChipSelected: {
    backgroundColor: '#34A853',
    borderColor: '#34A853',
  },
  handoverChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  handoverChipTextSelected: {
    color: '#fff',
  },
  requestCardsInfo: {
    marginTop: 8,
    marginLeft: 32,
    paddingTop: 12,
    padding: 12,
    backgroundColor: '#e8f0fe',
    borderRadius: 8,
  },
  requestCardsInfoText: {
    fontSize: 12,
    color: '#1967d2',
    lineHeight: 16,
  },
  partialPackWarning: {
    marginTop: 12,
    marginLeft: 32,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  partialPackWarningText: {
    fontSize: 12,
    color: '#be123c',
    lineHeight: 16,
  },
  boqInputSection: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  boqInputRow: {
    flexDirection: 'column',
    gap: 16,
  },
  boqQuantityInput: {
    flex: 1,
  },
  boqUnitInput: {
    flex: 1,
  },
  boqPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#34A853',
  },
  boqPreviewText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#34A853',
  },
});
