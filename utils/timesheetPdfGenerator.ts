import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';
import { Platform, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';

type VerifiedTimesheet = {
  id: string;
  date: string;
  operatorName: string;
  operatorId: string;
  verified: boolean;
  verifiedAt: string;
  verifiedBy: string;
  masterAccountId: string;
  siteId: string;
  type: 'plant_hours' | 'man_hours';
  
  openHours?: number;
  closeHours?: number;
  totalHours?: number;
  isBreakdown?: boolean;
  inclementWeather?: boolean;
  hasAttachment?: boolean;
  isRainDay?: boolean;
  isStrikeDay?: boolean;
  isPublicHoliday?: boolean;
  notes?: string;
  
  assetId?: string;
  assetType?: string;
  plantNumber?: string;
  registrationNumber?: string;
  ownerId?: string;
  ownerType?: string;
  ownerName?: string;
  
  startTime?: string;
  stopTime?: string;
  totalManHours?: number;
  normalHours?: number;
  overtimeHours?: number;
  sundayHours?: number;
  publicHolidayHours?: number;
  noLunchBreak?: boolean;
  
  hasOriginalEntry?: boolean;
  originalEntryData?: any;
  isAdjustment?: boolean;
  originalEntryId?: string;
  adjustedBy?: string;
  adjustedAt?: string;
  
  agreedHours?: number;
  agreedNormalHours?: number;
  agreedOvertimeHours?: number;
  agreedSundayHours?: number;
  agreedPublicHolidayHours?: number;
  agreedBy?: string;
  agreedAt?: string;
  agreedNotes?: string;
  hasAgreedEntry?: boolean;
};

type TimesheetGroup = {
  key: string;
  title: string;
  subtitle: string;
  entries: VerifiedTimesheet[];
  dateGroups: {
    date: string;
    originalEntry?: VerifiedTimesheet;
    adjustmentEntry?: VerifiedTimesheet;
    agreedEntry?: VerifiedTimesheet;
  }[];
};

type ReportOptions = {
  groups: TimesheetGroup[];
  reportType: 'plant' | 'man';
  subcontractorName?: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  selectedOnly?: boolean;
  selectedGroups?: Set<string>;
};

const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const generatePlantHoursHTML = (groups: TimesheetGroup[], options: ReportOptions): string => {
  const filteredGroups = options.selectedOnly && options.selectedGroups
    ? groups.filter(g => options.selectedGroups!.has(g.key))
    : groups;

  const formatStatusIcons = (e: any) => {
    const icons = [];
    if (e.isBreakdown) icons.push('🔧');
    if (e.isRainDay || e.inclementWeather) icons.push('🌧️');
    if (e.isStrikeDay) icons.push('⚠️');
    if (e.isPublicHoliday) icons.push('🎉');
    return icons.length > 0 ? icons.join(' ') : '-';
  };

  const rows = filteredGroups.map(group => {
    const assetRows = group.dateGroups.map(dateGroup => {
      const entry = dateGroup.adjustmentEntry || dateGroup.originalEntry;
      if (!entry) return '';

      const hasAdjustment = dateGroup.originalEntry && dateGroup.adjustmentEntry;
      const originalEntry = dateGroup.originalEntry;
      const adjustedEntry = dateGroup.adjustmentEntry;

      return `
        ${hasAdjustment ? `
          <tr style="background-color: #fff3cd;">
            <td style="padding: 8px; border: 1px solid #dee2e6;">${formatDate(originalEntry!.date)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${group.title}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${group.subtitle}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${originalEntry!.operatorName}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${originalEntry!.openHours || 0}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${originalEntry!.closeHours || 0}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right; font-weight: bold;">${originalEntry!.totalHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${formatStatusIcons(originalEntry)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; font-size: 10px;">${originalEntry!.notes || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">
              <span style="background-color: #6c757d; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">ORIG</span>
            </td>
          </tr>
          <tr style="background-color: #d1ecf1;">
            <td style="padding: 8px; border: 1px solid #dee2e6;">${formatDate(adjustedEntry!.date)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${group.title}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${group.subtitle}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${adjustedEntry!.operatorName}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${adjustedEntry!.openHours || 0}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${adjustedEntry!.closeHours || 0}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right; font-weight: bold;">${adjustedEntry!.totalHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${formatStatusIcons(adjustedEntry)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; font-size: 10px;">${adjustedEntry!.notes || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">
              <span style="background-color: #0d6efd; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">PM</span>
            </td>
          </tr>
        ` : `
          <tr>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${formatDate(entry.date)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${group.title}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${group.subtitle}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${entry.operatorName}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${entry.openHours || 0}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${entry.closeHours || 0}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right; font-weight: bold;">${entry.totalHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${formatStatusIcons(entry)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; font-size: 10px;">${entry.notes || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">-</td>
          </tr>
        `}
      `;
    }).join('');

    return assetRows;
  }).join('');

  const totalHours = filteredGroups.reduce((sum, group) => {
    return sum + group.dateGroups.reduce((groupSum, dateGroup) => {
      const entry = dateGroup.adjustmentEntry || dateGroup.originalEntry;
      return groupSum + (entry?.totalHours || 0);
    }, 0);
  }, 0);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #212529;
            margin: 20px;
          }
          h1 {
            font-size: 22px;
            margin-bottom: 10px;
            color: #1e3a8a;
          }
          .meta {
            font-size: 11px;
            color: #6c757d;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 10px;
          }
          th {
            background-color: #1e3a8a;
            color: white;
            padding: 8px 6px;
            text-align: left;
            border: 1px solid #dee2e6;
            font-weight: 600;
            font-size: 10px;
          }
          td {
            padding: 6px;
            border: 1px solid #dee2e6;
          }
          .summary {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .summary-label {
            font-weight: 600;
          }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #dee2e6;
            font-size: 10px;
            color: #6c757d;
          }
        </style>
      </head>
      <body>
        <h1>Plant Hours Timesheet Report</h1>
        <div class="meta">
          ${options.subcontractorName ? `<p><strong>Subcontractor:</strong> ${options.subcontractorName}</p>` : ''}
          <p><strong>Date Range:</strong> ${formatDate(options.dateRange.from)} to ${formatDate(options.dateRange.to)}</p>
          <p><strong>Report Generated:</strong> ${formatDate(new Date())}</p>
          ${options.selectedOnly ? '<p><strong>Report Type:</strong> Selected Assets Only</p>' : '<p><strong>Report Type:</strong> All Assets</p>'}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset Type</th>
              <th>Asset Number</th>
              <th>Operator</th>
              <th style="text-align: right;">Open</th>
              <th style="text-align: right;">Close</th>
              <th style="text-align: right;">Hours</th>
              <th style="text-align: center;">Status</th>
              <th>Notes</th>
              <th style="text-align: center;">Type</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row">
            <span class="summary-label">Total Assets:</span>
            <span>${filteredGroups.length}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Total Days:</span>
            <span>${filteredGroups.reduce((sum, g) => sum + g.dateGroups.length, 0)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Total Hours:</span>
            <span><strong>${totalHours.toFixed(1)} hours</strong></span>
          </div>
        </div>

        <div class="footer">
          <p>This report was automatically generated from the approved billing timesheets.</p>
          <p><strong>Legend:</strong> ORIG = Operator Original Entry, PM = Plant Manager Adjusted Entry</p>
          <p><strong>Status Icons:</strong> 🔧 = Breakdown, 🌧️ = Rain Day, ⚠️ = Strike Day, 🎉 = Public Holiday</p>
        </div>
      </body>
    </html>
  `;
};

const generateManHoursHTML = (groups: TimesheetGroup[], options: ReportOptions): string => {
  const filteredGroups = options.selectedOnly && options.selectedGroups
    ? groups.filter(g => options.selectedGroups!.has(g.key))
    : groups;

  const rows = filteredGroups.map(group => {
    const operatorRows = group.dateGroups.map(dateGroup => {
      const entry = dateGroup.adjustmentEntry || dateGroup.originalEntry;
      if (!entry) return '';

      const hasAdjustment = dateGroup.originalEntry && dateGroup.adjustmentEntry;
      const originalEntry = dateGroup.originalEntry;
      const adjustedEntry = dateGroup.adjustmentEntry;

      return `
        ${hasAdjustment ? `
          <tr style="background-color: #fff3cd;">
            <td style="padding: 8px; border: 1px solid #dee2e6;">${formatDate(originalEntry!.date)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${group.title}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${originalEntry!.startTime || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${originalEntry!.stopTime || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right; font-weight: bold;">${originalEntry!.totalManHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${originalEntry!.normalHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${originalEntry!.overtimeHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${originalEntry!.sundayHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${originalEntry!.publicHolidayHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">
              <span style="background-color: #6c757d; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">ORIG</span>
            </td>
          </tr>
          <tr style="background-color: #d1ecf1;">
            <td style="padding: 8px; border: 1px solid #dee2e6;">${formatDate(adjustedEntry!.date)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${group.title}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${adjustedEntry!.startTime || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${adjustedEntry!.stopTime || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right; font-weight: bold;">${adjustedEntry!.totalManHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${adjustedEntry!.normalHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${adjustedEntry!.overtimeHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${adjustedEntry!.sundayHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${adjustedEntry!.publicHolidayHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">
              <span style="background-color: #0d6efd; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">PM</span>
            </td>
          </tr>
        ` : `
          <tr>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${formatDate(entry.date)}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${group.title}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${entry.startTime || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6;">${entry.stopTime || '-'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right; font-weight: bold;">${entry.totalManHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${entry.normalHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${entry.overtimeHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${entry.sundayHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${entry.publicHolidayHours?.toFixed(1) || '0.0'}</td>
            <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">-</td>
          </tr>
        `}
      `;
    }).join('');

    return operatorRows;
  }).join('');

  const totals = filteredGroups.reduce((sum, group) => {
    const groupTotals = group.dateGroups.reduce((gSum, dateGroup) => {
      const entry = dateGroup.adjustmentEntry || dateGroup.originalEntry;
      return {
        total: gSum.total + (entry?.totalManHours || 0),
        normal: gSum.normal + (entry?.normalHours || 0),
        overtime: gSum.overtime + (entry?.overtimeHours || 0),
        sunday: gSum.sunday + (entry?.sundayHours || 0),
        publicHoliday: gSum.publicHoliday + (entry?.publicHolidayHours || 0),
      };
    }, { total: 0, normal: 0, overtime: 0, sunday: 0, publicHoliday: 0 });
    
    return {
      total: sum.total + groupTotals.total,
      normal: sum.normal + groupTotals.normal,
      overtime: sum.overtime + groupTotals.overtime,
      sunday: sum.sunday + groupTotals.sunday,
      publicHoliday: sum.publicHoliday + groupTotals.publicHoliday,
    };
  }, { total: 0, normal: 0, overtime: 0, sunday: 0, publicHoliday: 0 });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #212529;
            margin: 20px;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 10px;
            color: #1e3a8a;
          }
          .meta {
            font-size: 12px;
            color: #6c757d;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background-color: #1e3a8a;
            color: white;
            padding: 10px 8px;
            text-align: left;
            border: 1px solid #dee2e6;
            font-weight: 600;
          }
          td {
            padding: 8px;
            border: 1px solid #dee2e6;
          }
          .summary {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .summary-label {
            font-weight: 600;
          }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #dee2e6;
            font-size: 10px;
            color: #6c757d;
          }
        </style>
      </head>
      <body>
        <h1>Man Hours Timesheet Report</h1>
        <div class="meta">
          ${options.subcontractorName ? `<p><strong>Subcontractor:</strong> ${options.subcontractorName}</p>` : ''}
          <p><strong>Date Range:</strong> ${formatDate(options.dateRange.from)} to ${formatDate(options.dateRange.to)}</p>
          <p><strong>Report Generated:</strong> ${formatDate(new Date())}</p>
          ${options.selectedOnly ? '<p><strong>Report Type:</strong> Selected Operators Only</p>' : '<p><strong>Report Type:</strong> All Operators</p>'}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Operator</th>
              <th>Start Time</th>
              <th>Stop Time</th>
              <th style="text-align: right;">Total</th>
              <th style="text-align: right;">Normal</th>
              <th style="text-align: right;">Overtime</th>
              <th style="text-align: right;">Sunday</th>
              <th style="text-align: right;">Public Holiday</th>
              <th style="text-align: center;">Type</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row">
            <span class="summary-label">Total Operators:</span>
            <span>${filteredGroups.length}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Total Days:</span>
            <span>${filteredGroups.reduce((sum, g) => sum + g.dateGroups.length, 0)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Total Hours:</span>
            <span><strong>${totals.total.toFixed(1)} hours</strong></span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Normal Hours:</span>
            <span>${totals.normal.toFixed(1)} hours</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Overtime Hours:</span>
            <span>${totals.overtime.toFixed(1)} hours</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Sunday Hours:</span>
            <span>${totals.sunday.toFixed(1)} hours</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Public Holiday Hours:</span>
            <span>${totals.publicHoliday.toFixed(1)} hours</span>
          </div>
        </div>

        <div class="footer">
          <p>This report was automatically generated from the approved billing timesheets.</p>
          <p><strong>Legend:</strong> ORIG = Operator Original Entry, PM = Plant Manager Adjusted Entry</p>
        </div>
      </body>
    </html>
  `;
};

export async function generateTimesheetPDF(options: ReportOptions): Promise<{ uri: string; fileName: string }> {
  console.log('[timesheetPdfGenerator] Generating PDF report:', options.reportType);
  
  try {
    const html = options.reportType === 'plant' 
      ? generatePlantHoursHTML(options.groups, options)
      : generateManHoursHTML(options.groups, options);

    const fileName = `${options.reportType}_hours_report_${formatDate(new Date()).replace(/\s/g, '_')}.pdf`;

    if (Platform.OS === 'web') {
      console.log('[timesheetPdfGenerator] Web platform - creating data URI from HTML');
      const blob = new Blob([html], { type: 'text/html' });
      const uri = URL.createObjectURL(blob);
      console.log('[timesheetPdfGenerator] HTML blob created for web:', uri);
      return { uri, fileName: fileName.replace('.pdf', '.html') };
    }

    console.log('[timesheetPdfGenerator] Native platform - generating PDF');
    const result = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (!result || !result.uri) {
      console.error('[timesheetPdfGenerator] Print.printToFileAsync returned invalid result:', result);
      throw new Error('PDF generation failed - no URI returned');
    }

    console.log('[timesheetPdfGenerator] PDF generated successfully:', result.uri);

    return { uri: result.uri, fileName };
  } catch (error) {
    console.error('[timesheetPdfGenerator] Error generating PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
}

export async function emailTimesheetPDF(
  pdfUri: string,
  fileName: string,
  options: {
    recipientEmail?: string;
    subject?: string;
    body?: string;
  } = {}
): Promise<void> {
  console.log('[timesheetPdfGenerator] Preparing email with PDF attachment');

  try {
    const isAvailable = await MailComposer.isAvailableAsync();
    
    if (!isAvailable) {
      Alert.alert(
        'Email Not Available',
        Platform.OS === 'web' 
          ? 'Email functionality is not available in web browsers. Please download the PDF and send it manually.'
          : 'Email is not configured on this device. Please download the PDF and send it manually.'
      );
      return;
    }

    const defaultSubject = `Timesheet Report - ${formatDate(new Date())}`;
    const defaultBody = `Please find attached the timesheet report.\n\nGenerated on: ${formatDate(new Date())}`;

    await MailComposer.composeAsync({
      recipients: options.recipientEmail ? [options.recipientEmail] : [],
      subject: options.subject || defaultSubject,
      body: options.body || defaultBody,
      attachments: [pdfUri],
    });

    console.log('[timesheetPdfGenerator] Email composer opened successfully');
  } catch (error) {
    console.error('[timesheetPdfGenerator] Error opening email composer:', error);
    Alert.alert('Error', 'Failed to open email composer. Please try downloading the PDF instead.');
  }
}

export async function downloadTimesheetPDF(pdfUri: string, fileName: string): Promise<void> {
  console.log('[timesheetPdfGenerator] Downloading/Sharing file:', fileName);
  console.log('[timesheetPdfGenerator] URI:', pdfUri);
  console.log('[timesheetPdfGenerator] Platform:', Platform.OS);

  try {
    if (Platform.OS === 'web') {
      console.log('[timesheetPdfGenerator] Opening file in new window for web');
      const newWindow = window.open(pdfUri, '_blank');
      if (newWindow) {
        newWindow.focus();
        Alert.alert(
          'Report Generated',
          'The timesheet report has been opened in a new window. You can print it to PDF using your browser\'s print function (Ctrl/Cmd + P).'
        );
      } else {
        Alert.alert(
          'Popup Blocked',
          'Please allow popups for this site to view the report, or check your downloads folder.'
        );
      }
    } else {
      console.log('[timesheetPdfGenerator] Sharing PDF on native platform');
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(pdfUri, {
          UTI: 'application/pdf',
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share PDF',
        });
        console.log('[timesheetPdfGenerator] PDF shared successfully');
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    }
  } catch (error) {
    console.error('[timesheetPdfGenerator] Error downloading/sharing:', error);
    Alert.alert('Error', 'Failed to open or share the report. Please try again.');
  }
}
