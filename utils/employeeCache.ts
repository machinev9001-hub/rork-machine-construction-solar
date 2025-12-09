import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, DocumentData, doc, getDoc } from 'firebase/firestore';

const EMPLOYEES_CACHE_KEY = '@cached_employees';
const EMPLOYEE_CACHE_TIMESTAMP_KEY = '@employees_cache_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedEmployee {
  id: string;
  employeeId: string;
  idNumber?: string;
  name: string;
  surname?: string;
  email?: string;
  phoneNumber?: string;
  position?: string;
  department?: string;
  siteId?: string;
  siteName?: string;
  companyId?: string;
  companyName?: string;
  linkedUserId?: string;
  linkedUserRole?: string;
  pin?: string;
  nationality?: string;
  bloodType?: string;
  emergencyContact?: string;
  emergencyContactNumber?: string;
  startDate?: string;
  endDate?: string;
  profileImageUrl?: string;
  status?: string;
  createdAt?: any;
  updatedAt?: any;
  checklistItems?: any[];
  inductionCompleted?: boolean;
  inductionDate?: string;
  inductionExpiryDate?: string;
  safetyTraining?: boolean;
  medicalClearance?: boolean;
  ppeClearance?: boolean;
}

export async function precacheEmployees(siteId?: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log('[EmployeeCache] Pre-caching employees for siteId:', siteId || 'all');
    
    const employeesRef = collection(db, 'employees');
    const employeesQuery = siteId 
      ? query(employeesRef, where('siteId', '==', siteId))
      : employeesRef;
    
    const snapshot = await getDocs(employeesQuery);
    
    const employees: CachedEmployee[] = [];
    snapshot.forEach(doc => {
      const data = doc.data() as DocumentData;
      employees.push({
        id: doc.id,
        employeeId: data.employeeId || doc.id,
        idNumber: data.idNumber,
        name: data.name || '',
        surname: data.surname,
        email: data.email,
        phoneNumber: data.phoneNumber,
        position: data.position,
        department: data.department,
        siteId: data.siteId,
        siteName: data.siteName,
        companyId: data.companyId,
        companyName: data.companyName,
        linkedUserId: data.linkedUserId,
        linkedUserRole: data.linkedUserRole,
        pin: data.pin,
        nationality: data.nationality,
        bloodType: data.bloodType,
        emergencyContact: data.emergencyContact,
        emergencyContactNumber: data.emergencyContactNumber,
        startDate: data.startDate,
        endDate: data.endDate,
        profileImageUrl: data.profileImageUrl,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        checklistItems: data.checklistItems,
        inductionCompleted: data.inductionCompleted,
        inductionDate: data.inductionDate,
        inductionExpiryDate: data.inductionExpiryDate,
        safetyTraining: data.safetyTraining,
        medicalClearance: data.medicalClearance,
        ppeClearance: data.ppeClearance,
      });
    });
    
    await AsyncStorage.setItem(EMPLOYEES_CACHE_KEY, JSON.stringify(employees));
    await AsyncStorage.setItem(EMPLOYEE_CACHE_TIMESTAMP_KEY, Date.now().toString());
    
    console.log('[EmployeeCache] Successfully cached', employees.length, 'employees');
    return { success: true, count: employees.length };
  } catch (error: any) {
    console.error('[EmployeeCache] Error pre-caching employees:', error);
    return { success: false, count: 0, error: error.message };
  }
}

export async function getCachedEmployees(): Promise<CachedEmployee[]> {
  try {
    const cached = await AsyncStorage.getItem(EMPLOYEES_CACHE_KEY);
    if (!cached) {
      console.log('[EmployeeCache] No cached employees found');
      return [];
    }
    
    const employees: CachedEmployee[] = JSON.parse(cached);
    console.log('[EmployeeCache] Retrieved', employees.length, 'cached employees');
    return employees;
  } catch (error) {
    console.error('[EmployeeCache] Error retrieving cached employees:', error);
    return [];
  }
}

export async function getCachedEmployeeById(employeeId: string): Promise<CachedEmployee | null> {
  try {
    const normalizedId = employeeId.trim().toLowerCase();
    const employees = await getCachedEmployees();
    
    const employee = employees.find((emp) => {
      const matchById = emp.id.toLowerCase() === normalizedId;
      const matchByEmployeeId = emp.employeeId?.toLowerCase() === normalizedId;
      const matchByIdNumber = emp.idNumber?.toLowerCase() === normalizedId;
      
      return matchById || matchByEmployeeId || matchByIdNumber;
    });
    
    if (employee) {
      console.log('[EmployeeCache] Found cached employee:', employeeId);
      return employee;
    }
    
    console.log('[EmployeeCache] Employee not found in cache:', employeeId);
    return null;
  } catch (error) {
    console.error('[EmployeeCache] Error finding cached employee:', error);
    return null;
  }
}

