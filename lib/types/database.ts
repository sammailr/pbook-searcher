// Database types generated from Supabase schema
// This provides full type safety for all database operations

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: number;
          pitchbook_id: string;
          person_name: string | null;
          person_first_name: string | null;
          person_last_name: string | null;
          person_profile_url: string | null;
          person_title: string | null;
          company_name: string | null;
          company_url: string | null;
          email: string | null;
          phone: string | null;
          linkedin_url: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
          source_file: string | null;
          source_row_number: number | null;
          imported_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          pitchbook_id: string;
          person_name?: string | null;
          person_first_name?: string | null;
          person_last_name?: string | null;
          person_profile_url?: string | null;
          person_title?: string | null;
          company_name?: string | null;
          company_url?: string | null;
          email?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          source_file?: string | null;
          source_row_number?: number | null;
          imported_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          pitchbook_id?: string;
          person_name?: string | null;
          person_first_name?: string | null;
          person_last_name?: string | null;
          person_profile_url?: string | null;
          person_title?: string | null;
          company_name?: string | null;
          company_url?: string | null;
          email?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          source_file?: string | null;
          source_row_number?: number | null;
          imported_at?: string;
          updated_at?: string;
        };
      };
      scrape_jobs: {
        Row: {
          id: string;
          file_name: string | null;
          user_id: string | null;
          status: 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
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
        };
        Insert: {
          id?: string;
          file_name?: string | null;
          user_id?: string | null;
          status?: 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
          total_urls?: number;
          completed_urls?: number;
          failed_urls?: number;
          progress_percent?: number;
          started_at?: string | null;
          completed_at?: string | null;
          estimated_completion_at?: string | null;
          concurrency?: number;
          retry_limit?: number;
          error_message?: string | null;
          error_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          file_name?: string | null;
          user_id?: string | null;
          status?: 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
          total_urls?: number;
          completed_urls?: number;
          failed_urls?: number;
          progress_percent?: number;
          started_at?: string | null;
          completed_at?: string | null;
          estimated_completion_at?: string | null;
          concurrency?: number;
          retry_limit?: number;
          error_message?: string | null;
          error_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      scrape_queue: {
        Row: {
          id: number;
          job_id: string;
          pitchbook_id: string;
          source_url: string;
          target_url: string;
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
          retry_count: number;
          error_message: string | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: number;
          job_id: string;
          pitchbook_id: string;
          source_url: string;
          target_url: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
          retry_count?: number;
          error_message?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: number;
          job_id?: string;
          pitchbook_id?: string;
          source_url?: string;
          target_url?: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
          retry_count?: number;
          error_message?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
      scraped_data: {
        Row: {
          id: number;
          job_id: string;
          company_id: number | null;
          pitchbook_id: string;
          url: string;
          final_url: string | null;
          scraped_text: string | null;
          text_length: number | null;
          original_length: number | null;
          success: boolean;
          headers: Json | null;
          error_message: string | null;
          scraped_at: string;
        };
        Insert: {
          id?: number;
          job_id: string;
          company_id?: number | null;
          pitchbook_id: string;
          url: string;
          final_url?: string | null;
          scraped_text?: string | null;
          text_length?: number | null;
          original_length?: number | null;
          success?: boolean;
          headers?: Json | null;
          error_message?: string | null;
          scraped_at?: string;
        };
        Update: {
          id?: number;
          job_id?: string;
          company_id?: number | null;
          pitchbook_id?: string;
          url?: string;
          final_url?: string | null;
          scraped_text?: string | null;
          text_length?: number | null;
          original_length?: number | null;
          success?: boolean;
          headers?: Json | null;
          error_message?: string | null;
          scraped_at?: string;
        };
      };
    };
    Views: {
      companies_with_scrape_status: {
        Row: {
          id: number;
          pitchbook_id: string;
          person_name: string | null;
          person_first_name: string | null;
          person_last_name: string | null;
          person_profile_url: string | null;
          person_title: string | null;
          company_name: string | null;
          company_url: string | null;
          email: string | null;
          phone: string | null;
          linkedin_url: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
          source_file: string | null;
          source_row_number: number | null;
          imported_at: string;
          updated_at: string;
          is_scraped: boolean;
          scraped_at: string | null;
          text_length: number | null;
          scraped_text: string | null;
        };
      };
      job_statistics: {
        Row: {
          id: string;
          file_name: string | null;
          status: string;
          total_urls: number;
          completed_urls: number;
          failed_urls: number;
          progress_percent: number;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          duration_seconds: number | null;
          estimated_seconds_remaining: number | null;
        };
      };
    };
    Functions: {
      update_job_progress: {
        Args: { job_uuid: string };
        Returns: void;
      };
      get_next_scrape_url: {
        Args: { job_uuid: string };
        Returns: {
          queue_id: number;
          pitchbook_id: string;
          target_url: string;
        }[];
      };
      mark_url_completed: {
        Args: {
          queue_id_param: number;
          scraped_text_param: string;
          text_length_param: number;
          final_url_param: string;
        };
        Returns: void;
      };
      mark_url_failed: {
        Args: {
          queue_id_param: number;
          error_msg: string;
        };
        Returns: void;
      };
    };
  };
}
