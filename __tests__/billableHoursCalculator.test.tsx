import { calculateBillableHours, BillingConfigForCalculation, TimesheetForBilling } from '../utils/billableHoursCalculator';

describe('Billable Hours Calculator', () => {
  const defaultConfig: BillingConfigForCalculation = {
    weekdays: { minHours: 8 },
    saturday: { minHours: 8 },
    sunday: { minHours: 8 },
    publicHolidays: { minHours: 8 },
    rainDays: { enabled: true, minHours: 4.5 },
    breakdown: { enabled: true },
  };

  describe('Priority 1: Breakdown Logic', () => {
    it('should use raw hours when breakdown flag is set (no minimums)', () => {
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: '08:00',
        endTime: '14:00',
        openHours: 8,
        closeHours: 14,
        totalHours: 6,
        isBreakdown: true,
      };

      const result = calculateBillableHours(timesheet, defaultConfig);

      expect(result.actualHours).toBe(6);
      expect(result.billableHours).toBe(6);
      expect(result.appliedRule).toBe('breakdown');
      expect(result.minimumApplied).toBe(0);
    });

    it('should charge actual raw hours even if less than minimum (breakdown)', () => {
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: '08:00',
        endTime: '10:00',
        openHours: 8,
        closeHours: 10,
        totalHours: 2,
        isBreakdown: true,
      };

      const result = calculateBillableHours(timesheet, defaultConfig);

      expect(result.actualHours).toBe(2);
      expect(result.billableHours).toBe(2);
      expect(result.appliedRule).toBe('breakdown');
    });

    it('should NOT apply breakdown if breakdown is disabled in config', () => {
      const config = { ...defaultConfig, breakdown: { enabled: false } };
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: '08:00',
        endTime: '10:00',
        openHours: 8,
        closeHours: 10,
        totalHours: 2,
        isBreakdown: true,
      };

      const result = calculateBillableHours(timesheet, config);

      expect(result.appliedRule).not.toBe('breakdown');
      expect(result.appliedRule).toBe('weekday');
      expect(result.billableHours).toBe(8);
    });
  });

  describe('Priority 2: Inclement Weather Logic', () => {
    it('should apply rain day minimum when raw hours < rain day config', () => {
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: '08:00',
        endTime: '10:00',
        openHours: 8,
        closeHours: 10,
        totalHours: 2,
        isRainDay: true,
      };

      const result = calculateBillableHours(timesheet, defaultConfig);

      expect(result.actualHours).toBe(2);
      expect(result.billableHours).toBe(4.5);
      expect(result.appliedRule).toBe('rain_day');
      expect(result.minimumApplied).toBe(4.5);
    });

    it('should use raw hours when raw hours > rain day config', () => {
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: '08:00',
        endTime: '14:00',
        openHours: 8,
        closeHours: 14,
        totalHours: 6,
        isRainDay: true,
      };

      const result = calculateBillableHours(timesheet, defaultConfig);

      expect(result.actualHours).toBe(6);
      expect(result.billableHours).toBe(6);
      expect(result.appliedRule).toBe('rain_day');
    });

    it('should recognize isInclementWeather flag', () => {
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: '08:00',
        endTime: '10:00',
        openHours: 8,
        closeHours: 10,
        totalHours: 2,
        isInclementWeather: true,
      };

      const result = calculateBillableHours(timesheet, defaultConfig);

      expect(result.appliedRule).toBe('rain_day');
      expect(result.billableHours).toBe(4.5);
    });
  });

  describe('Priority 3: Standard Billing Logic', () => {
    describe('Weekdays (Mon-Fri)', () => {
      it('should apply weekday minimum when raw < minimum', () => {
        const timesheet: TimesheetForBilling = {
          date: '2025-01-15',
          startTime: '08:00',
          endTime: '12:00',
          openHours: 8,
          closeHours: 12,
          totalHours: 4,
        };

        const result = calculateBillableHours(timesheet, defaultConfig);

        expect(result.actualHours).toBe(4);
        expect(result.billableHours).toBe(8);
        expect(result.appliedRule).toBe('weekday');
        expect(result.minimumApplied).toBe(8);
      });

      it('should use raw hours when raw > weekday minimum', () => {
        const timesheet: TimesheetForBilling = {
          date: '2025-01-15',
          startTime: '08:00',
          endTime: '18:00',
          openHours: 8,
          closeHours: 18,
          totalHours: 10,
        };

        const result = calculateBillableHours(timesheet, defaultConfig);

        expect(result.actualHours).toBe(10);
        expect(result.billableHours).toBe(10);
        expect(result.appliedRule).toBe('weekday');
      });
    });

    describe('Saturday', () => {
      it('should apply saturday minimum when raw < minimum', () => {
        const timesheet: TimesheetForBilling = {
          date: '2025-01-18',
          startTime: '08:00',
          endTime: '12:00',
          openHours: 8,
          closeHours: 12,
          totalHours: 4,
        };

        const result = calculateBillableHours(timesheet, defaultConfig);

        expect(result.actualHours).toBe(4);
        expect(result.billableHours).toBe(8);
        expect(result.appliedRule).toBe('saturday');
      });

      it('should use raw hours when raw > saturday minimum', () => {
        const timesheet: TimesheetForBilling = {
          date: '2025-01-18',
          startTime: '08:00',
          endTime: '20:00',
          openHours: 8,
          closeHours: 20,
          totalHours: 12,
        };

        const result = calculateBillableHours(timesheet, defaultConfig);

        expect(result.actualHours).toBe(12);
        expect(result.billableHours).toBe(12);
        expect(result.appliedRule).toBe('saturday');
      });
    });

    describe('Sunday', () => {
      it('should apply sunday minimum when raw < minimum', () => {
        const timesheet: TimesheetForBilling = {
          date: '2025-01-19',
          startTime: '08:00',
          endTime: '12:00',
          openHours: 8,
          closeHours: 12,
          totalHours: 4,
        };

        const result = calculateBillableHours(timesheet, defaultConfig);

        expect(result.actualHours).toBe(4);
        expect(result.billableHours).toBe(8);
        expect(result.appliedRule).toBe('sunday');
      });

      it('should use raw hours when raw > sunday minimum', () => {
        const timesheet: TimesheetForBilling = {
          date: '2025-01-19',
          startTime: '08:00',
          endTime: '20:00',
          openHours: 8,
          closeHours: 20,
          totalHours: 12,
        };

        const result = calculateBillableHours(timesheet, defaultConfig);

        expect(result.actualHours).toBe(12);
        expect(result.billableHours).toBe(12);
        expect(result.appliedRule).toBe('sunday');
      });
    });

    describe('Public Holidays', () => {
      it('should apply public holiday minimum when raw < minimum', () => {
        const timesheet: TimesheetForBilling = {
          date: '2025-01-15',
          startTime: '08:00',
          endTime: '12:00',
          openHours: 8,
          closeHours: 12,
          totalHours: 4,
          isPublicHoliday: true,
        };

        const result = calculateBillableHours(timesheet, defaultConfig);

        expect(result.actualHours).toBe(4);
        expect(result.billableHours).toBe(8);
        expect(result.appliedRule).toBe('public_holiday');
      });

      it('should use raw hours when raw > public holiday minimum', () => {
        const timesheet: TimesheetForBilling = {
          date: '2025-01-15',
          startTime: '08:00',
          endTime: '20:00',
          openHours: 8,
          closeHours: 20,
          totalHours: 12,
          isPublicHoliday: true,
        };

        const result = calculateBillableHours(timesheet, defaultConfig);

        expect(result.actualHours).toBe(12);
        expect(result.billableHours).toBe(12);
        expect(result.appliedRule).toBe('public_holiday');
      });
    });
  });

  describe('Invalid Inputs', () => {
    it('should return 0 billable hours when no time entry provided', () => {
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: '',
        endTime: '',
      };

      const result = calculateBillableHours(timesheet, defaultConfig);

      expect(result.actualHours).toBe(0);
      expect(result.billableHours).toBe(0);
      expect(result.appliedRule).toBe('invalid');
    });

    it('should return 0 billable hours when start and end are both 0', () => {
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: 0,
        endTime: 0,
      };

      const result = calculateBillableHours(timesheet, defaultConfig);

      expect(result.actualHours).toBe(0);
      expect(result.billableHours).toBe(0);
      expect(result.appliedRule).toBe('invalid');
    });
  });

  describe('Hierarchy Priority', () => {
    it('breakdown should override weather condition', () => {
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: '08:00',
        endTime: '10:00',
        openHours: 8,
        closeHours: 10,
        totalHours: 2,
        isBreakdown: true,
        isRainDay: true,
      };

      const result = calculateBillableHours(timesheet, defaultConfig);

      expect(result.appliedRule).toBe('breakdown');
      expect(result.billableHours).toBe(2);
    });

    it('breakdown should override standard billing', () => {
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: '08:00',
        endTime: '10:00',
        openHours: 8,
        closeHours: 10,
        totalHours: 2,
        isBreakdown: true,
      };

      const result = calculateBillableHours(timesheet, defaultConfig);

      expect(result.appliedRule).toBe('breakdown');
      expect(result.billableHours).toBe(2);
    });

    it('weather should override standard billing', () => {
      const timesheet: TimesheetForBilling = {
        date: '2025-01-15',
        startTime: '08:00',
        endTime: '10:00',
        openHours: 8,
        closeHours: 10,
        totalHours: 2,
        isRainDay: true,
      };

      const result = calculateBillableHours(timesheet, defaultConfig);

      expect(result.appliedRule).toBe('rain_day');
      expect(result.billableHours).toBe(4.5);
    });
  });
});
