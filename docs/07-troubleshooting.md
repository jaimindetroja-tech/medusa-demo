# 🔧 Troubleshooting Guide

## 🚨 Common Issues

### 1. Job Not Executing

#### Symptoms:
- Job doesn't run on schedule
- No logs appear
- `npx medusa exec` fails

#### Diagnosis:

```bash
# Check if job file exists
ls -la dist/jobs/sync-products.js

# Check Medusa logs
npm run dev | grep "sync-products"
```

#### Solutions:

**Solution 1: Rebuild the project**
```bash
npm run build
```

**Solution 2: Check job configuration**
```typescript
// Ensure config is exported
export const config = {
    name: "sync-products",
    schedule: "0 0 * * *",
}
```

**Solution 3: Verify cron expression**
```bash
# Test cron expression at https://crontab.guru
# Or use every minute for testing:
schedule: "* * * * *"
```

**Solution 4: Check Medusa version**
```bash
npm list @medusajs/medusa
# Ensure version >= 2.0
```

---

### 2. Products Not Creating

#### Symptoms:
- Job runs successfully
- Logs show "Created: 194"
- But products not in database/admin

#### Diagnosis:

```bash
# Check database directly
npx medusa exec -c "
const query = container.resolve('query');
const { data } = await query.graph({
  entity: 'product',
  fields: ['id']
});
console.log('Products in DB:', data.length);
"
```

#### Solutions:

**Solution 1: Check workflow errors**
```typescript
// Add more detailed logging
try {
    await createProductsWorkflow(container).run({
        input: { products: batch },
    })
    console.log("✅ Batch created successfully")
} catch (error) {
    console.error("❌ Workflow error:", error)
    console.error("Error details:", JSON.stringify(error, null, 2))
}
```

**Solution 2: Verify product data format**
```typescript
// Log product data before creation
console.log("Product to create:", JSON.stringify(batch[0], null, 2))
```

**Solution 3: Check database connection**
```bash
# Verify PostgreSQL is running
psql -U postgres -c "SELECT 1"
```

**Solution 4: Check for validation errors**
```typescript
// Ensure all required fields are present
const product = {
    title: "...",        // Required
    handle: "...",       // Required
    variants: [{...}],   // Required (at least one)
    // ...
}
```

---

### 3. Duplicate Products

#### Symptoms:
- Running job twice creates duplicates
- Multiple products with same external_id

#### Diagnosis:

```bash
# Check for duplicates
npx medusa exec -c "
const query = container.resolve('query');
const { data: products } = await query.graph({
  entity: 'product',
  fields: ['id', 'metadata']
});

const externalIds = products.map(p => p.metadata?.external_id);
const duplicates = externalIds.filter((id, index) => 
  externalIds.indexOf(id) !== index
);

console.log('Duplicates:', duplicates);
"
```

#### Solutions:

**Solution 1: Check idempotency logic**
```typescript
// Ensure external_id is being checked
const existing = existingProductMap.get(externalId)
if (existing) {
    // UPDATE
    productsToUpdate.push({...})
} else {
    // CREATE
    productsToCreate.push({...})
}
```

**Solution 2: Verify metadata is saved**
```typescript
// Ensure external_id is in metadata
metadata: {
    external_id: product.id.toString(), // Must be string
    category: product.category,
}
```

**Solution 3: Clean up duplicates**
```bash
# Delete all products and re-sync
npx medusa exec -c "
const query = container.resolve('query');
const { Modules } = await import('@medusajs/framework/utils');
const productService = container.resolve(Modules.PRODUCT);

const { data: products } = await query.graph({
  entity: 'product',
  fields: ['id']
});

await productService.deleteProducts(products.map(p => p.id));
console.log('Deleted', products.length, 'products');
"
```

---

### 4. Categories Not Linking

#### Symptoms:
- Categories created
- Products created
- But products not linked to categories

#### Diagnosis:

```bash
# Check product-category links
npx medusa exec -c "
const query = container.resolve('query');
const { data: products } = await query.graph({
  entity: 'product',
  fields: ['id', 'title', 'categories.*']
});

const withCategories = products.filter(p => p.categories?.length > 0);
console.log('Products with categories:', withCategories.length, '/', products.length);
"
```

