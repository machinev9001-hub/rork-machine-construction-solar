# Operator Timesheet Database Indexes

## Overview
This document describes the required Firebase indexes for the `operatorTimesheets` collection, which stores man hours data with categorized hours for wage calculations.

## Collection: `operatorTimesheets`

### Database Structure
Each timesheet document contains:
- Core fields: `operatorId`, `operatorName`, `date`, `masterAccountId`, `companyId`, `siteId`
- Time tracking: `startTime`, `stopTime`, `noLunchBreak`, `isSunday`, `isPublicHoliday`, `publicHolidayName`
- Categorized hours: `totalManHours`, `normalHours`, `overtimeHours`, `sundayHours`, `publicHolidayHours`
- Metadata: `status`, `notes`, `createdAt`, `updatedAt`

### Hours Categorization Logic
1. **Public Holiday Hours**: All hours worked on a public holiday (auto-detected for South Africa)
2. **Sunday Hours**: All hours worked on Sunday
3. **Normal Hours**: Up to 9 hours on a regular workday (after lunch deduction)
4. **Overtime Hours**: Hours exceeding 9 hours on a regular workday

### Required Indexes

#### 1. Operator Query by Site and Date Range
**Purpose**: Retrieve timesheets for a specific operator at a site within a date range
```
Collection: operatorTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - siteId (Ascending)
  - operatorId (Ascending)
  - date (Descending)
```

#### 2. Site-wide Timesheets Query
**Purpose**: Get all timesheets for a site, sorted by date
```
Collection: operatorTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - siteId (Ascending)
  - date (Descending)
```

#### 3. Operator Timesheets by Status
**Purpose**: Query draft or submitted timesheets for an operator
```
Collection: operatorTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - operatorId (Ascending)
  - status (Ascending)
  - date (Descending)
```

#### 4. Company-wide Wage Calculations
**Purpose**: Retrieve all timesheets for wage calculations across a company
```
Collection: operatorTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - companyId (Ascending)
  - date (Descending)
```

#### 5. Sunday Hours Tracking
**Purpose**: Query all Sunday hours for overtime calculations
```
Collection: operatorTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - siteId (Ascending)
  - isSunday (Ascending)
  - date (Descending)
```

#### 6. Public Holiday Hours Tracking
**Purpose**: Query all public holiday hours for wage calculations
```
Collection: operatorTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - siteId (Ascending)
  - isPublicHoliday (Ascending)
  - date (Descending)
```

#### 7. Operator Monthly Summary
**Purpose**: Get an operator's timesheets for a month, sorted by date
```
Collection: operatorTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - operatorId (Ascending)
  - date (Ascending)
  - createdAt (Descending)
```

## Usage Examples

### Query Operator's Weekly Hours
```typescript
const timesheets = await getDocs(
  query(
    collection(db, 'operatorTimesheets'),
    where('masterAccountId', '==', masterAccountId),
    where('operatorId', '==', operatorId),
    where('date', '>=', weekStartDate),
    where('date', '<=', weekEndDate),
    orderBy('date', 'asc')
  )
);
```

### Calculate Monthly Wages
```typescript
const timesheets = await getDocs(
  query(
    collection(db, 'operatorTimesheets'),
    where('masterAccountId', '==', masterAccountId),
    where('siteId', '==', siteId),
    where('date', '>=', monthStart),
    where('date', '<=', monthEnd),
    orderBy('date', 'desc')
  )
);

// Aggregate hours by category
let totalNormal = 0;
let totalOvertime = 0;
let totalSunday = 0;
let totalHoliday = 0;

timesheets.forEach(doc => {
  const data = doc.data();
  totalNormal += data.normalHours || 0;
  totalOvertime += data.overtimeHours || 0;
  totalSunday += data.sundayHours || 0;
  totalHoliday += data.publicHolidayHours || 0;
});
```

## Wage Calculation Rates (Example for South Africa)

Based on South African labor laws:
- **Normal Hours**: Standard hourly rate
- **Overtime**: 1.5x standard rate (first 3 hours), 2x thereafter
- **Sunday Hours**: 2x standard rate
- **Public Holiday Hours**: 2x standard rate (or 3x if also working overtime)

## Public Holiday Detection

South African public holidays are auto-detected using the `publicHolidays.ts` utility:
- New Year's Day
- Human Rights Day
- Good Friday
- Family Day
- Freedom Day
- Workers' Day
- Youth Day
- National Women's Day
- Heritage Day
- Day of Reconciliation
- Christmas Day
- Day of Goodwill

When a public holiday falls on Sunday, it's observed on Monday.

## Notes

- All dates are stored in ISO format (YYYY-MM-DD)
- Sunday detection is automatic based on the date
- Public holiday detection is automatic for South Africa
- Hours are stored with decimal precision (e.g., 9.5 hours)
- The `status` field can be 'DRAFT' or 'SUBMITTED'
- Offline submissions are queued with P0 priority for critical sync
