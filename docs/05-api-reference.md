# 📚 API Reference

## 🔧 Functions

### `fetchWithRetry<T>(url, options?)`

Fetches a URL with automatic retry logic and exponential backoff.

**Type Signature**:
```typescript
async function fetchWithRetry<T>(
    url: string,
    options?: RetryOptions
): Promise<T>
```

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | `string` | ✅ | - | The URL to fetch |
| `options` | `RetryOptions` | ❌ | See below | Retry configuration |

**RetryOptions**:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Maximum number of retry attempts |
| `initialDelayMs` | `number` | `1000` | Initial delay in milliseconds |
| `maxDelayMs` | `number` | `30000` | Maximum delay cap in milliseconds |
| `backoffMultiplier` | `number` | `2` | Multiplier for exponential backoff |

**Returns**: `Promise<T>` - Parsed JSON response

**Throws**: `Error` if all retry attempts are exhausted

**Example**:
```typescript
interface Product {
    id: number
    title: string
}

const product = await fetchWithRetry<Product>(
    "https://api.example.com/products/1",
    {
        maxRetries: 5,
        initialDelayMs: 2000,
    }
)
```

**Retry Timeline**:
```
Attempt 1: Immediate
Attempt 2: Wait 1000ms (1s)
Attempt 3: Wait 2000ms (2s)
Attempt 4: Wait 4000ms (4s)
Total: Up to 4 attempts over ~7 seconds
```

---

### `batchGenerator<T>(items, batchSize)`

Async generator that yields batches of items from an array.

**Type Signature**:
```typescript
async function* batchGenerator<T>(
    items: T[],
    batchSize: number
): AsyncGenerator<T[], void, unknown>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | `T[]` | ✅ | Array of items to process |
| `batchSize` | `number` | ✅ | Number of items per batch |

**Yields**: `T[]` - Batches of items

**Example**:
```typescript
const products = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

for await (const batch of batchGenerator(products, 3)) {
    console.log(batch)
    // Output:
    // [1, 2, 3]
    // [4, 5, 6]
    // [7, 8, 9]
    // [10]
}
```

**Memory Usage**:
```
Without batching: O(n) - All items in memory
With batching: O(batchSize) - Only one batch in memory
```

---

### `fetchAllProducts()`

Fetches all products from DummyJSON API with pagination.

**Type Signature**:
```typescript
async function fetchAllProducts(): Promise<DummyJSONProduct[]>
```

**Parameters**: None

**Returns**: `Promise<DummyJSONProduct[]>` - Array of all products

**Throws**: `Error` if fetching fails after retries

**Example**:
```typescript
const products = await fetchAllProducts()
console.log(`Fetched ${products.length} products`)
// Output: Fetched 194 products
```

**Pagination Logic**:
```typescript
// Fetches pages until all products are retrieved
Page 1: ?limit=30&skip=0   → Products 1-30
Page 2: ?limit=30&skip=30  → Products 31-60
Page 3: ?limit=30&skip=60  → Products 61-90
...
Page 7: ?limit=30&skip=180 → Products 181-194
```

---

### `mapToMedusaFormat(product)`

Transforms DummyJSON product to Medusa product format.

**Type Signature**:
```typescript
function mapToMedusaFormat(
    product: DummyJSONProduct
): MedusaProductInput
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product` | `DummyJSONProduct` | ✅ | External product data |

**Returns**: `MedusaProductInput` - Transformed product for Medusa

**Transformations**:

| Field | Input | Output | Transformation |
|-------|-------|--------|----------------|
| `title` | `"iPhone 9"` | `"iPhone 9"` | Direct copy |
| `handle` | - | `"iphone-9"` | Generated from title |
| `price` | `549` | `54900` | Convert to cents (×100) |
| `images` | `["url1"]` | `[{url:"url1"}]` | Wrap in objects |
| `category` | `"smartphones"` | - | Stored in metadata |
| `external_id` | - | `"1"` | From product.id |

**Example**:
```typescript
const externalProduct = {
    id: 1,
    title: "iPhone 9",
    description: "An apple mobile...",
    price: 549,
    category: "smartphones",
    thumbnail: "https://...",
    images: ["https://..."]
}

