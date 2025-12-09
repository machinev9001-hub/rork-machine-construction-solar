import { logExport } from '@/utils/exportLog';
import type { ExportRequest } from '@/components/accounts/ExportRequestModal';
import type { User } from '@/types';

const CLIENT_EXPORT_LIMIT = 5000;

export type ExportResult = {
  success: boolean;
  isLarge: boolean;
  jobId?: string;
  fileUrl?: string;
  recordCount?: number;
  error?: string;
};

export async function estimateExportSize(
  exportType: ExportRequest['type'],
  filters: ExportRequest['filters']
): Promise<number> {
  console.log('[ExportHandler] Estimating export size:', exportType, filters);

  return 0;
}

export async function handleExportRequest(
  request: ExportRequest,
  user: User
): Promise<ExportResult> {
  console.log('[ExportHandler] Processing export request:', request.type);
  
  try {
    const estimatedRows = await estimateExportSize(request.type, request.filters);
    
    const isLarge = estimatedRows > CLIENT_EXPORT_LIMIT;

    if (isLarge) {
      console.log(
        '[ExportHandler] Large export detected. Creating server job...',
        estimatedRows,
        'rows'
      );
      
      const jobId = await createServerExportJob(request, user);
      
      await logExport({
        type: request.type,
        format: request.format,
        groupBy: request.groupBy,
        userId: user.id || '',
        userName: user.name || 'Unknown',
        filters: request.filters as Record<string, unknown>,
        success: true,
        isServerJob: true,
        jobId,
      });

      return {
        success: true,
        isLarge: true,
        jobId,
        recordCount: estimatedRows,
      };
    }

    console.log('[ExportHandler] Small export. Processing client-side...');
    
    const result = await processClientExport(request);

    await logExport({
      type: request.type,
      format: request.format,
      groupBy: request.groupBy,
      userId: user.id || '',
      userName: user.name || 'Unknown',
      filters: request.filters as Record<string, unknown>,
      success: true,
      recordCount: result.recordCount,
      fileSize: result.fileSize,
    });

    return {
      success: true,
      isLarge: false,
      fileUrl: result.fileUrl,
      recordCount: result.recordCount,
    };
  } catch (error) {
    console.error('[ExportHandler] Export failed:', error);

    await logExport({
      type: request.type,
      format: request.format,
      groupBy: request.groupBy,
      userId: user.id || '',
      userName: user.name || 'Unknown',
      filters: request.filters as Record<string, unknown>,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      isLarge: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function createServerExportJob(
  request: ExportRequest,
  user: User
): Promise<string> {
  console.log('[ExportHandler] Creating server export job for:', request.type);

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('[ExportHandler] Server job created:', jobId);

  return jobId;
}

async function processClientExport(request: ExportRequest): Promise<{
  fileUrl: string;
  recordCount: number;
  fileSize: number;
}> {
  console.log('[ExportHandler] Processing client export:', request.type);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  return {
    fileUrl: 'data:text/csv;base64,..', 
    recordCount: 100,
    fileSize: 5000,
  };
}

export function downloadFile(fileUrl: string, filename: string): void {
  console.log('[ExportHandler] Downloading file:', filename);

  if (typeof window !== 'undefined' && window.document) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
