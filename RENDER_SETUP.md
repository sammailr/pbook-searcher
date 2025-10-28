# Complete Render Deployment Guide - A to Z

This guide will walk you through deploying the PitchBook scraper worker to Render, step by step. No prior knowledge assumed!

---

## Table of Contents

1. [What You'll Need](#what-youll-need)
2. [Understanding the Architecture](#understanding-the-architecture)
3. [Step 1: Push Code to GitHub](#step-1-push-code-to-github)
4. [Step 2: Create Render Account](#step-2-create-render-account)
5. [Step 3: Create Redis Database](#step-3-create-redis-database)
6. [Step 4: Deploy API Service](#step-4-deploy-api-service)
7. [Step 5: Deploy Worker Process](#step-5-deploy-worker-process)
8. [Step 6: Test Deployment](#step-6-test-deployment)
9. [Step 7: Connect Frontend](#step-7-connect-frontend)
10. [Troubleshooting](#troubleshooting)
11. [Cost Breakdown](#cost-breakdown)

---

## What You'll Need

Before starting, make sure you have:

- ✅ **Supabase project** set up (see `SUPABASE_SETUP.md`)
- ✅ **Supabase Service Role Key** (from Supabase dashboard)
- ✅ **GitHub account** (free)
- ✅ **Render account** (we'll create this)
- ✅ **Credit card** (for Render paid services - $21/month total)
- ✅ **Code repository** with the worker folder

**Time Required:** 30-45 minutes

---

## Understanding the Architecture

Before we start, let's understand what we're building and **how the three services work together:**

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (Vercel/Local)                                   │
│         ↓                                                   │
│  Supabase Database ← → API Service (Render Web Service)    │
│                              ↓                               │
│                    Key Value = Redis (Render)               │
│                              ↓                               │
│                 Worker Process (Render Background Worker)   │
│                              ↓                               │
│                  Cloudflare Scraper API                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### The Three Services Explained

**1. Key Value (Redis) - The Job Queue Storage**
- **What it is:** In-memory database that stores the queue of URLs to scrape
- **What it does:** Holds thousands of "jobs" (URLs waiting to be scraped)
- **Think of it as:** A kitchen order board showing all pending orders
- **Cost:** $7/month

**2. Web Service (API) - The Controller**
- **What it is:** HTTP server that responds to your requests
- **What it does:**
  - Receives your "start scraping" command
  - Creates jobs and puts them in Redis queue
  - Lets you check progress and control jobs (pause/resume/cancel)
- **Think of it as:** A waiter who takes your order and checks on your food
- **Cost:** $7/month

**3. Background Worker - The Scraper**
- **What it is:** Process that runs 24/7 in the background
- **What it does:**
  - Constantly checks Redis: "Any jobs for me?"
  - Takes jobs from queue (3 at a time by default)
  - Calls Cloudflare scraper API for each URL
  - Saves results to Supabase
  - Marks job as done and gets next one
- **Think of it as:** A chef who cooks orders from the board
- **Cost:** $7/month

### How They Work Together (Example)

**Scenario:** You want to scrape 1,000 company profiles

1. **You (Frontend):** Click "Start Scraping" → sends HTTP request to Web Service
2. **Web Service:**
   - Receives your request
   - Queries Supabase for the 1,000 URLs
   - Creates 1,000 individual jobs
   - Pushes all jobs to Key Value (Redis)
   - Responds to you: "✅ Started! 1,000 jobs queued"
3. **Key Value (Redis):**
   - Now stores 1,000 jobs in queue
   - Status: 1,000 waiting, 0 active
4. **Background Worker:**
   - Asks Redis: "Give me a job"
   - Redis gives it Job #1
   - Worker scrapes the URL via Cloudflare API
   - Worker saves result to Supabase
   - Worker marks Job #1 as completed in Redis
   - Worker immediately asks: "Give me another job"
   - Repeat for all 1,000 jobs
5. **You check progress:**
   - Ask Web Service: "How's it going?"
   - Web Service asks Redis for stats
   - Web Service responds: "750 waiting, 3 active, 247 completed"

**Key Point:** All three services run simultaneously and independently. Web Service and Worker both connect to the same Redis to coordinate.

### Visual Communication Flow

```
YOU                    WEB SERVICE              KEY VALUE (REDIS)         BACKGROUND WORKER
│                           │                          │                          │
│──"Start scraping"────────▶│                          │                          │
│                           │                          │                          │
│                           │──"Add 1000 jobs"────────▶│                          │
│                           │                          │                          │
│◀──"Started! Job ID"───────│                          │                          │
│                           │                          │                          │
│                           │                          │◀───"Give me a job"───────│
│                           │                          │                          │
│                           │                          │───"Here's Job #1"───────▶│
│                           │                          │                          │
│                           │                          │                          │───scrapes URL────▶ Cloudflare
│                           │                          │                          │                         │
│                           │                          │                          │◀───scraped text─────────│
│                           │                          │                          │                         │
│                           │                          │                          │───saves to Supabase────▶
│                           │                          │                          │                         │
│                           │                          │◀───"Job #1 done"─────────│
│                           │                          │                          │
│                           │                          │───"Here's Job #2"───────▶│
│                           │                          │                          │
│──"Check status"──────────▶│                          │                          │
│                           │                          │                          │
│                           │──"How many left?"───────▶│                          │
│                           │                          │                          │
│                           │◀──"998 waiting"──────────│                          │
│                           │                          │                          │
│◀──"998 pending"───────────│                          │                          │
│                           │                          │                          │
│                           │    (stays running)       │    (stays running)       │    (keeps working)
│                           │                          │                          │
```

**Important Notes:**
- Web Service **never scrapes** - it just manages jobs and reports status
- Key Value **never scrapes** - it just stores the queue
- Background Worker **does all the scraping** - it's the only one calling Cloudflare API
- All three must run **simultaneously** for the system to work

---

### What We're Deploying to Render

1. ✅ **Key Value** - Redis/Valkey for job queue (Step 3)
2. ✅ **Web Service** - HTTP API for job management (Step 4)
3. ✅ **Background Worker** - Scraping process (Step 5)

All three work together to scrape 100,000+ URLs efficiently.

---

## Step 1: Push Code to GitHub

### Why?
Render deploys directly from GitHub, so we need your code there first.

### Instructions:

**1.1 Create a new GitHub repository**

1. Go to https://github.com
2. Click the **"+"** icon (top right) → **"New repository"**
3. Fill in:
   - **Repository name:** `pitchbook-scraper`
   - **Description:** `PitchBook data organizer and scraper`
   - **Visibility:** Private (recommended) or Public
   - **DO NOT** check "Add a README file" (we have one)
4. Click **"Create repository"**

**1.2 Push your code**

Open your terminal in the project root directory and run:

```bash
# Navigate to your project
cd /Users/samuelsaid/Downloads/pitchbook-searcher/csv-organizer

# Initialize git if not already done
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit - PitchBook scraper"

# Add your GitHub repository as remote
# Replace YOUR_USERNAME with your actual GitHub username
git remote add origin https://github.com/YOUR_USERNAME/pitchbook-scraper.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**1.3 Verify upload**

1. Go to your GitHub repository page
2. You should see all your files including the `worker/` folder
3. ✅ Confirm `worker/src/index.ts` exists

**Troubleshooting:**
- If you get "permission denied", you may need to set up a GitHub Personal Access Token
- Go to GitHub Settings → Developer Settings → Personal Access Tokens → Generate new token
- Use the token as your password when pushing

---

## Step 2: Create Render Account

### Instructions:

**2.1 Sign up**

1. Go to https://render.com
2. Click **"Get Started"** or **"Sign Up"**
3. Choose sign-up method:
   - **Recommended:** Sign up with GitHub (easiest)
   - Alternative: Sign up with email
4. If using GitHub, click **"Authorize Render"**
5. Complete profile information

**2.2 Add payment method**

1. After signing up, you'll see the Render Dashboard
2. Click your profile icon (top right) → **"Account Settings"**
3. Click **"Billing"** in the left sidebar
4. Click **"Add Payment Method"**
5. Enter your credit card details
6. Click **"Add Card"**

**Note:** Render will charge $21/month for the services we're about to create. No free tier works for production scraping.

**2.3 Verify account**

1. You should see "Render Dashboard" with a "New +" button
2. ✅ You're ready to create services!

---

## Step 3: Create Redis Database (Key Value Store)

Redis is the message queue that coordinates scraping jobs between the API and worker.

**Note:** Render calls this service **"Key Value"** (not "Redis" anymore - they use Valkey, an open-source Redis fork).

### Instructions:

**3.1 Start Key Value creation**

1. From Render Dashboard, click **"New +"** button (top right)
2. Select **"Key Value"** (this is Redis/Valkey)
3. You'll see "Create a Key Value Instance" page

**3.2 Configure Key Value Store**

Fill in the form:

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `pitchbook-redis` | Any name is fine |
| **Region** | Choose same as your Supabase | For best performance |
| **Plan** | **Starter - $7/month** | 256 MB, perfect for our needs |
| **Maxmemory Policy** | `allkeys-lru` | Default is fine |

**3.3 Create Key Value Instance**

1. Review settings
2. Click **"Create Key Value"** button (bottom)
3. Wait 1-2 minutes while Render provisions the instance
4. You'll see a green "Available" status when ready

**3.4 Get Redis connection URL**

1. Click on your `pitchbook-redis` instance (or whatever you named it)
2. Find the **"Connections"** section
3. You'll see two URLs:
   - **External Redis URL** - starts with `redis://red-...`
   - **Internal Redis URL** - starts with `redis://red-...:6379`
4. **COPY** the **Internal Redis URL** (we'll use this in Step 4)

Example: `redis://red-abc123xyz:6379`

**3.5 Test connection (optional)**

1. Scroll down to **"Info"** tab
2. You should see:
   - Connected clients: 0
   - Used memory: ~1 MB
   - Total commands: 0
3. ✅ Redis is ready!

**Troubleshooting:**
- If status shows "Creating" for more than 5 minutes, refresh the page
- If it fails, delete and try again with a different name

---

## Step 4: Deploy API Service

The API service handles HTTP requests from your frontend to start/stop/monitor scraping jobs.

### Instructions:

**4.1 Start service creation**

1. Click **"New +"** button (top right)
2. Select **"Web Service"**
3. You'll see "Create a new Web Service" page

**4.2 Connect GitHub repository**

1. If this is your first time:
   - Click **"Connect account"** next to GitHub
   - Click **"Install Render"** in the popup
   - Select your repositories (or "All repositories")
   - Click **"Install"**
2. You'll see a list of your repositories
3. Find **"pitchbook-scraper"** and click **"Connect"**

**4.3 Configure API service**

Fill in these settings carefully:

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `pitchbook-worker-api` | This becomes your URL |
| **Region** | Same as Redis/Supabase | Oregon, Ohio, Frankfurt, etc. |
| **Branch** | `main` | Or whatever branch has your code |
| **Root Directory** | `worker` | ⚠️ IMPORTANT - must be exactly `worker` |
| **Runtime** | `Node` | Should auto-detect |
| **Build Command** | `npm install && npm run build` | Compiles TypeScript |
| **Start Command** | `npm start` | Runs the API server |
| **Instance Type** | **Starter - $7/month** | 512 MB RAM |

**4.4 Add environment variables**

Scroll down to **"Environment Variables"** section.

Click **"Add Environment Variable"** for each of these:

**Variable 1:**
- **Key:** `SUPABASE_URL`
- **Value:** Your Supabase project URL
  - Get from: Supabase Dashboard → Settings → API → Project URL
  - Example: `https://abcdefgh.supabase.co`

**Variable 2:**
- **Key:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** Your Supabase service role key
  - Get from: Supabase Dashboard → Settings → API → Service Role Key (secret)
  - ⚠️ This is the SECRET key, NOT the anon key
  - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...` (very long)

**Variable 3:**
- **Key:** `REDIS_URL`
- **Value:** The Internal Redis URL you copied from Step 3.4
  - Example: `redis://red-abc123xyz:6379`

**Variable 4:**
- **Key:** `SCRAPER_API_URL`
- **Value:** `https://website-scraper.samuel-5af.workers.dev/`

**Variable 5:**
- **Key:** `SCRAPER_CONCURRENCY`
- **Value:** `3`

**Variable 6:**
- **Key:** `SCRAPER_RETRY_LIMIT`
- **Value:** `3`

**Variable 7:**
- **Key:** `SCRAPER_TIMEOUT`
- **Value:** `30000`

**Variable 8:**
- **Key:** `PORT`
- **Value:** `3001`

**Variable 9:**
- **Key:** `NODE_ENV`
- **Value:** `production`

**4.5 Review and deploy**

1. Double-check all environment variables are correct
2. Scroll to bottom
3. Click **"Create Web Service"** button
4. Render will start building and deploying (5-10 minutes)

**4.6 Monitor deployment**

You'll see a logs screen. Watch for:

```
==> Building...
==> Installing dependencies...
==> Running build command...
==> Build successful!
==> Starting service...
✅ Configuration validated
✅ Supabase connection successful
✅ Redis connection successful
🚀 Worker API Server running on port 3001
```

**4.7 Test API is working**

1. Once you see "Deploy succeeded", click on the service name at top
2. Find **"Your service is live at"** with a URL like:
   - `https://pitchbook-worker-api.onrender.com`
3. **COPY THIS URL** - you'll need it later
4. Open in browser: `https://pitchbook-worker-api.onrender.com/health`
5. You should see:
   ```json
   {
     "status": "healthy",
     "supabase": "connected",
     "redis": "connected",
     "timestamp": "2024-01-01T00:00:00.000Z"
   }
   ```
6. ✅ API is working!

**Troubleshooting:**
- **"Build failed"**: Check Build Command is exactly `npm install && npm run build`
- **"Connection failed"**: Check environment variables are correct (no extra spaces)
- **"Unhealthy"**: Check Supabase and Redis URLs are correct
- **"Module not found"**: Check Root Directory is set to `worker`

---

## Step 5: Deploy Worker Process

The worker process runs in the background, actually scraping URLs from the queue.

### Instructions:

**5.1 Start worker creation**

1. Click **"New +"** button (top right)
2. This time, select **"Background Worker"** (not Web Service!)
3. You'll see "Create a new Background Worker" page

**5.2 Connect repository**

1. Find **"pitchbook-scraper"** again
2. Click **"Connect"**

**5.3 Configure worker**

Fill in these settings:

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `pitchbook-worker-process` | Descriptive name |
| **Region** | Same as API/Redis | MUST be same region |
| **Branch** | `main` | Same branch as API |
| **Root Directory** | `worker` | ⚠️ IMPORTANT - same as API |
| **Runtime** | `Node` | Should auto-detect |
| **Build Command** | `npm install && npm run build` | Same as API |
| **Start Command** | `node dist/worker.js` | ⚠️ Different from API! |
| **Instance Type** | **Starter - $7/month** | 512 MB RAM |

**5.4 Add environment variables**

Add the **EXACT SAME** environment variables as Step 4.4:

1. `SUPABASE_URL` - Your Supabase URL
2. `SUPABASE_SERVICE_ROLE_KEY` - Your service role key
3. `REDIS_URL` - The Redis URL from Step 3.4
4. `SCRAPER_API_URL` - `https://website-scraper.samuel-5af.workers.dev/`
5. `SCRAPER_CONCURRENCY` - `3`
6. `SCRAPER_RETRY_LIMIT` - `3`
7. `SCRAPER_TIMEOUT` - `30000`
8. `NODE_ENV` - `production`

**Note:** We DON'T need `PORT` for the worker (it doesn't serve HTTP)

**5.5 Create worker**

1. Review all settings
2. Click **"Create Background Worker"**
3. Wait for deployment (5-10 minutes)

**5.6 Verify worker is running**

Watch the logs for:

```
==> Building...
==> Build successful!
==> Starting worker...
🚀 Starting PitchBook Scraper Worker...
✅ Configuration validated
✅ Supabase connection successful
✅ Redis connection successful
🚀 Worker started with concurrency: 3
✅ Worker is running and processing jobs
💡 Press Ctrl+C to stop
```

**5.7 Test worker**

1. Go back to **Render Dashboard**
2. Click on **"pitchbook-worker-process"**
3. Check the **"Events"** tab - should show "Service started"
4. Check the **"Logs"** tab - should show worker is running
5. ✅ Worker is ready!

**Troubleshooting:**
- **"Command not found"**: Check Start Command is `node dist/worker.js`
- **"Cannot find module"**: Check Root Directory is `worker` and Build Command ran
- **"Connection failed"**: Check REDIS_URL matches what you used in API service
- **Worker keeps restarting**: Check logs for error messages, verify all env vars

---

## Step 6: Test Deployment

Now let's test that everything works together!

### Instructions:

**6.1 Test API health**

1. Open your API URL in browser:
   - `https://pitchbook-worker-api.onrender.com/health`
2. Should return:
   ```json
   {
     "status": "healthy",
     "supabase": "connected",
     "redis": "connected"
   }
   ```

**6.2 Test from command line**

Open terminal and run:

```bash
# Replace with YOUR actual API URL
curl https://pitchbook-worker-api.onrender.com/health
```

Should return the same healthy status.

**6.3 Test queue stats**

```bash
curl https://pitchbook-worker-api.onrender.com/api/queue/stats
```

Should return:
```json
{
  "waiting": 0,
  "active": 0,
  "completed": 0,
  "failed": 0,
  "delayed": 0,
  "paused": 0,
  "total": 0
}
```

**6.4 Test with a real job (optional)**

If you've already imported data to Supabase:

```bash
# Get job ID from Supabase (scrape_jobs table)
# Replace JOB_ID with actual UUID
curl -X POST https://pitchbook-worker-api.onrender.com/api/jobs/start \
  -H "Content-Type: application/json" \
  -d '{"jobId": "YOUR_JOB_ID_HERE"}'
```

Should return:
```json
{
  "success": true,
  "jobId": "...",
  "enqueuedCount": 100,
  "message": "Enqueued 100 URLs for processing"
}
```

Then check worker logs to see it processing!

**6.5 Verify in Render Dashboard**

1. Go to **Redis** instance → should show connected clients: 2 (API + Worker)
2. Go to **API Service** → Logs should be quiet (only responds to requests)
3. Go to **Worker Process** → Logs should show "Worker is running"

✅ **Everything is deployed and working!**

---

## Step 7: Connect Frontend

Now connect your Next.js frontend to the deployed worker.

### Instructions:

**7.1 Update frontend environment**

1. Open your frontend project
2. Edit `.env.local` file
3. Add/update this line:
   ```env
   NEXT_PUBLIC_WORKER_API_URL=https://pitchbook-worker-api.onrender.com
   ```
   (Replace with YOUR actual API URL from Step 4.7)

**7.2 Restart frontend**

```bash
# Stop the dev server (Ctrl+C)
# Start it again
npm run dev
```

**7.3 Test from frontend**

1. Open http://localhost:3000
2. Upload a CSV file
3. Go to **"Import to Supabase"** tab
4. Import your file
5. Once imported, the scraping UI should be able to connect to your worker!

**7.4 Deploy frontend (optional)**

If you want to deploy your frontend to Vercel:

1. Push your code to GitHub (including the `.env.local` changes)
2. Go to https://vercel.com
3. Import your GitHub repository
4. Add environment variable:
   - `NEXT_PUBLIC_WORKER_API_URL` = your Render API URL
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
5. Deploy!

---

## Troubleshooting

### Problem: API shows "unhealthy"

**Solution:**
1. Check Render API Service logs
2. Look for specific error messages
3. Common causes:
   - Wrong Supabase URL or key
   - Wrong Redis URL
   - Network issue (temporary - wait a few minutes)

**Fix:**
1. Go to API Service → "Environment" tab
2. Click "Edit" next to wrong variable
3. Update and save
4. Service will automatically redeploy

---

### Problem: Worker not processing jobs

**Symptoms:**
- API successfully enqueues jobs
- But nothing happens
- Worker logs show "Worker is running" but no activity

**Solution:**
1. Check both API and Worker are using the **same** Redis URL
2. Check Worker logs for any error messages
3. Try manual restart:
   - Go to Worker service
   - Click "Manual Deploy" → "Clear build cache & deploy"

---

### Problem: "Module not found" errors

**Symptoms:**
- Build succeeds but start fails
- Error: `Cannot find module 'dist/index.js'`

**Solution:**
1. Check Root Directory is set to `worker` (not empty, not `./worker`)
2. Check Build Command includes `npm run build`
3. Check `tsconfig.json` exists in `worker/` folder
4. Try manual redeploy with cache clear

---

### Problem: High memory usage / crashes

**Symptoms:**
- Service keeps restarting
- "Out of memory" errors
- Slow processing

**Solution:**
1. Reduce concurrency:
   - Edit environment variable `SCRAPER_CONCURRENCY` to `2` or `1`
2. Upgrade to Standard plan ($25/month, 2GB RAM):
   - Go to service → "Settings" → "Instance Type"
   - Select "Standard"
   - Save

---

### Problem: Rate limit errors from scraper

**Symptoms:**
- Many failed jobs
- Error messages mention rate limiting
- Scraper API returns 429 errors

**Solution:**
1. Reduce rate:
   - Edit `SCRAPER_CONCURRENCY` to `2`
2. Increase timeout:
   - Edit `SCRAPER_TIMEOUT` to `60000` (60 seconds)
3. Wait and retry failed jobs

---

### Problem: "Connection timeout" errors

**Symptoms:**
- Jobs fail with timeout errors
- Scraper API not responding

**Solution:**
1. Check Cloudflare Worker is running: https://website-scraper.samuel-5af.workers.dev/
2. Increase timeout: `SCRAPER_TIMEOUT` to `60000`
3. Check if specific URLs are problematic (view Supabase `scrape_queue` table)

---

### Problem: Services sleeping / slow first request

**Symptoms:**
- Health check takes 30+ seconds first time
- Services show "Sleeping" status

**Cause:**
- Free tier services sleep after 15 minutes of inactivity
- Paid Starter/Standard plans do NOT sleep

**Solution:**
- You're already on paid plans, so this shouldn't happen
- If it does, contact Render support

---

## Cost Breakdown

Here's what you'll pay monthly:

| Service | Plan | Cost | What For |
|---------|------|------|----------|
| Redis | Starter | $7/month | Message queue |
| API Service | Starter | $7/month | HTTP endpoints |
| Worker Process | Starter | $7/month | Background scraping |
| **Total** | | **$21/month** | |

**Plus Supabase (optional upgrade):**
- Free tier: $0/month (up to 500 MB database)
- Pro tier: $25/month (for 100k+ companies)

**Total for full stack: $21-46/month**

**Processing speed:**
- Free Redis + Starter services: ~10 hours for 100k URLs
- Upgraded plans: ~5-6 hours for 100k URLs

---

## What's Next?

✅ Your worker is now deployed and ready to scrape!

**To actually use it:**
1. Import CSV data via frontend
2. Create scraping jobs in Supabase
3. Start jobs via API
4. Monitor progress in Render logs
5. View results in Supabase

**Monitoring:**
- Watch worker logs: Render Dashboard → pitchbook-worker-process → Logs
- Check queue stats: `https://your-api.onrender.com/api/queue/stats`
- View job progress: Supabase → Table Editor → scrape_jobs

**Scaling for larger jobs:**
- Increase `SCRAPER_CONCURRENCY` to 5 or 10
- Upgrade to Standard plan for more RAM
- Deploy multiple worker processes (they share the queue automatically)

---

## Support Resources

**Render Documentation:**
- https://render.com/docs

**Getting Help:**
- Render Community Forum: https://community.render.com
- Render Support: support@render.com (paid plans get faster response)
- Supabase Discord: https://discord.supabase.com

**Check Status:**
- Render Status: https://status.render.com
- Supabase Status: https://status.supabase.com

---

## Congratulations! 🎉

You've successfully deployed a production-grade web scraping system!

Your architecture now includes:
- ✅ Frontend for data management
- ✅ Supabase database for storage
- ✅ Render worker for scraping
- ✅ Redis queue for job management
- ✅ Full monitoring and control

You can now scrape 100,000+ URLs reliably with proper error handling, retries, and progress tracking.

**Next:** Build the scraper UI in the frontend to control everything visually!
