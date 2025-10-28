# Supabase Setup Guide

This guide will help you set up Supabase for the PitchBook CSV Organizer.

## Prerequisites

- Supabase account (create one at https://supabase.com)
- Node.js and npm installed

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: `pitchbook-organizer` (or your preferred name)
   - Database Password: Create a secure password (save this!)
   - Region: Choose closest to you
5. Click "Create new project"
6. Wait 1-2 minutes for setup to complete

## Step 2: Run Database Schema

1. In your Supabase project, go to the **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy the entire contents of `supabase-schema.sql` from this project
4. Paste into the SQL Editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. Verify success - you should see:
   ```
   Success. No rows returned
   ```

This creates:
- ✅ 4 tables: companies, scrape_jobs, scrape_queue, scraped_data
- ✅ Helper functions for job management
- ✅ Performance indexes
- ✅ Row Level Security policies
- ✅ Convenience views

## Step 3: Get API Credentials

1. Go to **Settings** → **API** (left sidebar)
2. Find your project credentials:

### Copy These Values:

**Project URL:**
```
https://[your-project-id].supabase.co
```

**Anon/Public Key (anon key):**
```
eyJhbG... (long string)
```

**Service Role Key (for worker only):**
```
eyJhbG... (different long string)
```

⚠️ **Security Note**: Keep the service role key secret! Only use it in the backend worker, never in frontend code.

## Step 4: Configure Frontend

1. In the project root, copy the environment template:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and fill in your Supabase credentials:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

   # Worker Configuration (we'll set this up later)
   NEXT_PUBLIC_WORKER_API_URL=http://localhost:3001
   ```

3. Save the file

## Step 5: Test Connection

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000

3. Upload a CSV file

4. Go to the **"Import to Supabase"** tab

5. Select a file and review the auto-detected column mappings

6. Click "Import to Supabase"

7. If successful, you should see:
   ```
   Import complete!
   ✅ Imported: X rows
   ```

## Step 6: Verify Data in Supabase

1. Go to your Supabase project
2. Click **Table Editor** (left sidebar)
3. Select the `companies` table
4. You should see your imported data!

## Database Schema Overview

### Companies Table
Stores all imported CSV data with fields for:
- Person information (name, title, profile URL)
- Company information (name, URL)
- Contact information (email, phone, LinkedIn)
- Location (city, state, postal code, country)
- Source tracking (file name, row number)

### Scrape Jobs Table
Tracks web scraping jobs with:
- Status (pending, processing, completed, failed)
- Progress metrics (total URLs, completed, failed)
- Timing estimates
- Error tracking

### Scrape Queue Table
Queue of URLs to be scraped with:
- Job association
- URL transformation (source → target)
- Retry logic
- Status tracking

### Scraped Data Table
Stores successful scrape results with:
- Original and final URLs
- Scraped text content
- Success/error status
- Response headers

## Common Column Mappings

The importer auto-detects these common PitchBook column names:

| CSV Column | Database Column |
|------------|----------------|
| Company Name | company_name |
| Primary Company Name | company_name |
| Company Website | company_url |
| entity-hover href 3 | company_url |
| Person Name | person_name |
| Primary Contact Name | person_name |
| First Name | person_first_name |
| Last Name | person_last_name |
| Job Title | person_title |
| Email | email |
| Phone | phone |
| LinkedIn URL | linkedin_url |
| City | city |
| HQ Location: City | city |
| State | state |
| Country | country |

## Troubleshooting

### Error: "Missing Supabase environment variables"

**Solution**: Make sure `.env.local` exists and has valid credentials

### Error: "relation 'companies' does not exist"

**Solution**: Run the `supabase-schema.sql` script in the SQL Editor

### Import shows 0 rows imported

**Solution**: Check that column mappings are correct. The importer needs at least a company name or email to generate a pitchbook_id.

### Connection timeout

**Solution**: Check your internet connection and verify the Supabase project is running (not paused)

## Data Management

### View All Companies
```sql
SELECT * FROM companies_with_scrape_status
ORDER BY imported_at DESC;
```

### Check Import Statistics
```sql
SELECT
  source_file,
  COUNT(*) as total_rows,
  MAX(imported_at) as last_import
FROM companies
GROUP BY source_file
ORDER BY last_import DESC;
```

### Delete Imported File
You can delete records from a specific import using the UI or SQL:
```sql
DELETE FROM companies WHERE source_file = 'your-file.csv';
```

## Next Steps

Once your data is in Supabase, you can:

1. ✅ **Set up the Render Background Worker** for web scraping (next guide)
2. ✅ **Use the search interface** to query companies
3. ✅ **Export data** with scraped content
4. ✅ **Track scraping jobs** in real-time

## Security Notes

### Row Level Security (RLS)

The database has RLS enabled with public read access. For production:

1. Enable Supabase Auth
2. Update RLS policies to require authentication
3. Add user-specific access controls

### API Keys

- **Anon Key**: Safe to use in frontend (read-only with RLS)
- **Service Role Key**: Backend only (bypasses RLS, full access)

### Best Practices

- ✅ Keep service role key in backend only
- ✅ Use environment variables, never commit keys
- ✅ Enable RLS on all tables
- ✅ Use anon key for frontend operations
- ✅ Implement proper auth before production deployment

## Storage Limits

Supabase Free Tier:
- 500 MB database space
- 1 GB file storage
- 2 GB bandwidth/month

For 100k+ companies, consider:
- Upgrading to Pro plan ($25/month)
- Unlimited database size
- 8 GB bandwidth
- Daily backups included

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Project Issues: [Your GitHub repo]

---

**Setup Complete!** Your CSV data is now in Supabase and ready for web scraping integration.