const medusaProduct = mapToMedusaFormat(externalProduct)

// Result:
{
    title: "iPhone 9",
    handle: "iphone-9",
    description: "An apple mobile...",
    metadata: {
        external_id: "1",
        category: "smartphones",
        thumbnail: "https://..."
    },
    thumbnail: "https://...",
    images: [{ url: "https://..." }],
    variants: [{
        title: "Default",
        prices: [{
            amount: 54900,
            currency_code: "usd"
        }]
    }]
}
```

---

### `syncProductsJob(container)`

Main scheduled job that orchestrates the product sync process.

**Type Signature**:
```typescript
async function syncProductsJob(
    container: MedusaContainer
): Promise<void>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `container` | `MedusaContainer` | ✅ | Medusa dependency injection container |

**Returns**: `Promise<void>`

**Throws**: `Error` if sync fails critically

**Process Flow**:
1. Fetch all products from DummyJSON API
2. Sync categories
3. Check existing products in Medusa
4. Transform and categorize products
5. Process creates in batches
6. Process updates in batches
7. Log final summary

**Example**:
```typescript
// Executed automatically by cron or manually:
await syncProductsJob(container)

// Output:
// 🚀 Starting product sync job...
// 📡 Fetching products from DummyJSON API...
// ✅ Fetched 30 products (30/194)
// ...
// 🎉 Product sync completed!
// ✅ Created: 194
// 🔄 Updated: 0
// ❌ Errors: 0
// ⏱️  Duration: 12.34s
```

**Configuration**:
```typescript
export const config = {
    name: "sync-products",
    schedule: "0 0 * * *", // Daily at midnight
}
```

---

## 🔄 Workflows

### `syncCategoriesWorkflow`

Workflow to sync categories from external API to Medusa.

**Type Signature**:
```typescript
const syncCategoriesWorkflow = createWorkflow(
    "sync-categories",
    (input: { categories: CategoryInput[] }) => WorkflowResponse<CategoryResult>
)
```

**Input**:
```typescript
interface CategoryInput {
    name: string    // Display name (e.g., "smartphones")
    slug: string    // URL-friendly slug (e.g., "smartphones")
}
```

**Output**:
```typescript
interface CategoryResult {
    created: number                      // Number of new categories created
    existing: number                     // Number of existing categories
    categoryMap: Record<string, string>  // slug → category_id mapping
}
```

**Example**:
```typescript
const { result } = await syncCategoriesWorkflow(container).run({
    input: {
        categories: [
            { name: "smartphones", slug: "smartphones" },
            { name: "laptops", slug: "laptops" },
        ]
    }
})

console.log(result)
// Output:
// {
//   created: 2,
//   existing: 0,
//   categoryMap: {
//     "smartphones": "cat_01JGXXX...",
//     "laptops": "cat_01JGYYY..."
//   }
// }
```

**Idempotency**:
```typescript
// First run:
{ created: 2, existing: 0 }

// Second run (same input):
{ created: 0, existing: 2 }
```

**Compensation (Rollback)**:
If the workflow fails, it automatically deletes any categories created during this run.

---

## 📊 Data Types

### `DummyJSONProduct`

Product structure from DummyJSON API.

```typescript
interface DummyJSONProduct {
    id: number
    title: string
    description: string
    price: number
    category: string
    thumbnail: string
    images: string[]
}
```

**Example**:
```json
{
    "id": 1,
    "title": "iPhone 9",
    "description": "An apple mobile which is nothing like apple",
    "price": 549,
    "category": "smartphones",
    "thumbnail": "https://cdn.dummyjson.com/product-images/1/thumbnail.jpg",
    "images": [
        "https://cdn.dummyjson.com/product-images/1/1.jpg",
        "https://cdn.dummyjson.com/product-images/1/2.jpg"
    ]
}
```

