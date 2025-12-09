export interface PublicHoliday {
  name: string;
  date: string;
  observedDate?: string;
}

export const getSouthAfricanPublicHolidays = (year: number): PublicHoliday[] => {
  const holidays: PublicHoliday[] = [
    { name: "New Year's Day", date: `${year}-01-01` },
    { name: "Human Rights Day", date: `${year}-03-21` },
    { name: "Good Friday", date: getGoodFriday(year) },
    { name: "Family Day", date: getFamilyDay(year) },
    { name: "Freedom Day", date: `${year}-04-27` },
    { name: "Workers' Day", date: `${year}-05-01` },
    { name: "Youth Day", date: `${year}-06-16` },
    { name: "National Women's Day", date: `${year}-08-09` },
    { name: "Heritage Day", date: `${year}-09-24` },
    { name: "Day of Reconciliation", date: `${year}-12-16` },
    { name: "Christmas Day", date: `${year}-12-25` },
    { name: "Day of Goodwill", date: `${year}-12-26` },
  ];

  const processedHolidays = holidays.map(holiday => {
    const date = new Date(holiday.date);
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 0) {
      const observedDate = new Date(date);
      observedDate.setDate(observedDate.getDate() + 1);
      return {
        ...holiday,
        observedDate: observedDate.toISOString().split('T')[0]
      };
    }
    
    return holiday;
  });

  return processedHolidays;
};

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}

function getGoodFriday(year: number): string {
  const easter = getEasterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  return goodFriday.toISOString().split('T')[0];
}

function getFamilyDay(year: number): string {
  const easter = getEasterSunday(year);
  const familyDay = new Date(easter);
  familyDay.setDate(easter.getDate() + 1);
  return familyDay.toISOString().split('T')[0];
}

export const isPublicHoliday = (date: Date, country: string = 'South Africa'): { isHoliday: boolean; holidayName?: string } => {
  if (country !== 'South Africa') {
    return { isHoliday: false };
  }

  const dateStr = date.toISOString().split('T')[0];
  const year = date.getFullYear();
  const holidays = getSouthAfricanPublicHolidays(year);

  for (const holiday of holidays) {
    if (holiday.date === dateStr || holiday.observedDate === dateStr) {
      return { isHoliday: true, holidayName: holiday.name };
    }
  }

  return { isHoliday: false };
};

export const isSunday = (date: Date): boolean => {
  return date.getDay() === 0;
};
