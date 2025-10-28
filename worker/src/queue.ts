import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config';
import { ScrapeJobData, ScrapeResult } from './types';
import { scrapeUrl } from './scraper';
import { getNextUrl, markUrlCompleted, markUrlFailed, updateJobStatus } from './supabase';

// Create Redis connection
const connection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
});

// Create BullMQ Queue
export const scrapeQueue = new Queue<ScrapeJobData>('scrape-queue', {
  connection,
  defaultJobOptions: {
    attempts: config.scraper.retryLimit,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Process a single scrape job
 */
async function processScrapeJob(job: Job<ScrapeJobData>): Promise<ScrapeResult> {
  const { queueId, pitchbookId, targetUrl, jobId } = job.data;

  console.log(`\n🔄 Processing job ${job.id} - PitchBook ID: ${pitchbookId}`);
  console.log(`   URL: ${targetUrl}`);

  try {
    // Scrape the URL
    const result = await scrapeUrl(targetUrl);

    if (result.success && result.text) {
      // Store successful result
      await markUrlCompleted(
        queueId,
        result.text,
        result.length || 0,
        result.finalUrl || targetUrl
      );

      console.log(`✅ Completed job ${job.id} - ${result.length} chars scraped`);

      // Update job progress
      await job.updateProgress(100);

      return result;
    } else {
      // Handle scraping failure
      const errorMsg = result.error || 'Scraping failed with no error message';
      await markUrlFailed(queueId, errorMsg);

      console.error(`❌ Failed job ${job.id}: ${errorMsg}`);

      throw new Error(errorMsg);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ Error processing job ${job.id}:`, errorMessage);

    // Mark as failed in database
    try {
      await markUrlFailed(queueId, errorMessage);
    } catch (dbError) {
      console.error('Failed to mark URL as failed in database:', dbError);
    }

    throw error; // Re-throw to let BullMQ handle retries
  }
}

/**
 * Create and start the worker
 */
export function createWorker(): Worker<ScrapeJobData, ScrapeResult> {
  const worker = new Worker<ScrapeJobData, ScrapeResult>(
    'scrape-queue',
    processScrapeJob,
    {
      connection,
      concurrency: config.scraper.concurrency,
      limiter: {
        max: 5, // Max 5 jobs
        duration: 1000, // Per second (rate limiting)
      },
    }
  );

  // Worker event handlers
  worker.on('completed', (job) => {
    console.log(`✅ Worker completed job ${job.id}`);
  });

  worker.on('failed', (job, error) => {
    console.error(`❌ Worker failed job ${job?.id}:`, error.message);

    // If job has exhausted all retries, update job status
    if (job && job.attemptsMade >= config.scraper.retryLimit) {
      console.log(`🚫 Job ${job.id} has exhausted all retries`);
    }
  });

  worker.on('error', (error) => {
    console.error('❌ Worker error:', error);
  });

  worker.on('active', (job) => {
    console.log(`▶️  Worker started job ${job.id}`);
  });

  console.log(`🚀 Worker started with concurrency: ${config.scraper.concurrency}`);

  return worker;
}

/**
 * Add URLs from a job to the queue
 */
export async function enqueueJobUrls(jobId: string): Promise<number> {
  let count = 0;
  let hasMore = true;

  console.log(`📥 Enqueueing URLs for job ${jobId}...`);

  // Update job status to processing
  await updateJobStatus(jobId, 'processing');

  while (hasMore) {
    const urlData = await getNextUrl(jobId);

    if (!urlData) {
      hasMore = false;
      break;
    }

    // Add to BullMQ queue
    await scrapeQueue.add(`scrape-${urlData.pitchbookId}`, urlData, {
      jobId: `${jobId}-${urlData.queueId}`, // Unique job ID
    });

    count++;

    // Limit batch size to prevent memory issues
    if (count % 100 === 0) {
      console.log(`   Enqueued ${count} URLs so far...`);
    }
  }

  console.log(`✅ Enqueued ${count} URLs for job ${jobId}`);

  // If no URLs were enqueued, mark job as completed
  if (count === 0) {
    await updateJobStatus(jobId, 'completed');
  }

  return count;
}

/**
 * Pause a job
 */
export async function pauseJob(jobId: string): Promise<void> {
  await scrapeQueue.pause();
  await updateJobStatus(jobId, 'paused');
  console.log(`⏸️  Paused job ${jobId}`);
}

/**
 * Resume a job
 */
export async function resumeJob(jobId: string): Promise<void> {
  await scrapeQueue.resume();
  await updateJobStatus(jobId, 'processing');
  console.log(`▶️  Resumed job ${jobId}`);
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<void> {
  // Remove all pending jobs for this job ID
  const jobs = await scrapeQueue.getJobs(['waiting', 'delayed']);
  const jobsToRemove = jobs.filter((job) => job.data.jobId === jobId);

  for (const job of jobsToRemove) {
    await job.remove();
  }

  await updateJobStatus(jobId, 'cancelled');
  console.log(`🚫 Cancelled job ${jobId} - removed ${jobsToRemove.length} pending jobs`);
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    scrapeQueue.getWaitingCount(),
    scrapeQueue.getActiveCount(),
    scrapeQueue.getCompletedCount(),
    scrapeQueue.getFailedCount(),
    scrapeQueue.getDelayedCount(),
    scrapeQueue.getPausedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + completed + failed + delayed + paused,
  };
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    await connection.ping();
    console.log('✅ Redis connection successful');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    return false;
  }
}