---

### `DummyJSONResponse`

API response structure from DummyJSON.

```typescript
interface DummyJSONResponse {
    products: DummyJSONProduct[]
    total: number
    skip: number
    limit: number
}
```

**Example**:
```json
{
    "products": [...],
    "total": 194,
    "skip": 0,
    "limit": 30
}
```

---

### `MedusaProductInput`

Product structure for Medusa creation/update.

```typescript
interface MedusaProductInput {
    title: string
    handle: string
    description?: string
    status?: ProductStatus
    metadata?: Record<string, any>
    options?: Array<{
        title: string
        values: string[]
    }>
    variants: Array<{
        title: string
        prices: Array<{
            amount: number
            currency_code: string
        }>
        options?: Record<string, string>
    }>
    thumbnail?: string
    images?: { url: string }[]
    category_ids?: string[]
}
```

**Example**:
```json
{
    "title": "iPhone 9",
    "handle": "iphone-9",
    "description": "An apple mobile...",
    "metadata": {
        "external_id": "1",
        "category": "smartphones"
    },
    "options": [{
        "title": "Default Option",
        "values": ["Default"]
    }],
    "variants": [{
        "title": "Default",
        "prices": [{
            "amount": 54900,
            "currency_code": "usd"
        }],
        "options": {
            "Default Option": "Default"
        }
    }],
    "thumbnail": "https://...",
    "images": [{ "url": "https://..." }],
    "category_ids": ["cat_01JGXXX..."]
}
```

---

## 🎛️ Configuration

### Job Configuration

```typescript
export const config = {
    name: "sync-products",
    schedule: "0 0 * * *", // Cron expression
}
```

**Cron Schedule Examples**:

| Expression | Description |
|------------|-------------|
| `0 0 * * *` | Daily at midnight (00:00) |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * 0` | Weekly on Sunday at midnight |
| `0 0 1 * *` | Monthly on the 1st at midnight |
| `* * * * *` | Every minute (testing only!) |

**Cron Format**:
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

---

### Constants

```typescript
const DUMMYJSON_API_URL = "https://dummyjson.com/products"
const PAGE_SIZE = 30        // Products per API page
const BATCH_SIZE = 15       // Products per batch
```

**Tuning Guide**:

| Constant | Recommended Range | Impact |
|----------|-------------------|--------|
| `PAGE_SIZE` | 10-100 | Higher = fewer API calls, more memory |
| `BATCH_SIZE` | 10-50 | Higher = faster processing, more memory |

**Memory Impact**:
```
Estimated memory per product: ~3KB
Batch of 15: ~45KB
Batch of 50: ~150KB
All 194: ~582KB
```

---

## 🔍 Query Examples

### Get All Products

```typescript
const query = container.resolve("query")

const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "metadata"],
})

console.log(`Found ${products.length} products`)
```

### Get Products with Categories

```typescript
const { data: products } = await query.graph({
    entity: "product",
    fields: [
        "id",
        "title",
        "categories.*",
    ],
})

products.forEach(product => {
    console.log(product.title, "→", product.categories.map(c => c.name))
})
```

### Get All Categories

```typescript
const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle"],
})

console.log(`Found ${categories.length} categories`)
```

---

## 🚨 Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| `Failed after 4 attempts` | Network timeout or API down | Check internet connection, verify API status |
| `HTTP 404` | Invalid API endpoint | Verify DUMMYJSON_API_URL is correct |
| `HTTP 500` | Server error | Wait and retry, API may be temporarily down |
| `Duplicate handle` | Handle collision | Handled automatically with counter suffix |
| `Invalid product data` | Malformed API response | Check API response format |

---

**Next**: [06-testing.md](./06-testing.md) - Comprehensive testing guide
