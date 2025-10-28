// Job Types
export interface ScrapeJobData {
  queueId: number;
  pitchbookId: string;
  targetUrl: string;
  jobId: string;
}

export interface ScrapeResult {
  success: boolean;
  url: string;
  finalUrl?: string;
  text?: string;
  length?: number;
  originalLength?: number;
  headers?: Record<string, string>;
  error?: string;
}

// Database Types
export type JobStatus = 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ScrapeJob {
  id: string;
  file_name: string | null;
  user_id: string | null;
  status: JobStatus;
  total_urls: number;
  completed_urls: number;
  failed_urls: number;
  progress_percent: number;
  started_at: string | null;
  completed_at: string | null;
  estimated_completion_at: string | null;
  concurrency: number;
  retry_limit: number;
  error_message: string | null;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export interface QueueItem {
  id: number;
  job_id: string;
  pitchbook_id: string;
  source_url: string;
  target_url: string;
  status: QueueStatus;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}
