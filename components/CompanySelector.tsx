import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { ChevronDown, Building2 } from 'lucide-react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Company, Subcontractor } from '@/types';
import { getSubcontractorsByMasterAccount } from '@/utils/subcontractorManager';

type CompanySelectorProps = {
  masterAccountId: string;
  currentCompanyId?: string;
  siteId?: string;
  value: string;
  onSelect: (name: string, id: string, type: 'company' | 'subcontractor') => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  showLabel?: boolean;
  hasError?: boolean;
  errorMessage?: string;
};

export function CompanySelector({
  masterAccountId,
  currentCompanyId,
  siteId,
  value,
  onSelect,
  disabled = false,
  placeholder = 'Select company',
  label = 'Company',
  showLabel = true,
  hasError = false,
  errorMessage,
}: CompanySelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadCompaniesAndSubcontractors = useCallback(async () => {
    if (!masterAccountId) return;

    setIsLoading(true);
    try {
      console.log('[CompanySelector] Loading data with:', {
        masterAccountId,
        currentCompanyId,
        siteId,
      });

      const companiesQuery = query(
        collection(db, 'companies'),
        where('createdBy', '==', masterAccountId),
        where('status', '==', 'Active')
      );
      const companiesSnapshot = await getDocs(companiesQuery);
      let companiesList = companiesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as Company[];

      console.log('[CompanySelector] All companies found:', companiesList.length);

      if (currentCompanyId) {
        companiesList = companiesList.filter(company => company.id === currentCompanyId);
        console.log('[CompanySelector] Filtered to current company:', companiesList.length);
      }
      setCompanies(companiesList);

      const activeSubcontractors = await getSubcontractorsByMasterAccount(masterAccountId, 'Active', siteId);
      console.log('[CompanySelector] Subcontractors found:', activeSubcontractors.length);
      setSubcontractors(activeSubcontractors);

      if (companiesList.length > 0 && !value) {
        const firstCompany = companiesList[0];
        onSelect(firstCompany.alias || firstCompany.legalEntityName, firstCompany.id, 'company');
      }
    } catch (error) {
      console.error('[CompanySelector] Error loading companies and subcontractors:', error);
    } finally {
      setIsLoading(false);
    }
  }, [masterAccountId, currentCompanyId, siteId, value, onSelect]);

  useEffect(() => {
    loadCompaniesAndSubcontractors();
  }, [loadCompaniesAndSubcontractors]);

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.inputLabel}>
          <Building2 size={18} color={hasError ? "#ef4444" : "#64748b"} />
          <Text style={[styles.inputLabelText, hasError && styles.inputLabelTextError]}>
            {label}
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.selector, hasError && styles.selectorError]}
        onPress={() => setShowDropdown(!showDropdown)}
        disabled={disabled || isLoading}
      >
        <Text style={value ? styles.selectorText : styles.selectorPlaceholder}>
          {value || placeholder}
        </Text>
        <ChevronDown size={20} color="#64748b" />
      </TouchableOpacity>
      {hasError && errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView style={styles.dropdownList} nestedScrollEnabled>
            {companies.map((company) => (
              <TouchableOpacity
                key={company.id}
                style={styles.dropdownItem}
                onPress={() => {
                  onSelect(company.alias || company.legalEntityName, company.id, 'company');
                  setShowDropdown(false);
                }}
              >
                <Text style={value === (company.alias || company.legalEntityName) ? styles.dropdownItemTextSelected : styles.dropdownItemText}>
                  {company.alias || company.legalEntityName} (In-House)
                </Text>
              </TouchableOpacity>
            ))}
            {subcontractors.length > 0 && companies.length > 0 && (
              <View style={styles.divider} />
            )}
            {subcontractors.map((subcontractor) => (
              <TouchableOpacity
                key={subcontractor.id}
                style={styles.dropdownItem}
                onPress={() => {
                  onSelect(subcontractor.name, subcontractor.id || '', 'subcontractor');
                  setShowDropdown(false);
                }}
              >
                <Text style={value === subcontractor.name ? styles.dropdownItemTextSelected : styles.dropdownItemText}>
                  {subcontractor.name} (Subcontractor)
                </Text>
              </TouchableOpacity>
            ))}
            {isLoading && (
              <View style={styles.dropdownItem}>
                <ActivityIndicator size="small" color="#3b82f6" />
              </View>
            )}
            {companies.length === 0 && subcontractors.length === 0 && !isLoading && (
              <View style={styles.dropdownItem}>
                <Text style={styles.dropdownItemText}>No companies or subcontractors found</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabelText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  inputLabelTextError: {
    color: '#ef4444',
  },
  selector: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectorError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  selectorText: {
    fontSize: 15,
    color: '#1e293b',
  },
  selectorPlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: 300,
    marginTop: 8,
  },
  dropdownList: {
    maxHeight: 240,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#1e293b',
  },
  dropdownItemTextSelected: {
    fontSize: 15,
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '500' as const,
  },
});
