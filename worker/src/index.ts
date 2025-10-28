import express, { Request, Response } from 'express';
import cors from 'cors';
import { config, validateConfig } from './config';
import { testConnection, getJob, supabase } from './supabase';
import {
  enqueueJobUrls,
  pauseJob,
  resumeJob,
  cancelJob,
  getQueueStats,
  testRedisConnection,
} from './queue';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const supabaseOk = await testConnection();
  const redisOk = await testRedisConnection();

  const health = {
    status: supabaseOk && redisOk ? 'healthy' : 'unhealthy',
    supabase: supabaseOk ? 'connected' : 'disconnected',
    redis: redisOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  };

  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Get queue statistics
app.get('/api/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({
      error: 'Failed to get queue statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start a new scraping job
app.post('/api/jobs/start', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    // Verify job exists
    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Enqueue URLs from the job
    const count = await enqueueJobUrls(jobId);

    res.json({
      success: true,
      jobId,
      enqueuedCount: count,
      message: `Enqueued ${count} URLs for processing`,
    });
  } catch (error) {
    console.error('Error starting job:', error);
    res.status(500).json({
      error: 'Failed to start job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get job status
app.get('/api/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = await getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({
      error: 'Failed to get job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get all jobs
app.get('/api/jobs', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error getting jobs:', error);
    res.status(500).json({
      error: 'Failed to get jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Pause a job
app.post('/api/jobs/:jobId/pause', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    await pauseJob(jobId);

    res.json({
      success: true,
      jobId,
      message: 'Job paused',
    });
  } catch (error) {
    console.error('Error pausing job:', error);
    res.status(500).json({
      error: 'Failed to pause job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Resume a job
app.post('/api/jobs/:jobId/resume', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    await resumeJob(jobId);

    res.json({
      success: true,
      jobId,
      message: 'Job resumed',
    });
  } catch (error) {
    console.error('Error resuming job:', error);
    res.status(500).json({
      error: 'Failed to resume job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Cancel a job
app.post('/api/jobs/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    await cancelJob(jobId);

    res.json({
      success: true,
      jobId,
      message: 'Job cancelled',
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get job statistics (using view)
app.get('/api/jobs/:jobId/stats', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const { data, error } = await supabase
      .from('job_statistics')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error getting job stats:', error);
    res.status(500).json({
      error: 'Failed to get job statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
async function start() {
  try {
    // Validate configuration
    validateConfig();
    console.log('✅ Configuration validated');

    // Test connections
    const [supabaseOk, redisOk] = await Promise.all([
      testConnection(),
      testRedisConnection(),
    ]);

    if (!supabaseOk || !redisOk) {
      throw new Error('Connection tests failed');
    }

    // Start listening
    app.listen(config.server.port, () => {
      console.log(`\n🚀 Worker API Server running on port ${config.server.port}`);
      console.log(`   Health check: http://localhost:${config.server.port}/health`);
      console.log(`   Environment: ${config.server.nodeEnv}`);
      console.log('\n💡 API Endpoints:');
      console.log(`   POST /api/jobs/start - Start a scraping job`);
      console.log(`   GET  /api/jobs - List all jobs`);
      console.log(`   GET  /api/jobs/:jobId - Get job details`);
      console.log(`   POST /api/jobs/:jobId/pause - Pause a job`);
      console.log(`   POST /api/jobs/:jobId/resume - Resume a job`);
      console.log(`   POST /api/jobs/:jobId/cancel - Cancel a job`);
      console.log(`   GET  /api/queue/stats - Get queue statistics`);
      console.log('\n⚠️  Note: Run the worker process separately with: npm run worker\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
start();