export async function getCachedEmployeeWithUser(employeeId: string): Promise<{ 
  employee: CachedEmployee | null; 
  user: any | null 
}> {
  try {
    const employee = await getCachedEmployeeById(employeeId);
    if (!employee) {
      return { employee: null, user: null };
    }

    if (employee.linkedUserId) {
      // Try to get the linked user from cache first
      const { getCachedUserById } = await import('./userCache');
      const user = await getCachedUserById(employee.linkedUserId);
      
      if (user) {
        return { employee, user };
      }
    }

    return { employee, user: null };
  } catch (error) {
    console.error('[EmployeeCache] Error getting employee with user:', error);
    return { employee: null, user: null };
  }
}

export async function updateCachedEmployee(employeeId: string, updates: Partial<CachedEmployee>): Promise<void> {
  try {
    const employees = await getCachedEmployees();
    const index = employees.findIndex(emp => 
      emp.id === employeeId || 
      emp.employeeId === employeeId || 
      emp.idNumber === employeeId
    );
    
    if (index !== -1) {
      employees[index] = { ...employees[index], ...updates };
      await AsyncStorage.setItem(EMPLOYEES_CACHE_KEY, JSON.stringify(employees));
      console.log('[EmployeeCache] Updated cached employee:', employeeId);
    }
  } catch (error) {
    console.error('[EmployeeCache] Error updating cached employee:', error);
  }
}

export async function getCacheAge(): Promise<{ age: number; isStale: boolean; formatted: string }> {
  try {
    const timestamp = await AsyncStorage.getItem(EMPLOYEE_CACHE_TIMESTAMP_KEY);
    
    if (!timestamp) {
      return { age: 0, isStale: true, formatted: 'Never cached' };
    }
    
    const age = Date.now() - parseInt(timestamp);
    const isStale = age > CACHE_DURATION;
    
    const hours = Math.floor(age / (60 * 60 * 1000));
    const minutes = Math.floor((age % (60 * 60 * 1000)) / (60 * 1000));
    
    let formatted = '';
    if (hours > 0) {
      formatted = `${hours}h ${minutes}m ago`;
    } else {
      formatted = `${minutes}m ago`;
    }
    
    return { age, isStale, formatted };
  } catch (error) {
    console.error('[EmployeeCache] Error getting cache age:', error);
    return { age: 0, isStale: true, formatted: 'Unknown' };
  }
}

export async function clearEmployeeCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EMPLOYEES_CACHE_KEY);
    await AsyncStorage.removeItem(EMPLOYEE_CACHE_TIMESTAMP_KEY);
    console.log('[EmployeeCache] Cache cleared');
  } catch (error) {
    console.error('[EmployeeCache] Error clearing cache:', error);
  }
}

export async function shouldRefreshCache(): Promise<boolean> {
  const { isStale } = await getCacheAge();
  return isStale;
}

// Helper function to sync employee cache with online data
export async function syncEmployeeCache(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[EmployeeCache] Starting cache sync...');
    const siteId = await AsyncStorage.getItem('@current_site_id');
    const result = await precacheEmployees(siteId || undefined);
    return result;
  } catch (error: any) {
    console.error('[EmployeeCache] Error syncing cache:', error);
    return { success: false, error: error.message };
  }
}

// Function to handle offline QR scan for HR/Master users
export async function handleOfflineEmployeeAccess(
  employeeId: string,
  currentUserRole?: string
): Promise<{
  success: boolean;
  employee?: CachedEmployee;
  user?: any;
  error?: string;
}> {
  try {
    // Check if current user has permission (HR or Master)
    if (currentUserRole !== 'master' && currentUserRole !== 'HSE' && currentUserRole !== 'HR') {
      return { 
        success: false, 
        error: 'You do not have permission to access employee information offline' 
      };
    }

    // Get employee from cache
    const { employee, user } = await getCachedEmployeeWithUser(employeeId);
    
    if (!employee) {
      return { 
        success: false, 
        error: 'Employee not found in offline cache. Please sync data when online.' 
      };
    }

    return { success: true, employee, user };
  } catch (error: any) {
    console.error('[EmployeeCache] Error handling offline access:', error);
    return { success: false, error: error.message };
  }
}