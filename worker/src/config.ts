import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Scraper
  scraper: {
    apiUrl: process.env.SCRAPER_API_URL || 'https://website-scraper.samuel-5af.workers.dev/',
    concurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '3', 10),
    retryLimit: parseInt(process.env.SCRAPER_RETRY_LIMIT || '3', 10),
    timeout: parseInt(process.env.SCRAPER_TIMEOUT || '30000', 10),
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
};

// Validation
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.supabase.url) {
    errors.push('SUPABASE_URL is required');
  }
  if (!config.supabase.serviceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  if (!config.redis.url) {
    errors.push('REDIS_URL is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
