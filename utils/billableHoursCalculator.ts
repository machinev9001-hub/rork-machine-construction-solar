/**
 * Billable Hours Calculator
 * 
 * This utility calculates billable hours for plant assets based on:
 * - Operator's recorded start and end times (Raw Tacho Hours)
 * - Billing configuration (minimum hours for different day types)
 * - Special conditions (breakdowns, weather, etc.)
 * 
 * Billing Logic Hierarchy:
 * Priority 1: Breakdown (overrides everything)
 * Priority 2: Inclement Weather
 * Priority 3: Standard Billing (weekday/weekend minimums)
 */

export type BillingConfigForCalculation = {
  weekdays: {
    minHours: number;
  };
  saturday: {
    minHours: number;
  };
  sunday: {
    minHours: number;
  };
  publicHolidays: {
    minHours: number;
  };
  rainDays: {
    enabled: boolean;
    minHours: number;
  };
  breakdown: {
    enabled: boolean;
  };
};

export type TimesheetForBilling = {
  startTime: string | number;
  endTime: string | number;
  date: string;
  isBreakdown?: boolean;
  isRainDay?: boolean;
  isInclementWeather?: boolean;
  isPublicHoliday?: boolean;
  openHours?: string | number;
  closeHours?: string | number;
  totalHours?: number;
};

export type BillableHoursResult = {
  actualHours: number;
  billableHours: number;
  appliedRule: 'breakdown' | 'rain_day' | 'weekday' | 'saturday' | 'sunday' | 'public_holiday' | 'invalid';
  minimumApplied: number;
  notes: string;
};

/**
 * Parse time value to number of hours
 */
function parseTimeToHours(time: string | number | undefined): number {
  if (time === undefined || time === null) {
    return 0;
  }

  if (typeof time === 'number') {
    return time;
  }

  const trimmed = String(time).trim();
  if (!trimmed || trimmed === '00:00' || trimmed === '') {
    return 0;
  }

  const parsed = parseFloat(trimmed);
  if (!isNaN(parsed)) {
    return parsed;
  }

  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return hours + (minutes / 60);
    }
  }

  return 0;
}

/**
 * Calculate Raw Tacho Hours from start and end times
 */
function calculateRawHours(timesheet: TimesheetForBilling): number {
  if (timesheet.totalHours !== undefined && timesheet.totalHours > 0) {
    return timesheet.totalHours;
  }

  const startHours = parseTimeToHours(timesheet.startTime || timesheet.openHours);
  const endHours = parseTimeToHours(timesheet.endTime || timesheet.closeHours);

  if (startHours === 0 && endHours === 0) {
    return 0;
  }

  const raw = endHours - startHours;
  return raw >= 0 ? raw : 0;
}

/**
 * Get day of week from date string (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeek(dateStr: string): number {
  const date = new Date(dateStr);
  return date.getDay();
}

/**
 * Get minimum hours for a specific day type
 */
function getMinimumHoursForDay(
  dayOfWeek: number,
  isPublicHoliday: boolean,
  config: BillingConfigForCalculation
): number {
  if (isPublicHoliday) {
    return config.publicHolidays.minHours;
  }

  if (dayOfWeek === 6) {
    return config.saturday.minHours;
  }

  if (dayOfWeek === 0) {
    return config.sunday.minHours;
  }

  return config.weekdays.minHours;
}

/**
 * Get day type name for logging/display
 */
function getDayTypeName(
  dayOfWeek: number,
  isPublicHoliday: boolean
): 'weekday' | 'saturday' | 'sunday' | 'public_holiday' {
  if (isPublicHoliday) {
    return 'public_holiday';
  }

  if (dayOfWeek === 6) {
    return 'saturday';
  }

  if (dayOfWeek === 0) {
    return 'sunday';
  }

  return 'weekday';
}

/**
 * Calculate billable hours based on billing configuration and conditions
 * 
 * @param timesheet - Timesheet entry with start/end times and flags
 * @param config - Billing configuration
 * @returns Calculation result with actual hours, billable hours, and applied rule
 */
