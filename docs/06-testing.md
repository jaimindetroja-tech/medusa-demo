# 🧪 Testing Guide

## ✅ Testing Checklist

Complete this checklist to ensure your implementation is production-ready:

- [ ] **Job Registration**: Job is recognized by Medusa
- [ ] **Manual Execution**: Job runs successfully when executed manually
- [ ] **Product Creation**: Products are created in database
- [ ] **Product Visibility**: Products appear in admin panel
- [ ] **Category Sync**: Categories are created and linked
- [ ] **Idempotency**: Running twice doesn't create duplicates
- [ ] **Memory Usage**: No memory spikes during processing
- [ ] **Error Recovery**: Job recovers from network failures
- [ ] **Scheduled Execution**: Job runs automatically on schedule
- [ ] **Logging**: Comprehensive logs for debugging

---

## 1️⃣ Job Registration Test

**Purpose**: Verify that Medusa recognizes the scheduled job

### Test Steps:

```bash
# 1. Build the project
npm run build

# 2. Check if job file exists
ls -la dist/jobs/sync-products.js

# Expected output:
# -rw-r--r--  1 user  staff  XXXXX  sync-products.js
```

### Verification:

```bash
# Check Medusa logs for job registration
npm run dev

# Look for:
# ✅ Registered scheduled job: sync-products
```

**✅ Pass Criteria**: Job file exists and Medusa logs show registration

---

## 2️⃣ Manual Execution Test

**Purpose**: Run the job manually to verify functionality

### Test Steps:

```bash
# Execute the job
npx medusa exec dist/jobs/sync-products.js
```

### Expected Output:

```
🚀 Starting product sync job...
============================================================
📡 Fetching products from DummyJSON API...
✅ Fetched 30 products (30/194)
✅ Fetched 30 products (60/194)
✅ Fetched 30 products (90/194)
✅ Fetched 30 products (120/194)
✅ Fetched 30 products (150/194)
✅ Fetched 30 products (180/194)
✅ Fetched 14 products (194/194)
🎉 Successfully fetched 194 total products

🏷️  Syncing categories...
✅ Categories synced: 24 created, 0 existing
📂 Category map: 24 categories mapped

🔍 Checking for existing products...
📊 Found 0 existing products in Medusa

🔄 Transforming and sorting products...
📝 194 products to create
🔄 0 products to update

🔨 Creating products in batches of 15...
✅ Batch 1: Created 15 products (15/194)
✅ Batch 2: Created 15 products (30/194)
...
✅ Batch 13: Created 14 products (194/194)

============================================================
🎉 Product sync completed!
============================================================
✅ Created: 194
🔄 Updated: 0
❌ Errors: 0
⏱️  Duration: 12.34s
============================================================
```

**✅ Pass Criteria**: 
- All 194 products fetched
- 24 categories created
- 194 products created
- 0 errors
- Duration < 30 seconds

---

## 3️⃣ Database Verification Test

**Purpose**: Verify products are actually in the database

### Test Steps:

```bash
# Query products using Medusa CLI
npx medusa exec -c "
const query = container.resolve('query');
const { data: products } = await query.graph({
  entity: 'product',
  fields: ['id', 'title', 'handle', 'metadata']
});
console.log('Total products:', products.length);
console.log('Sample product:', products[0]);
"
```

### Expected Output:

```javascript
Total products: 194
Sample product: {
  id: 'prod_01JGXXX...',
  title: 'iPhone 9',
  handle: 'iphone-9',
  metadata: {
    external_id: '1',
    category: 'smartphones',
    thumbnail: 'https://...'
  }
}
```

### Verify Categories:

```bash
npx medusa exec -c "
const query = container.resolve('query');
const { data: categories } = await query.graph({
  entity: 'product_category',
  fields: ['id', 'name', 'handle']
});
console.log('Total categories:', categories.length);
console.log('Categories:', categories.map(c => c.name));
"
```

### Expected Output:

```javascript
Total categories: 24
Categories: [
  'Beauty', 'Fragrances', 'Furniture', 'Groceries',
  'Home-decoration', 'Kitchen-accessories', 'Laptops',
  'Mens-shirts', 'Mens-shoes', 'Mens-watches',
  'Mobile-accessories', 'Motorcycle', 'Skin-care',
  'Smartphones', 'Sports-accessories', 'Sunglasses',
  'Tablets', 'Tops', 'Vehicle', 'Womens-bags',
  'Womens-dresses', 'Womens-jewellery', 'Womens-shoes',
  'Womens-watches'
]
```

**✅ Pass Criteria**: 
- 194 products in database
- 24 categories in database
- Products have correct metadata

---

## 4️⃣ Admin Panel Test

**Purpose**: Verify products are visible in the admin interface

### Test Steps:

1. **Start Medusa**:
   ```bash
   npm run dev
   ```