#### Solutions:

**Solution 1: Verify category_ids are set**
```typescript
// Ensure category_ids is added for new products
if (categoryMap[categorySlug]) {
    product.category_ids = [categoryMap[categorySlug]]
    console.log(`Linking product to category: ${categorySlug}`)
}
```

**Solution 2: Check category map**
```typescript
// Log category map
console.log("Category map:", categoryMap)
// Should show: { "smartphones": "cat_01...", ... }
```

**Solution 3: Verify slug generation**
```typescript
// Ensure slugs match
const categorySlug = externalProduct.category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

console.log(`Category: ${externalProduct.category} → Slug: ${categorySlug}`)
```

**Solution 4: Manual category linking**
```bash
# Link products to categories manually
npx medusa exec -c "
const { Modules } = await import('@medusajs/framework/utils');
const productService = container.resolve(Modules.PRODUCT);

await productService.updateProducts([{
  id: 'prod_01...',
  category_ids: ['cat_01...']
}]);
"
```

---

### 5. Network Errors

#### Symptoms:
- "Failed after 4 attempts"
- "Network timeout"
- "ECONNREFUSED"

#### Diagnosis:

```bash
# Test API directly
curl https://dummyjson.com/products?limit=1

# Check internet connection
ping dummyjson.com
```

#### Solutions:

**Solution 1: Increase retry attempts**
```typescript
await fetchWithRetry(url, {
    maxRetries: 5,        // More retries
    initialDelayMs: 2000, // Longer delays
})
```

**Solution 2: Add timeout handling**
```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    return await response.json()
} catch (error) {
    clearTimeout(timeout)
    throw error
}
```

**Solution 3: Use proxy (if behind firewall)**
```typescript
const response = await fetch(url, {
    agent: new HttpsProxyAgent('http://proxy:8080')
})
```

---

### 6. Memory Issues

#### Symptoms:
- "JavaScript heap out of memory"
- Process crashes during sync
- System becomes slow

#### Diagnosis:

```bash
# Monitor memory usage
node --max-old-space-size=4096 dist/jobs/sync-products.js

# Check Node memory limit
node -e "console.log(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024, 'MB')"
```

#### Solutions:

**Solution 1: Reduce batch size**
```typescript
const BATCH_SIZE = 10 // Instead of 15
```

**Solution 2: Increase Node memory**
```bash
# In package.json
"scripts": {
    "dev": "NODE_OPTIONS='--max-old-space-size=4096' medusa develop"
}
```

**Solution 3: Add garbage collection**
```typescript
// After each batch
if (global.gc) {
    global.gc()
}
```

**Solution 4: Process in smaller chunks**
```typescript
// Fetch products in smaller pages
const PAGE_SIZE = 10 // Instead of 30
```

---

### 7. Handle Collisions

#### Symptoms:
- "Duplicate handle" error
- Products with handles like "iphone-9-1", "iphone-9-2"

#### Diagnosis:

```bash
# Check for duplicate handles
npx medusa exec -c "
const query = container.resolve('query');
const { data: products } = await query.graph({
  entity: 'product',
  fields: ['handle']
});

const handles = products.map(p => p.handle);
const duplicates = handles.filter((h, i) => handles.indexOf(h) !== i);
console.log('Duplicate handles:', duplicates);
"
```

#### Solutions:

**Solution 1: This is expected behavior**
```typescript
// Handle uniqueness is enforced automatically
// "iphone-9" → "iphone-9-1" → "iphone-9-2"
// This is correct!
```

**Solution 2: Use more unique handles**
```typescript
function mapToMedusaFormat(product: DummyJSONProduct): MedusaProductInput {
    const rawHandle = `${product.category}-${product.title}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    
    // Now: "smartphones-iphone-9"
}
```

**Solution 3: Include external_id in handle**
```typescript
const rawHandle = `${product.title}-${product.id}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

// Now: "iphone-9-1" (unique by ID)
```

---

### 8. Workflow Errors

#### Symptoms:
- "Workflow execution failed"
- "Step failed: ..."
- Transactions rolled back

#### Diagnosis:

