import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';
import { ScrapeJobData } from './types';

// Create Supabase client with service role key (bypasses RLS)
export const supabase: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      persistSession: false,
    },
  }
);

/**
 * Get next pending URL from the queue
 */
export async function getNextUrl(jobId: string): Promise<ScrapeJobData | null> {
  try {
    const { data, error } = await supabase.rpc('get_next_scrape_url', {
      job_uuid: jobId,
    });

    if (error) {
      console.error('Error getting next URL:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const item = data[0];
    return {
      queueId: item.queue_id,
      pitchbookId: item.pitchbook_id,
      targetUrl: item.target_url,
      jobId,
    };
  } catch (error) {
    console.error('Error in getNextUrl:', error);
    return null;
  }
}

/**
 * Mark URL as completed in the database
 */
export async function markUrlCompleted(
  queueId: number,
  scrapedText: string,
  textLength: number,
  finalUrl: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('mark_url_completed', {
      queue_id_param: queueId,
      scraped_text_param: scrapedText,
      text_length_param: textLength,
      final_url_param: finalUrl,
    });

    if (error) {
      console.error('Error marking URL as completed:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in markUrlCompleted:', error);
    throw error;
  }
}

/**
 * Mark URL as failed in the database
 */
export async function markUrlFailed(queueId: number, errorMessage: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('mark_url_failed', {
      queue_id_param: queueId,
      error_msg: errorMessage,
    });

    if (error) {
      console.error('Error marking URL as failed:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in markUrlFailed:', error);
    throw error;
  }
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  try {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'processing' && !errorMessage) {
      updateData.started_at = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('scrape_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) {
      console.error('Error updating job status:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateJobStatus:', error);
    throw error;
  }
}

/**
 * Get job details
 */
export async function getJob(jobId: string) {
  const { data, error } = await supabase
    .from('scrape_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    console.error('Error getting job:', error);
    return null;
  }

  return data;
}

/**
 * Create a new scraping job from imported CSV data
 */
export async function createJobFromFile(fileName: string) {
  try {
    // Get all companies from this file with pitchbook URLs
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, pitchbook_url')
      .eq('source_file', fileName)
      .not('pitchbook_url', 'is', null);

    if (companiesError) {
      throw companiesError;
    }

    if (!companies || companies.length === 0) {
      throw new Error(`No companies found for file: ${fileName}`);
    }

    // Create the scrape job
    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .insert({
        file_name: fileName,
        status: 'pending',
        total_urls: companies.length,
        completed_urls: 0,
        failed_urls: 0,
        progress_percent: 0,
        concurrency: 3,
        retry_limit: 3,
      })
      .select()
      .single();

    if (jobError) {
      throw jobError;
    }

    // Create queue entries for all companies
    const queueEntries = companies.map(company => ({
      job_id: job.id,
      pitchbook_id: company.pitchbook_url,
      source_url: company.pitchbook_url,
      target_url: company.pitchbook_url, // Will be transformed by scraper
      status: 'pending',
      retry_count: 0,
    }));

    const { error: queueError } = await supabase
      .from('scrape_queue')
      .insert(queueEntries);

    if (queueError) {
      // Rollback: delete the job
      await supabase.from('scrape_jobs').delete().eq('id', job.id);
      throw queueError;
    }

    return {
      jobId: job.id,
      fileName,
      totalUrls: companies.length,
    };
  } catch (error) {
    console.error('Error creating job from file:', error);
    throw error;
  }
}

/**
 * Test Supabase connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('scrape_jobs').select('id').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
}
