# PitchBook Scraper Worker

Background worker service for scraping PitchBook company profiles at scale using BullMQ and Supabase.

## Overview

This worker service:
- Processes 100,000+ URLs from Supabase queue
- Calls Cloudflare Worker scraper API
- Stores results back to Supabase
- Provides REST API for job management
- Handles retries and rate limiting
- Runs on Render (or any Node.js hosting)

## Architecture

```
Frontend → Supabase → Worker API → BullMQ → Worker Process → Scraper API
                          ↓           ↓            ↓              ↓
                       Express     Redis      Job Processor   Cloudflare
```

## Setup

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your credentials:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (Render provides this automatically)
REDIS_URL=redis://localhost:6379

# Scraper
SCRAPER_API_URL=https://website-scraper.samuel-5af.workers.dev/
SCRAPER_CONCURRENCY=3
SCRAPER_RETRY_LIMIT=3
SCRAPER_TIMEOUT=30000

# Server
PORT=3001
NODE_ENV=development
```

### 3. Run Locally

You need to run **two processes**:

**Terminal 1 - API Server:**
```bash
npm run dev
```

**Terminal 2 - Worker Process:**
```bash
npm run worker
```

The API server provides endpoints for job management, while the worker process actually scrapes URLs.

## API Endpoints

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "supabase": "connected",
  "redis": "connected",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Start a Job
```bash
POST /api/jobs/start
Content-Type: application/json

{
  "jobId": "uuid-of-job-from-supabase"
}
```

Response:
```json
{
  "success": true,
  "jobId": "uuid",
  "enqueuedCount": 1250,
  "message": "Enqueued 1250 URLs for processing"
}
```

### Get Job Status
```bash
GET /api/jobs/:jobId
```

Response:
```json
{
  "id": "uuid",
  "status": "processing",
  "total_urls": 1250,
  "completed_urls": 342,
  "failed_urls": 5,
  "progress_percent": 27.76,
  "started_at": "2024-01-01T00:00:00.000Z",
  "estimated_completion_at": "2024-01-01T02:00:00.000Z"
}
```

### Pause/Resume/Cancel Job
```bash
POST /api/jobs/:jobId/pause
POST /api/jobs/:jobId/resume
POST /api/jobs/:jobId/cancel
```

### Get Queue Statistics
```bash
GET /api/queue/stats
```

Response:
```json
{
  "waiting": 1200,
  "active": 3,
  "completed": 342,
  "failed": 5,
  "delayed": 0,
  "paused": 0,
  "total": 1550
}
```

### List All Jobs
```bash
GET /api/jobs
```

Returns last 50 jobs, newest first.

## Deployment to Render

### Prerequisites
- Render account (https://render.com)
- Supabase project set up
- Code pushed to GitHub

### Step 1: Create Redis Instance

1. Go to Render Dashboard
2. Click "New" → "Redis"
3. Choose plan:
   - Free tier: Good for testing (25MB)
   - Starter: $7/month (256MB, recommended for production)
4. Name it `pitchbook-redis`
5. Click "Create Redis"
6. Copy the **Internal Redis URL** (looks like `redis://red-xxxxx:6379`)

### Step 2: Create Web Service (API)

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `pitchbook-worker-api`
   - **Region**: Same as your Supabase region
   - **Branch**: `main`
   - **Root Directory**: `worker`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Starter ($7/month)

4. Add Environment Variables:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-key
   REDIS_URL=redis://red-xxxxx:6379  (from Step 1)
   SCRAPER_API_URL=https://website-scraper.samuel-5af.workers.dev/
   SCRAPER_CONCURRENCY=3
   SCRAPER_RETRY_LIMIT=3
   SCRAPER_TIMEOUT=30000
   PORT=3001
   NODE_ENV=production
   ```

5. Click "Create Web Service"

### Step 3: Create Background Worker

1. Click "New" → "Background Worker"
2. Connect same GitHub repository
3. Configure:
   - **Name**: `pitchbook-worker-process`
   - **Region**: Same as API
   - **Branch**: `main`
   - **Root Directory**: `worker`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run worker`
   - **Plan**: Starter ($7/month)

4. Add same environment variables as API

5. Click "Create Background Worker"

### Step 4: Verify Deployment

1. Go to your API service URL: `https://pitchbook-worker-api.onrender.com/health`
2. Should see:
   ```json
   {
     "status": "healthy",
     "supabase": "connected",
     "redis": "connected"
   }
   ```

3. Check worker logs for:
   ```
   ✅ Worker is running and processing jobs
   ```

### Step 5: Update Frontend

In your frontend `.env.local`:
```env
NEXT_PUBLIC_WORKER_API_URL=https://pitchbook-worker-api.onrender.com
```

## How It Works

### 1. Job Creation

User imports CSV to Supabase, which creates:
- `companies` records with data
- `scrape_jobs` record with job metadata
- `scrape_queue` records for each URL

### 2. Job Start

Frontend calls `POST /api/jobs/start` with job ID:
- API reads URLs from `scrape_queue`
- Adds each URL to BullMQ queue
- Updates job status to "processing"

### 3. URL Processing

