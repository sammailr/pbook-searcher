-- ===========================================
-- PitchBook Data Platform - Supabase Schema
-- ===========================================
-- Run this in your Supabase SQL Editor
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- TABLE: companies
-- Stores company and contact data from CSV imports
-- ===========================================
CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  pitchbook_id TEXT UNIQUE NOT NULL,

  -- Person information
  person_name TEXT,
  person_first_name TEXT,
  person_last_name TEXT,
  person_profile_url TEXT,
  person_title TEXT,

  -- Company information
  company_name TEXT,
  company_url TEXT,

  -- Contact information
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,

  -- Location information
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,

  -- Metadata
  source_file TEXT,
  source_row_number INT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_pitchbook_id UNIQUE(pitchbook_id)
);

-- ===========================================
-- TABLE: scrape_jobs
-- Tracks scraping job progress and status
-- ===========================================
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Job metadata
  file_name TEXT,
  user_id TEXT, -- For future auth integration

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paused', 'completed', 'failed', 'cancelled')),

  -- Progress metrics
  total_urls INT DEFAULT 0,
  completed_urls INT DEFAULT 0,
  failed_urls INT DEFAULT 0,
  progress_percent DECIMAL(5,2) DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,

  -- Configuration
  concurrency INT DEFAULT 3,
  retry_limit INT DEFAULT 3,

  -- Error tracking
  error_message TEXT,
  error_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- TABLE: scrape_queue
-- Queue of URLs to be scraped
-- ===========================================
CREATE TABLE IF NOT EXISTS scrape_queue (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,

  -- URL information
  pitchbook_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL, -- Transformed URL for scraping

  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  retry_count INT DEFAULT 0,

  -- Results
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Index for efficient querying
  CONSTRAINT fk_job FOREIGN KEY (job_id) REFERENCES scrape_jobs(id) ON DELETE CASCADE
);