2. **Open Admin Panel**:
   ```
   http://localhost:9000/app
   ```

3. **Navigate to Products**:
   - Click "Products" in sidebar
   - Should see 194 products

4. **Check Product Details**:
   - Click on "iPhone 9"
   - Verify:
     - Title: "iPhone 9"
     - Handle: "iphone-9"
     - Price: $549.00
     - Category: "Smartphones"
     - Images loaded
     - Metadata present

5. **Check Categories**:
   - Click "Categories" in sidebar
   - Should see 24 categories
   - Click "Smartphones"
   - Should show products in that category

**✅ Pass Criteria**: 
- All products visible
- Product details correct
- Categories linked properly
- Images display correctly

---

## 5️⃣ Idempotency Test

**Purpose**: Verify running the job twice doesn't create duplicates

### Test Steps:

```bash
# First run
npx medusa exec dist/jobs/sync-products.js

# Wait for completion, then run again
npx medusa exec dist/jobs/sync-products.js
```

### Expected Output (Second Run):

```
🚀 Starting product sync job...
============================================================
📡 Fetching products from DummyJSON API...
🎉 Successfully fetched 194 total products

🏷️  Syncing categories...
✅ Categories synced: 0 created, 24 existing
📂 Category map: 24 categories mapped

🔍 Checking for existing products...
📊 Found 194 existing products in Medusa

🔄 Transforming and sorting products...
📝 0 products to create
🔄 194 products to update

🔄 Updating products in batches of 15...
✅ Batch 1: Updated 15 products (15/194)
✅ Batch 2: Updated 15 products (30/194)
...
✅ Batch 13: Updated 14 products (194/194)

============================================================
🎉 Product sync completed!
============================================================
✅ Created: 0
🔄 Updated: 194
❌ Errors: 0
⏱️  Duration: 10.12s
============================================================
```

### Verify No Duplicates:

```bash
npx medusa exec -c "
const query = container.resolve('query');
const { data: products } = await query.graph({
  entity: 'product',
  fields: ['id', 'metadata']
});

// Check for duplicate external_ids
const externalIds = products.map(p => p.metadata?.external_id);
const uniqueIds = new Set(externalIds);

console.log('Total products:', products.length);
console.log('Unique external_ids:', uniqueIds.size);
console.log('Duplicates:', products.length - uniqueIds.size);
"
```

### Expected Output:

```
Total products: 194
Unique external_ids: 194
Duplicates: 0
```

**✅ Pass Criteria**: 
- Second run creates 0 products
- Second run updates 194 products
- No duplicate external_ids
- Total products still 194

---

## 6️⃣ Memory Test

**Purpose**: Verify no memory spikes during processing

### Test Steps:

1. **Monitor Memory**:
   ```bash
   # In one terminal, run the job
   npx medusa exec dist/jobs/sync-products.js
   
   # In another terminal, monitor memory
   while true; do
     ps aux | grep "medusa exec" | grep -v grep | awk '{print $6/1024 " MB"}'
     sleep 1
   done
   ```

2. **Expected Behavior**:
   - Memory should remain relatively stable
   - No sudden spikes > 200MB
   - Gradual increase is normal

### Benchmark Results:

```
Batch Processing (15 items):
- Initial: ~120 MB
- Peak: ~180 MB
- Final: ~140 MB
✅ PASS: Memory stable

Without Batch Processing (194 items):
- Initial: ~120 MB
- Peak: ~450 MB
- Final: ~200 MB
⚠️ WARNING: High memory usage
```

**✅ Pass Criteria**: 
- Peak memory < 250MB
- No sudden spikes
- Memory returns to baseline after completion

---

## 7️⃣ Error Recovery Test

**Purpose**: Verify job recovers from network failures

### Test Steps:

1. **Simulate Network Failure**:
   ```bash
   # Modify retry.ts temporarily to fail on first attempt
   # Or use network throttling tools
   ```

2. **Run Job**:
   ```bash
   npx medusa exec dist/jobs/sync-products.js
   ```

3. **Expected Output**:
   ```
   📡 Fetching products from DummyJSON API...
   ⚠️  Attempt 1/4 failed: Network error. Retrying in 1000ms...
   ✅ Fetched 30 products (30/194)
   ```

### Test Batch Failure:

Modify `sync-products.ts` to simulate a batch failure:

```typescript
// In batch processing section
if (batchNum === 2) {
    throw new Error("Simulated batch failure")
}
```

Expected output:
```
✅ Batch 1: Created 15 products (15/194)
❌ Batch 2 failed: Simulated batch failure
✅ Batch 3: Created 15 products (30/194)
...
```

**✅ Pass Criteria**: 
- Job retries failed requests
- Failed batches don't stop entire job
- Errors are logged clearly
- Job completes despite errors

---

## 8️⃣ Scheduled Execution Test

**Purpose**: Verify job runs automatically on schedule

