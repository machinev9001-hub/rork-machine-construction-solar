import * as MailComposer from 'expo-mail-composer';
import { Platform, Alert } from 'react-native';

export async function sendEPHToSubcontractor(params: {
  recipientEmail: string;
  message: string;
  pdfUri: string;
  pdfFileName: string;
  subcontractorName: string;
  dateRange: { from: Date; to: Date };
  assetCount: number;
  totalHours: number;
  companyName: string;
}): Promise<void> {
  console.log('[ephEmailService] Sending EPH to subcontractor:', params.recipientEmail);
  
  const { recipientEmail, message, pdfUri, pdfFileName, subcontractorName, dateRange, assetCount, totalHours, companyName } = params;
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
  
  const subject = `EPH Report for Review - ${formatDate(dateRange.from)} to ${formatDate(dateRange.to)} - ${subcontractorName}`;
  
  const body = `Dear ${subcontractorName},

Please find attached the Equipment/Plant Hours (EPH) report for the period ${formatDate(dateRange.from)} to ${formatDate(dateRange.to)}.

Assets Included: ${assetCount}
Total Hours: ${totalHours.toFixed(1)}h

${message ? `\n${message}\n\n` : ''}Please review the hours and respond with any corrections or approval.

Thank you,
${companyName}`;
  
  if (Platform.OS === 'web') {
    console.log('[ephEmailService] Web platform - opening email composer simulation');
    Alert.alert(
      'Email Composer',
      `Would open email to:\n${recipientEmail}\n\nSubject: ${subject}\n\nWith PDF attachment: ${pdfFileName}\n\nThis is a simulation on web. On mobile, this would open your email client.`,
      [{ text: 'OK' }]
    );
    return;
  }
  
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Email composer not available on this device');
  }
  
  await MailComposer.composeAsync({
    recipients: [recipientEmail],
    subject,
    body,
    attachments: [pdfUri],
  });
  
  console.log('[ephEmailService] Email composer opened successfully');
}

export async function sendAgreementConfirmationToSubcontractor(params: {
  recipientEmail: string;
  subcontractorName: string;
  dateRange: { from: Date; to: Date };
  assetCount: number;
  totalHours: number;
  agreedBy: string;
  companyName: string;
}): Promise<void> {
  console.log('[ephEmailService] Sending agreement confirmation:', params.recipientEmail);
  
  const { recipientEmail, subcontractorName, dateRange, assetCount, totalHours, agreedBy, companyName } = params;
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
  
  const subject = `EPH Agreement Confirmed - ${formatDate(dateRange.from)} to ${formatDate(dateRange.to)}`;
  
  const body = `Dear ${subcontractorName},

This confirms that the Equipment/Plant Hours (EPH) report for the period ${formatDate(dateRange.from)} to ${formatDate(dateRange.to)} has been finalized and agreed.

Assets: ${assetCount}
Total Hours: ${totalHours.toFixed(1)}h
Agreed By: ${agreedBy}
Date: ${formatDate(new Date())}

The agreed timesheets are now ready for payment processing.

Thank you,
${companyName}`;
  
  if (Platform.OS === 'web') {
    console.log('[ephEmailService] Web platform - showing confirmation');
    Alert.alert(
      'Agreement Confirmation',
      `Would send confirmation email to:\n${recipientEmail}\n\nSubject: ${subject}`,
      [{ text: 'OK' }]
    );
    return;
  }
  
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    console.log('[ephEmailService] Email not available, skipping confirmation email');
    return;
  }
  
  await MailComposer.composeAsync({
    recipients: [recipientEmail],
    subject,
    body,
  });
  
  console.log('[ephEmailService] Confirmation email opened successfully');
}
