#!/usr/bin/env node

/**
 * Standalone Worker Process
 * Run this separately from the API server for dedicated job processing
 * Usage: npm run worker
 */

import { config, validateConfig } from './config';
import { testConnection } from './supabase';
import { createWorker, testRedisConnection } from './queue';

async function main() {
  console.log('🚀 Starting PitchBook Scraper Worker...\n');

  // Validate configuration
  try {
    validateConfig();
    console.log('✅ Configuration validated');
  } catch (error) {
    console.error('❌ Configuration error:', error);
    process.exit(1);
  }

  // Test connections
  console.log('\n📡 Testing connections...');

  const [supabaseOk, redisOk] = await Promise.all([
    testConnection(),
    testRedisConnection(),
  ]);

  if (!supabaseOk || !redisOk) {
    console.error('\n❌ Connection tests failed. Please check your configuration.');
    process.exit(1);
  }

  console.log('✅ All connections successful\n');

  // Create and start worker
  console.log('🔧 Starting worker process...');
  const worker = createWorker();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n\n🛑 Shutting down worker...');

    await worker.close();
    console.log('✅ Worker closed');

    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('\n✅ Worker is running and processing jobs');
  console.log('📊 Configuration:');
  console.log(`   - Concurrency: ${config.scraper.concurrency}`);
  console.log(`   - Retry limit: ${config.scraper.retryLimit}`);
  console.log(`   - Timeout: ${config.scraper.timeout}ms`);
  console.log(`   - Scraper API: ${config.scraper.apiUrl}`);
  console.log('\n💡 Press Ctrl+C to stop\n');
}

// Run worker
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
