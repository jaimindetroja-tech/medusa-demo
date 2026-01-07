import { batchGenerator } from '../lib/batch-processor.js';
console.log('✅ batchGenerator imported');
import { fetchWithRetry } from '../lib/retry.js';
console.log('✅ retry imported');
import syncProductsJob from '../jobs/sync-products.js';
console.log('✅ syncProductsJob imported');