-- ===========================================
-- TABLE: scraped_data
-- Stores results from successful scrapes
-- ===========================================
CREATE TABLE IF NOT EXISTS scraped_data (
  id BIGSERIAL PRIMARY KEY,

  -- Relations
  job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  pitchbook_id TEXT NOT NULL,

  -- URLs
  url TEXT NOT NULL,
  final_url TEXT,

  -- Scraped content
  scraped_text TEXT,
  text_length INT,
  original_length INT,

  -- Metadata from scraper
  success BOOLEAN DEFAULT true,
  headers JSONB, -- Store response headers

  -- Error tracking
  error_message TEXT,

  -- Timestamps
  scraped_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_job FOREIGN KEY (job_id) REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- ===========================================
-- INDEXES for Performance
-- ===========================================

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_pitchbook_id ON companies(pitchbook_id);
CREATE INDEX IF NOT EXISTS idx_companies_company_name ON companies(company_name);
CREATE INDEX IF NOT EXISTS idx_companies_source_file ON companies(source_file);
CREATE INDEX IF NOT EXISTS idx_companies_imported_at ON companies(imported_at DESC);

-- Scrape jobs indexes
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created_at ON scrape_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_id ON scrape_jobs(user_id);

-- Scrape queue indexes
CREATE INDEX IF NOT EXISTS idx_scrape_queue_job_status ON scrape_queue(job_id, status);
CREATE INDEX IF NOT EXISTS idx_scrape_queue_status_created ON scrape_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_scrape_queue_pitchbook_id ON scrape_queue(pitchbook_id);

-- Scraped data indexes
CREATE INDEX IF NOT EXISTS idx_scraped_data_job_id ON scraped_data(job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_data_company_id ON scraped_data(company_id);
CREATE INDEX IF NOT EXISTS idx_scraped_data_pitchbook_id ON scraped_data(pitchbook_id);
CREATE INDEX IF NOT EXISTS idx_scraped_data_success ON scraped_data(success);
CREATE INDEX IF NOT EXISTS idx_scraped_data_scraped_at ON scraped_data(scraped_at DESC);

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_data ENABLE ROW LEVEL SECURITY;

-- Public read access (authenticated users can read)
CREATE POLICY "Allow public read access to companies"
  ON companies FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to scrape_jobs"
  ON scrape_jobs FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to scraped_data"
  ON scraped_data FOR SELECT
  USING (true);

-- Service role has full access (for backend worker)
-- Note: Service role bypasses RLS by default

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to update job progress
CREATE OR REPLACE FUNCTION update_job_progress(job_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE scrape_jobs
  SET
    completed_urls = (
      SELECT COUNT(*)
      FROM scrape_queue
      WHERE job_id = job_uuid
      AND status IN ('completed', 'failed')
    ),
    failed_urls = (
      SELECT COUNT(*)
      FROM scrape_queue
      WHERE job_id = job_uuid
      AND status = 'failed'
    ),
    progress_percent = (
      (SELECT COUNT(*)
       FROM scrape_queue
       WHERE job_id = job_uuid
       AND status IN ('completed', 'failed'))::DECIMAL
      / NULLIF(total_urls, 0) * 100
    ),
    updated_at = NOW()
  WHERE id = job_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get next pending URL from queue
CREATE OR REPLACE FUNCTION get_next_scrape_url(job_uuid UUID)
RETURNS TABLE (
  queue_id BIGINT,
  pitchbook_id TEXT,
  target_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  UPDATE scrape_queue
  SET status = 'processing', started_at = NOW()
  WHERE id = (
    SELECT id FROM scrape_queue
    WHERE job_id = job_uuid
    AND status = 'pending'
    AND retry_count < 3
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING scrape_queue.id, scrape_queue.pitchbook_id, scrape_queue.target_url;
END;
$$ LANGUAGE plpgsql;

-- Function to mark URL as completed
CREATE OR REPLACE FUNCTION mark_url_completed(
  queue_id_param BIGINT,
  scraped_text_param TEXT,
  text_length_param INT,
  final_url_param TEXT
)
RETURNS void AS $$
DECLARE
  job_uuid UUID;
  pb_id TEXT;
BEGIN
  -- Get job_id and pitchbook_id
  SELECT job_id, pitchbook_id INTO job_uuid, pb_id
  FROM scrape_queue WHERE id = queue_id_param;

  -- Update queue status
  UPDATE scrape_queue
  SET status = 'completed', completed_at = NOW()
  WHERE id = queue_id_param;

  -- Insert scraped data
  INSERT INTO scraped_data (
    job_id, pitchbook_id, url, final_url,
    scraped_text, text_length, success
  ) VALUES (
    job_uuid, pb_id, final_url_param, final_url_param,
    scraped_text_param, text_length_param, true
  );

  -- Update job progress
  PERFORM update_job_progress(job_uuid);
END;
$$ LANGUAGE plpgsql;

-- Function to mark URL as failed
CREATE OR REPLACE FUNCTION mark_url_failed(
  queue_id_param BIGINT,
  error_msg TEXT
)
RETURNS void AS $$
DECLARE
  job_uuid UUID;
  current_retry INT;
BEGIN
  -- Get job_id and retry count
  SELECT job_id, retry_count INTO job_uuid, current_retry
  FROM scrape_queue WHERE id = queue_id_param;

  -- Update queue status
  UPDATE scrape_queue
  SET
    status = CASE WHEN current_retry + 1 >= 3 THEN 'failed' ELSE 'pending' END,
    retry_count = retry_count + 1,
    error_message = error_msg,
    completed_at = CASE WHEN current_retry + 1 >= 3 THEN NOW() ELSE NULL END
  WHERE id = queue_id_param;

  -- Update job progress
  PERFORM update_job_progress(job_uuid);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- VIEWS for Convenience
-- ===========================================

-- View: Companies with scrape status
CREATE OR REPLACE VIEW companies_with_scrape_status AS
SELECT
  c.*,
  CASE WHEN sd.id IS NOT NULL THEN true ELSE false END AS is_scraped,
  sd.scraped_at,
  sd.text_length,
  sd.scraped_text
FROM companies c
LEFT JOIN scraped_data sd ON c.pitchbook_id = sd.pitchbook_id;

-- View: Job summary statistics
CREATE OR REPLACE VIEW job_statistics AS
SELECT
  j.id,
  j.file_name,
  j.status,
  j.total_urls,
  j.completed_urls,
  j.failed_urls,
  j.progress_percent,
  j.created_at,
  j.started_at,
  j.completed_at,
  EXTRACT(EPOCH FROM (j.completed_at - j.started_at)) AS duration_seconds,
  CASE
    WHEN j.completed_urls > 0 AND j.status = 'processing' THEN
      ((j.total_urls - j.completed_urls) *
       (EXTRACT(EPOCH FROM (NOW() - j.started_at)) / j.completed_urls))
    ELSE NULL
  END AS estimated_seconds_remaining
FROM scrape_jobs j;

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ===========================================
-- SETUP COMPLETE!
-- ===========================================

-- Verify installation
DO $$
BEGIN
  RAISE NOTICE 'Supabase schema setup complete!';
  RAISE NOTICE 'Tables created: companies, scrape_jobs, scrape_queue, scraped_data';
  RAISE NOTICE 'Indexes created for optimal performance';
  RAISE NOTICE 'RLS policies enabled';
  RAISE NOTICE 'Helper functions created';
  RAISE NOTICE 'Views created: companies_with_scrape_status, job_statistics';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Copy your Supabase URL and anon key';
  RAISE NOTICE '2. Copy your Supabase service role key (for worker)';
  RAISE NOTICE '3. Add keys to frontend .env.local';
  RAISE NOTICE '4. Add service role key to Render worker environment';
END $$;