```bash
# Check workflow logs
npm run dev | grep "workflow"

# Enable debug logging
DEBUG=medusa:* npm run dev
```

#### Solutions:

**Solution 1: Check input format**
```typescript
// Ensure input matches workflow expectations
await createProductsWorkflow(container).run({
    input: { 
        products: [...] // Must be array
    }
})
```

**Solution 2: Validate data before workflow**
```typescript
// Add validation
const isValid = batch.every(p => 
    p.title && p.handle && p.variants?.length > 0
)

if (!isValid) {
    console.error("Invalid product data:", batch)
    throw new Error("Invalid product data")
}
```

**Solution 3: Handle workflow errors gracefully**
```typescript
try {
    await createProductsWorkflow(container).run({
        input: { products: batch }
    })
} catch (error) {
    // Log error but continue
    console.error("Workflow failed:", error)
    errorCount += batch.length
    // Don't throw - continue with next batch
}
```

---

### 9. Scheduling Issues

#### Symptoms:
- Job doesn't run at scheduled time
- Runs at wrong time
- Runs too frequently

#### Diagnosis:

```bash
# Check system time
date

# Check timezone
echo $TZ

# Verify cron expression
# Use https://crontab.guru
```

#### Solutions:

**Solution 1: Verify cron expression**
```typescript
// Daily at midnight (00:00)
schedule: "0 0 * * *"

// NOT:
schedule: "0 0 0 * *" // Wrong!
```

**Solution 2: Set timezone**
```bash
# In .env
TZ=America/New_York
```

**Solution 3: Use explicit time**
```typescript
// If midnight doesn't work, try 1 AM
schedule: "0 1 * * *"
```

**Solution 4: Check Medusa scheduler**
```bash
# Ensure Medusa is running continuously
pm2 start "npm run dev" --name medusa
```

---

### 10. Performance Issues

#### Symptoms:
- Job takes > 60 seconds
- API requests are slow
- Database queries are slow

#### Diagnosis:

```bash
# Profile the job
time npx medusa exec dist/jobs/sync-products.js

# Check API response time
time curl https://dummyjson.com/products?limit=30
```

#### Solutions:

**Solution 1: Increase batch size**
```typescript
const BATCH_SIZE = 20 // Instead of 15
```

**Solution 2: Parallel API requests**
```typescript
// Fetch multiple pages in parallel
const pages = [0, 30, 60, 90, 120, 150, 180]
const responses = await Promise.all(
    pages.map(skip => 
        fetchWithRetry(`${API_URL}?limit=30&skip=${skip}`)
    )
)
```

**Solution 3: Optimize database queries**
```typescript
// Fetch only needed fields
const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata.external_id"] // Only what we need
})
```

**Solution 4: Cache category map**
```typescript
// Store category map in Redis or memory
// Avoid re-fetching every run
```

---

## 🔍 Debugging Tips

### Enable Verbose Logging

```typescript
// Add detailed logs throughout the job
console.log("📍 Checkpoint 1: Starting fetch")
console.log("📍 Checkpoint 2: Fetched", products.length, "products")
console.log("📍 Checkpoint 3: Starting category sync")
// ...
```

### Use Debugger

```bash
# Run with Node debugger
node --inspect-brk dist/jobs/sync-products.js

# In Chrome, go to: chrome://inspect
```

### Check Medusa Logs

```bash
# Follow logs in real-time
tail -f ~/.medusa/logs/medusa.log

# Or with grep
tail -f ~/.medusa/logs/medusa.log | grep "sync-products"
```

### Database Inspection

```bash
# Connect to PostgreSQL
psql -U postgres -d medusa_db

# Check products
SELECT COUNT(*) FROM product;

# Check categories
SELECT COUNT(*) FROM product_category;

# Check product-category links
SELECT COUNT(*) FROM product_category_product;
```

---

## 📞 Getting Help

If you're still stuck:

1. **Check Medusa Discord**: https://discord.gg/medusajs
2. **GitHub Issues**: https://github.com/medusajs/medusa/issues
3. **Documentation**: https://docs.medusajs.com
4. **Stack Overflow**: Tag with `medusajs`

---

**Next**: [08-bar-raiser.md](./08-bar-raiser.md) - Advanced features and optimizations