export function calculateBillableHours(
  timesheet: TimesheetForBilling,
  config: BillingConfigForCalculation
): BillableHoursResult {
  console.log('[BillableHoursCalculator] ===== Starting Calculation =====');
  console.log('[BillableHoursCalculator] Timesheet:', JSON.stringify(timesheet, null, 2));
  console.log('[BillableHoursCalculator] Config:', JSON.stringify(config, null, 2));

  // Step 1: Validate base requirements
  const rawHours = calculateRawHours(timesheet);
  
  console.log('[BillableHoursCalculator] Raw Hours calculated:', rawHours);

  if (rawHours === 0) {
    console.log('[BillableHoursCalculator] ❌ No valid time entry - returning 0 billable hours');
    return {
      actualHours: 0,
      billableHours: 0,
      appliedRule: 'invalid',
      minimumApplied: 0,
      notes: 'No valid start and end times provided',
    };
  }

  const dayOfWeek = getDayOfWeek(timesheet.date);
  const dayType = getDayTypeName(dayOfWeek, Boolean(timesheet.isPublicHoliday));
  
  console.log('[BillableHoursCalculator] Day of week:', dayOfWeek, '(' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek] + ')');
  console.log('[BillableHoursCalculator] Day type:', dayType);

  // Priority 1: Breakdown (overrides everything)
  // When breakdown is marked on a timesheet:
  // - If toggle is ENABLED: bill actual hours (end - start)
  // - If toggle is DISABLED: bill 0 (no charge)
  if (timesheet.isBreakdown) {
    console.log('[BillableHoursCalculator] ✅ Priority 1: BREAKDOWN condition detected');
    console.log('[BillableHoursCalculator] Breakdown toggle is', config.breakdown.enabled ? 'ENABLED' : 'DISABLED');
    
    if (config.breakdown.enabled) {
      console.log('[BillableHoursCalculator] Billable Hours = Actual Hours (end - start) =', rawHours);
      console.log('[BillableHoursCalculator] No minimum billing or threshold rules applied');
      
      return {
        actualHours: rawHours,
        billableHours: rawHours,
        appliedRule: 'breakdown',
        minimumApplied: 0,
        notes: 'Breakdown (enabled) - billed at actual hours (end time - start time)',
      };
    } else {
      console.log('[BillableHoursCalculator] Billable Hours = 0 (breakdown toggle disabled)');
      
      return {
        actualHours: rawHours,
        billableHours: 0,
        appliedRule: 'breakdown',
        minimumApplied: 0,
        notes: 'Breakdown (disabled) - no charge (R0)',
      };
    }
  }

  // Priority 2: Inclement Weather
  const isWeather = timesheet.isRainDay || timesheet.isInclementWeather;
  if (isWeather && config.rainDays.enabled) {
    console.log('[BillableHoursCalculator] ✅ Priority 2: INCLEMENT WEATHER condition detected');
    
    const rainMinimum = config.rainDays.minHours;
    const billableHours = Math.max(rawHours, rainMinimum);
    
    console.log('[BillableHoursCalculator] Rain day minimum hours:', rainMinimum);
    console.log('[BillableHoursCalculator] Raw Hours:', rawHours);
    console.log('[BillableHoursCalculator] Billable Hours = MAX(Raw Hours, Rain Day Minimum) =', billableHours);
    
    return {
      actualHours: rawHours,
      billableHours: billableHours,
      appliedRule: 'rain_day',
      minimumApplied: rainMinimum,
      notes: rawHours >= rainMinimum 
        ? `Rain day - raw hours (${rawHours}h) exceeds minimum (${rainMinimum}h)`
        : `Rain day - minimum hours (${rainMinimum}h) applied`,
    };
  }

  // Priority 3: Standard Billing (weekday/weekend minimums)
  console.log('[BillableHoursCalculator] ✅ Priority 3: STANDARD BILLING');
  
  const dayMinimum = getMinimumHoursForDay(dayOfWeek, Boolean(timesheet.isPublicHoliday), config);
  const billableHours = Math.max(rawHours, dayMinimum);
  
  console.log('[BillableHoursCalculator] Day minimum hours (' + dayType + '):', dayMinimum);
  console.log('[BillableHoursCalculator] Raw Hours:', rawHours);
  console.log('[BillableHoursCalculator] Billable Hours = MAX(Raw Hours, Day Minimum) =', billableHours);
  
  return {
    actualHours: rawHours,
    billableHours: billableHours,
    appliedRule: dayType,
    minimumApplied: dayMinimum,
    notes: rawHours >= dayMinimum
      ? `${dayType} - raw hours (${rawHours}h) exceeds minimum (${dayMinimum}h)`
      : `${dayType} - minimum hours (${dayMinimum}h) applied`,
  };
}

/**
 * Calculate billable hours for multiple timesheets
 */
export function calculateBillableHoursForTimesheets(
  timesheets: TimesheetForBilling[],
  config: BillingConfigForCalculation
): BillableHoursResult[] {
  console.log('[BillableHoursCalculator] Calculating billable hours for', timesheets.length, 'timesheets');
  
  return timesheets.map((timesheet, index) => {
    console.log(`[BillableHoursCalculator] Processing timesheet ${index + 1}/${timesheets.length}`);
    return calculateBillableHours(timesheet, config);
  });
}

/**
 * Get total billable hours from multiple calculation results
 */
export function getTotalBillableHours(results: BillableHoursResult[]): {
  totalActualHours: number;
  totalBillableHours: number;
} {
  const totalActualHours = results.reduce((sum, result) => sum + result.actualHours, 0);
  const totalBillableHours = results.reduce((sum, result) => sum + result.billableHours, 0);

  return {
    totalActualHours,
    totalBillableHours,
  };
}
