# 📋 Quick Reference Guide

## 🚀 Common Commands

### Build & Run

```bash
# Build the project
npm run build

# Run the sync job manually
npx medusa exec dist/jobs/sync-products.js

# Start Medusa (enables scheduled execution)
npm run dev
```

---

### Database Queries

```bash
# Count products
npx medusa exec -c "
const query = container.resolve('query');
const { data } = await query.graph({
  entity: 'product',
  fields: ['id']
});
console.log('Products:', data.length);
"

# Count categories
npx medusa exec -c "
const query = container.resolve('query');
const { data } = await query.graph({
  entity: 'product_category',
  fields: ['id']
});
console.log('Categories:', data.length);
"

# Check for duplicates
npx medusa exec -c "
const query = container.resolve('query');
const { data: products } = await query.graph({
  entity: 'product',
  fields: ['id', 'metadata']
});
const externalIds = products.map(p => p.metadata?.external_id);
const unique = new Set(externalIds);
console.log('Total:', products.length, 'Unique:', unique.size);
"
```

---

## ⚙️ Configuration Quick Reference

### Cron Schedules

```typescript
// Daily at midnight
schedule: "0 0 * * *"

// Every 6 hours
schedule: "0 */6 * * *"

// Every minute (testing only!)
schedule: "* * * * *"

// Weekly on Sunday at midnight
schedule: "0 0 * * 0"
```

### Constants

```typescript
const DUMMYJSON_API_URL = "https://dummyjson.com/products"
const PAGE_SIZE = 30        // Products per API page
const BATCH_SIZE = 15       // Products per batch
const MAX_RETRIES = 3       // Retry attempts
const INITIAL_DELAY = 1000  // Initial retry delay (ms)
```

---

## 🔍 Debugging Snippets

### Enable Verbose Logging

```typescript
// Add to sync-products.ts
console.log("📍 Checkpoint:", description, data)
```

### Check Memory Usage

```bash
# Monitor memory while job runs
while true; do
  ps aux | grep "medusa exec" | grep -v grep | awk '{print $6/1024 " MB"}'
  sleep 1
done
```

### Profile Performance

```bash
# Time the job execution
time npx medusa exec dist/jobs/sync-products.js
```

---

## 🐛 Common Issues & Quick Fixes

### Issue: Job not running

```bash
# Solution: Rebuild
npm run build

# Verify file exists
ls -la dist/jobs/sync-products.js
```

### Issue: Duplicates created

```typescript
// Solution: Check idempotency logic
const existing = existingProductMap.get(externalId)
if (existing) {
    // UPDATE
} else {
    // CREATE
}
```

### Issue: Memory spike

```typescript
// Solution: Reduce batch size
const BATCH_SIZE = 10 // Instead of 15
```

### Issue: Network timeout

```typescript
// Solution: Increase retries
await fetchWithRetry(url, {
    maxRetries: 5,
    initialDelayMs: 2000,
})
```

---

## 📊 Expected Results

### First Run

```
🚀 Starting product sync job...
📡 Fetching products from DummyJSON API...
🎉 Successfully fetched 194 total products
🏷️  Syncing categories...
✅ Categories synced: 24 created, 0 existing
📊 Found 0 existing products in Medusa
📝 194 products to create
🔄 0 products to update
🔨 Creating products in batches of 15...
✅ Batch 1: Created 15 products (15/194)
...
✅ Batch 13: Created 14 products (194/194)
🎉 Product sync completed!
✅ Created: 194
🔄 Updated: 0
❌ Errors: 0
⏱️  Duration: 12.34s
```

### Second Run (Idempotency Test)

```
🚀 Starting product sync job...
📡 Fetching products from DummyJSON API...
🎉 Successfully fetched 194 total products
🏷️  Syncing categories...
✅ Categories synced: 0 created, 24 existing
📊 Found 194 existing products in Medusa
📝 0 products to create
🔄 194 products to update
🔄 Updating products in batches of 15...
✅ Batch 1: Updated 15 products (15/194)
...
✅ Batch 13: Updated 14 products (194/194)
🎉 Product sync completed!
✅ Created: 0
🔄 Updated: 194
❌ Errors: 0
⏱️  Duration: 10.12s
```

---

## 🎯 Testing Checklist

- [ ] Job builds successfully
- [ ] Job executes manually
- [ ] 194 products created
- [ ] 24 categories created
- [ ] Products visible in admin
- [ ] Categories linked to products
- [ ] Second run updates (no duplicates)
- [ ] Memory usage < 250MB
- [ ] Duration < 30 seconds
- [ ] Scheduled execution works

---

## 📈 Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Duration** | < 30s | Check logs: `⏱️  Duration: X.XXs` |
| **Memory** | < 250MB | Monitor with `ps aux` |
| **Products/sec** | > 10 | Calculate: 194 / duration |
| **Error Rate** | 0% | Check logs: `❌ Errors: 0` |

---

## 🔗 Quick Links

- [Full Documentation](./README.md)
- [Implementation Guide](./04-implementation.md)
- [Testing Guide](./06-testing.md)
- [Troubleshooting](./07-troubleshooting.md)
- [API Reference](./05-api-reference.md)

---

## 💡 Pro Tips

1. **Test with every minute schedule first**:
   ```typescript
   schedule: "* * * * *"
   ```

2. **Monitor logs in real-time**:
   ```bash
   npm run dev | grep "sync-products"
   ```

3. **Use admin panel to verify**:
   ```
   http://localhost:9000/app/products
   ```

4. **Check database directly**:
   ```bash
   psql -U postgres -d medusa_db
   SELECT COUNT(*) FROM product;
   ```

5. **Profile with Node debugger**:
   ```bash
   node --inspect-brk dist/jobs/sync-products.js
   ```

---

## 🎓 Key Concepts Recap

### Pagination
Fetching data in pages to avoid overwhelming the API and memory.

### Batch Processing
Processing items in small groups to prevent memory spikes.

### Exponential Backoff
Increasing delay between retries: 1s → 2s → 4s → 8s

### Idempotency
Safe to run multiple times without creating duplicates.

### Workflow
Medusa's transactional operations with automatic rollback.

---

## 📞 Getting Help

1. **Check the docs**: Start with [README.md](./README.md)
2. **Search troubleshooting**: See [07-troubleshooting.md](./07-troubleshooting.md)
3. **Ask the community**: Medusa Discord
4. **File an issue**: GitHub Issues

---

**Happy Coding!** 🚀
