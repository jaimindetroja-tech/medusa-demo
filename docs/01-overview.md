# 📋 Overview - Product Sync Job

## 🎯 Mission Statement

Build a **production-ready scheduled job** that automatically synchronizes products from an external API (DummyJSON) into a Medusa e-commerce store.

---

## 🌟 What This Job Does

### Primary Functions

1. **Scheduled Execution**: Runs automatically every day at midnight
2. **Data Fetching**: Retrieves all products from DummyJSON API
3. **Pagination Handling**: Manages API pagination (30 products per page)
4. **Batch Processing**: Processes products in batches of 15 to prevent memory issues
5. **Error Recovery**: Automatically retries failed requests with exponential backoff
6. **Idempotency**: Prevents duplicate products using external IDs
7. **Category Sync**: Syncs product categories (Bar Raiser feature)

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SCHEDULED JOB                            │
│                  (Runs at Midnight)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 1: FETCH ALL PRODUCTS                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  DummyJSON API                                       │   │
│  │  • Page 1: ?limit=30&skip=0   (30 products)         │   │
│  │  • Page 2: ?limit=30&skip=30  (30 products)         │   │
│  │  • Page 3: ?limit=30&skip=60  (30 products)         │   │
│  │  • ...                                               │   │
│  │  • Page N: ?limit=30&skip=180 (14 products)         │   │
│  └──────────────────────────────────────────────────────┘   │
│                     │                                        │
│                     ▼                                        │
│         Total: 194 Products Fetched                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         STEP 2: SYNC CATEGORIES (Bar Raiser)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Extract unique categories from products             │   │
│  │  • beauty, fragrances, furniture, groceries, etc.    │   │
│  │                                                       │   │
│  │  Create/Update in Medusa                             │   │
│  │  • Check existing categories                         │   │
│  │  • Create missing ones                               │   │
│  │  • Build category map (slug → id)                    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│        STEP 3: CHECK EXISTING PRODUCTS                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Query Medusa Database                               │   │
│  │  • Fetch all existing products                       │   │
│  │  • Build map: external_id → product                  │   │
│  │  • Build set: all existing handles                   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│      STEP 4: TRANSFORM & CATEGORIZE                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  For each product:                                   │   │
│  │  • Transform to Medusa format                        │   │
│  │  • Check if exists (by external_id)                  │   │
│  │  • If exists → Add to UPDATE list                    │   │
│  │  • If new → Add to CREATE list                       │   │
│  │  • Ensure unique handles                             │   │
│  │  • Link to category (if available)                   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         STEP 5: BATCH PROCESSING                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  CREATE Products (in batches of 15)                  │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐                 │   │
│  │  │Batch 1 │→ │Batch 2 │→ │Batch 3 │→ ...            │   │
│  │  │15 items│  │15 items│  │15 items│                 │   │
│  │  └────────┘  └────────┘  └────────┘                 │   │
│  │                                                       │   │
│  │  UPDATE Products (in batches of 15)                  │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐                 │   │
│  │  │Batch 1 │→ │Batch 2 │→ │Batch 3 │→ ...            │   │
│  │  │15 items│  │15 items│  │15 items│                 │   │
│  │  └────────┘  └────────┘  └────────┘                 │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  FINAL SUMMARY                              │
│  ✅ Created: X products                                     │
│  🔄 Updated: Y products                                     │
│  ❌ Errors: Z products                                      │
│  ⏱️  Duration: N seconds                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Concepts

### 1. **Pagination**
The DummyJSON API returns products in pages. We need to fetch all pages sequentially:
- Page 1: `?limit=30&skip=0` → Products 1-30
- Page 2: `?limit=30&skip=30` → Products 31-60
- Page 3: `?limit=30&skip=60` → Products 61-90
- Continue until all products are fetched

### 2. **Batch Processing**
Instead of processing all 194 products at once (which could cause memory issues), we process them in smaller batches of 15:
- Batch 1: Products 1-15
- Batch 2: Products 16-30
- Batch 3: Products 31-45
- Continue until all products are processed

### 3. **Error Handling with Retries**
Network requests can fail. We implement exponential backoff:
- Attempt 1: Immediate
- Attempt 2: Wait 1000ms (1 second)
- Attempt 3: Wait 2000ms (2 seconds)
- Attempt 4: Wait 4000ms (4 seconds)
- If all attempts fail → Throw error

### 4. **Idempotency**
Running the job multiple times should NOT create duplicate products:
- We use `external_id` (DummyJSON product ID) to identify products
- If a product with the same `external_id` exists → UPDATE it
- If it doesn't exist → CREATE it

### 5. **Handle Uniqueness**
Product handles (URL slugs) must be unique:
- Generate handle from product title: `"iPhone 9"` → `"iphone-9"`
- If handle exists, append counter: `"iphone-9-1"`, `"iphone-9-2"`, etc.

---

## 📊 Data Transformation

### DummyJSON Format → Medusa Format

**Input (DummyJSON):**
```json
{
  "id": 1,
  "title": "iPhone 9",
  "description": "An apple mobile...",
  "price": 549,
  "category": "smartphones",
  "thumbnail": "https://...",
  "images": ["https://...", "https://..."]
}
```

**Output (Medusa):**
```json
{
  "title": "iPhone 9",
  "handle": "iphone-9",
  "description": "An apple mobile...",
  "metadata": {
    "external_id": "1",
    "category": "smartphones",
    "thumbnail": "https://..."
  },
  "thumbnail": "https://...",
  "images": [{"url": "https://..."}, {"url": "https://..."}],
  "category_ids": ["cat_01JGXXX..."],
  "variants": [{
    "title": "Default",
    "prices": [{
      "amount": 54900,
      "currency_code": "usd"
    }]
  }]
}
```

**Key Transformations:**
- `price` (549) → `amount` (54900) - Convert to cents
- `images` (string[]) → `images` ({url: string}[]) - Wrap in objects
- `category` (string) → `category_ids` (string[]) - Link to Medusa categories
- Add default variant (Medusa requires at least one variant)

---

## ⚙️ Configuration

### Cron Schedule
```typescript
// Production: Daily at midnight
schedule: "0 0 * * *"

// Testing: Every minute
schedule: "* * * * *"
```

### Constants
```typescript
const PAGE_SIZE = 30        // Products per API page
const BATCH_SIZE = 15       // Products per batch
const MAX_RETRIES = 3       // Maximum retry attempts
const INITIAL_DELAY = 1000  // Initial retry delay (ms)
```

---

## ✅ Success Criteria

The job is considered successful when:

1. ✅ **All products are fetched** from DummyJSON API
2. ✅ **All categories are synced** to Medusa
3. ✅ **Products are created/updated** without duplicates
4. ✅ **No memory spikes** during processing
5. ✅ **Errors are handled gracefully** with retries
6. ✅ **Comprehensive logging** for debugging
7. ✅ **Idempotent** - Can run multiple times safely

---

## 🎓 Learning Outcomes

After understanding this implementation, you'll know how to:

- ✅ Create scheduled jobs in Medusa
- ✅ Handle API pagination effectively
- ✅ Implement batch processing for large datasets
- ✅ Build robust error handling with retries
- ✅ Create idempotent operations
- ✅ Work with Medusa workflows
- ✅ Sync related entities (categories)
- ✅ Optimize for performance and memory

---

**Next**: [02-architecture.md](./02-architecture.md) - Dive into the detailed system architecture
