/**
 * Health Check Script for Manga Connectors
 * 
 * Usage: npm run health-check
 * 
 * Tests all connectors and reports:
 * - ✅ Working
 * - ⚠️  Slow (>3s response)
 * - ❌ Failed (timeout or error)
 * - 🚫 Cloudflare (needs FlareSolverr)
 */

import { engine } from '../src/index.js';

const TIMEOUT_MS = 8000;
const TEST_QUERY = 'solo';

interface HealthResult {
  id: string;
  name: string;
  status: 'ok' | 'slow' | 'failed' | 'cloudflare';
  responseTime: number;
  results: number;
  error?: string;
}

async function testConnector(id: string): Promise<HealthResult> {
  const connector = engine.getConnector(id);
  if (!connector) {
    return {
      id,
      name: id,
      status: 'failed',
      responseTime: 0,
      results: 0,
      error: 'Connector not found',
    };
  }

  const startTime = Date.now();
  
  try {
    const results = await Promise.race([
      connector.search(TEST_QUERY),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
      ),
    ]);

    const responseTime = Date.now() - startTime;
    const status = responseTime > 3000 ? 'slow' : 'ok';

    return {
      id,
      name: connector.source.name,
      status,
      responseTime,
      results: results.length,
    };
  } catch (err: any) {
    const responseTime = Date.now() - startTime;
    const message = err.message || String(err);
    
    let status: HealthResult['status'] = 'failed';
    if (message.includes('403') || message.includes('503') || message.includes('Cloudflare')) {
      status = 'cloudflare';
    }

    return {
      id,
      name: connector.source.name,
      status,
      responseTime,
      results: 0,
      error: message.substring(0, 100),
    };
  }
}

async function runHealthCheck() {
  console.log('🔍 Starting connector health check...\n');
  console.log(`Test query: "${TEST_QUERY}" | Timeout: ${TIMEOUT_MS}ms\n`);

  const sources = engine.getSources();
  const results: HealthResult[] = [];

  for (const source of sources) {
    process.stdout.write(`Testing ${source.name}... `);
    const result = await testConnector(source.id);
    results.push(result);

    const icon = {
      ok: '✅',
      slow: '⚠️ ',
      failed: '❌',
      cloudflare: '🚫',
    }[result.status];

    console.log(`${icon} ${result.status.toUpperCase()} (${result.responseTime}ms, ${result.results} results)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));

  const summary = {
    ok: results.filter(r => r.status === 'ok').length,
    slow: results.filter(r => r.status === 'slow').length,
    failed: results.filter(r => r.status === 'failed').length,
    cloudflare: results.filter(r => r.status === 'cloudflare').length,
  };

  console.log(`✅ Working: ${summary.ok}/${results.length}`);
  console.log(`⚠️  Slow: ${summary.slow}/${results.length}`);
  console.log(`❌ Failed: ${summary.failed}/${results.length}`);
  console.log(`🚫 Cloudflare: ${summary.cloudflare}/${results.length}`);

  // Failed connectors list
  const failed = results.filter(r => r.status !== 'ok');
  if (failed.length > 0) {
    console.log('\n⚠️  CONNECTORS NEEDING ATTENTION:');
    failed.forEach(r => {
      console.log(`   - ${r.name} (${r.id}): ${r.status} - ${r.error || 'no results'}`);
    });
  }

  // Exit code for CI/CD
  const exitCode = summary.failed + summary.cloudflare > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Run if called directly
if (process.argv[1]?.includes('health-check')) {
  runHealthCheck().catch(console.error);
}

export { runHealthCheck, testConnector };