Worker process picks up jobs from queue:
1. Gets URL from BullMQ
2. Calls Cloudflare scraper API
3. Receives scraped text (10,000 chars)
4. Stores result in `scraped_data` table
5. Updates `scrape_queue` status
6. Updates job progress

### 4. Rate Limiting

- Concurrency: 3 workers running in parallel
- Rate limit: 5 requests per second
- Retries: 3 attempts with exponential backoff
- Timeout: 30 seconds per request

### 5. Error Handling

If scraping fails:
- Retry up to 3 times
- Update `scrape_queue` with retry count
- If all retries fail, mark as "failed"
- Job continues processing other URLs

### 6. Job Completion

When all URLs are processed:
- Update job status to "completed"
- Calculate final statistics
- Keep completed jobs for 24 hours in Redis
- Keep failed jobs for 7 days

## Monitoring

### Check Queue Stats
```bash
curl https://your-worker-api.onrender.com/api/queue/stats
```

### Check Specific Job
```bash
curl https://your-worker-api.onrender.com/api/jobs/YOUR_JOB_ID
```

### View Logs

**Render Dashboard:**
- Go to service
- Click "Logs" tab
- Filter by severity

**Look for:**
- ✅ Completed jobs
- ❌ Failed jobs
- 🔄 Processing status
- ⚠️ Errors and retries

## Scaling

### Performance Tuning

**For faster processing:**
```env
SCRAPER_CONCURRENCY=5  # Increase parallel workers
```

**For more reliability:**
```env
SCRAPER_RETRY_LIMIT=5  # More retry attempts
SCRAPER_TIMEOUT=60000  # Longer timeout
```

### Render Plans

**Free Tier:**
- ❌ Not recommended (sleeps after 15 min)

**Starter ($7/month each):**
- ✅ Good for up to 10,000 URLs/day
- 512 MB RAM
- Always on

**Standard ($25/month each):**
- ✅ Recommended for 100,000+ URLs
- 2 GB RAM
- Faster processing

### Multiple Workers

For very large jobs, run multiple worker processes:

1. Create additional Background Workers on Render
2. All connect to same Redis and Supabase
3. BullMQ automatically distributes work
4. Linear scaling: 2 workers = 2x throughput

## Troubleshooting

### Worker Not Processing Jobs

**Check:**
1. Worker process is running (`npm run worker`)
2. Redis connection is working
3. Supabase connection is working
4. Check worker logs for errors

**Fix:**
```bash
# Restart worker
npm run worker

# Check health
curl http://localhost:3001/health
```

### High Failure Rate

**Check:**
1. Scraper API is responding
2. URLs are valid
3. Timeout is not too short

**Fix:**
```env
SCRAPER_TIMEOUT=60000  # Increase timeout
SCRAPER_RETRY_LIMIT=5  # More retries
```

### Slow Processing

**Check:**
1. Concurrency setting
2. Redis performance
3. Scraper API response time

**Fix:**
```env
SCRAPER_CONCURRENCY=5  # Increase workers
```

### Out of Memory

**Symptoms:**
- Worker crashes
- "JavaScript heap out of memory"

**Fix:**
1. Upgrade Render plan to more RAM
2. Reduce concurrency
3. Add memory limit:
   ```json
   "start": "node --max-old-space-size=512 dist/index.js"
   ```

## Cost Estimate

For 100,000 URLs:

**Render Services:**
- API Service (Starter): $7/month
- Worker Process (Starter): $7/month
- Redis (Starter): $7/month
- **Total: $21/month**

**Supabase:**
- Free tier: Up to 500 MB
- Pro tier: $25/month (8 GB)

**Processing Time:**
- At 3 concurrent workers: ~9-10 hours
- At 5 concurrent workers: ~5-6 hours

## Security

### API Keys

- ✅ Service role key only in backend (Render)
- ❌ Never expose in frontend
- ✅ Use environment variables
- ✅ Never commit to git

### CORS

Configured in `src/index.ts`:
```typescript
app.use(cors()); // Allows all origins (dev)
```

For production, restrict to your domain:
```typescript
app.use(cors({
  origin: 'https://your-frontend.vercel.app'
}));
```

### Rate Limiting

Built-in via BullMQ limiter:
- 5 jobs per second
- Prevents overwhelming scraper API
- Prevents IP bans

## Development

### Project Structure
```
worker/
├── src/
│   ├── config.ts       # Configuration management
│   ├── types.ts        # TypeScript types
│   ├── supabase.ts     # Supabase client
│   ├── scraper.ts      # Scraper API client
│   ├── queue.ts        # BullMQ queue setup
│   ├── worker.ts       # Worker process
│   └── index.ts        # Express API server
├── dist/               # Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json
└── .env               # Environment variables (gitignored)
```

### Testing Locally

1. Install Redis locally:
   ```bash
   brew install redis  # macOS
   redis-server        # Start Redis
   ```

2. Run services:
   ```bash
   # Terminal 1
   npm run dev

   # Terminal 2
   npm run worker
   ```

3. Test endpoints:
   ```bash
   curl http://localhost:3001/health
   ```

## Support

- Worker Issues: Check logs in Render dashboard
- Supabase Issues: Check Supabase logs
- Redis Issues: Check Render Redis metrics
- API Issues: Check Express logs

---

**Worker service ready for 100,000+ URL scraping!** 🚀