### Test Steps:

1. **Set Test Schedule**:
   ```typescript
   // In sync-products.ts
   export const config = {
       name: "sync-products",
       schedule: "* * * * *", // Every minute
   }
   ```

2. **Rebuild**:
   ```bash
   npm run build
   ```

3. **Start Medusa**:
   ```bash
   npm run dev
   ```

4. **Monitor Logs**:
   - Wait 1 minute
   - Check logs for job execution
   - Should see sync starting automatically

5. **Expected Output**:
   ```
   [YYYY-MM-DD HH:MM:SS] Running scheduled job: sync-products
   🚀 Starting product sync job...
   ...
   ```

6. **Restore Production Schedule**:
   ```typescript
   export const config = {
       name: "sync-products",
       schedule: "0 0 * * *", // Daily at midnight
   }
   ```

**✅ Pass Criteria**: 
- Job runs automatically every minute
- Logs show scheduled execution
- Job completes successfully

---

## 9️⃣ Performance Test

**Purpose**: Measure job performance

### Metrics to Track:

| Metric | Target | Actual |
|--------|--------|--------|
| **Total Duration** | < 30s | ___s |
| **API Fetch Time** | < 10s | ___s |
| **Category Sync Time** | < 2s | ___s |
| **Product Processing Time** | < 15s | ___s |
| **Products per Second** | > 10 | ___ |
| **Peak Memory** | < 250MB | ___MB |

### Test Script:

```bash
npx medusa exec -c "
const startTime = Date.now();

// Run sync job
await syncProductsJob(container);

const duration = (Date.now() - startTime) / 1000;
const productsPerSecond = 194 / duration;

console.log('Duration:', duration, 's');
console.log('Products/second:', productsPerSecond.toFixed(2));
"
```

**✅ Pass Criteria**: 
- Duration < 30 seconds
- Products/second > 10
- All metrics within targets

---

## 🔟 Edge Cases Test

### Test 1: Empty API Response

Modify API to return 0 products:

```typescript
// Expected behavior:
ℹ️  No products to sync
```

### Test 2: Duplicate Handles

Create products with same title:

```typescript
// Expected behavior:
// Handles: "iphone-9", "iphone-9-1", "iphone-9-2"
```

### Test 3: Missing Category

Product with category not in map:

```typescript
// Expected behavior:
// Product created without category_ids
```

### Test 4: Network Timeout

Simulate slow network:

```typescript
// Expected behavior:
// Retries with exponential backoff
// Eventually succeeds or fails gracefully
```

**✅ Pass Criteria**: 
- All edge cases handled gracefully
- No crashes or data corruption
- Clear error messages

---

## 📊 Test Results Template

```markdown
## Test Results - [Date]

### Environment
- Medusa Version: ___
- Node Version: ___
- Database: PostgreSQL ___

### Results

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| Job Registration | ✅ PASS | - | - |
| Manual Execution | ✅ PASS | 12.34s | - |
| Database Verification | ✅ PASS | - | 194 products, 24 categories |
| Admin Panel | ✅ PASS | - | All visible |
| Idempotency | ✅ PASS | 10.12s | No duplicates |
| Memory Usage | ✅ PASS | - | Peak: 180MB |
| Error Recovery | ✅ PASS | - | Retries work |
| Scheduled Execution | ✅ PASS | - | Runs on schedule |
| Performance | ✅ PASS | 12.34s | 15.7 products/s |
| Edge Cases | ✅ PASS | - | All handled |

### Summary
- **Total Tests**: 10
- **Passed**: 10
- **Failed**: 0
- **Overall**: ✅ PRODUCTION READY
```

---

## 🐛 Common Issues & Solutions

### Issue: "Job not found"

**Cause**: Job not built or not registered

**Solution**:
```bash
npm run build
# Check dist/jobs/sync-products.js exists
```

---

### Issue: "Cannot resolve query"

**Cause**: Container not properly injected

**Solution**:
```typescript
// Ensure function signature is correct
export default async function syncProductsJob(container: MedusaContainer)
```

---

### Issue: "Duplicate handle"

**Cause**: Handle uniqueness logic not working

**Solution**:
```typescript
// Check handle uniqueness logic
while (usedHandles.has(handle) || dbHandles.has(handle)) {
    handle = `${originalHandle}-${counter}`
    counter++
}
```

---

### Issue: "Memory spike"

**Cause**: Batch size too large

**Solution**:
```typescript
// Reduce batch size
const BATCH_SIZE = 10 // Instead of 15
```

---

### Issue: "Network timeout"

**Cause**: API slow or down

**Solution**:
```typescript
// Increase retry settings
await fetchWithRetry(url, {
    maxRetries: 5,
    initialDelayMs: 2000,
})
```

---

**Next**: [07-troubleshooting.md](./07-troubleshooting.md) - Detailed troubleshooting guide
