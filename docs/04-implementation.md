# 🛠️ Implementation Guide

## 📋 Step-by-Step Implementation

This guide walks you through implementing the product sync job from scratch.

---

## Step 1: Create Utility Functions

### 1.1 Retry Utility (`src/lib/retry.ts`)

**Purpose**: Handle network failures gracefully with exponential backoff

```typescript
// src/lib/retry.ts

interface RetryOptions {
    maxRetries?: number
    initialDelayMs?: number
    maxDelayMs?: number
    backoffMultiplier?: number
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
}

export async function fetchWithRetry<T>(
    url: string,
    options: RetryOptions = {}
): Promise<T> {
    const config = { ...DEFAULT_OPTIONS, ...options }
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`
                )
            }

            return await response.json() as T
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            // Don't retry if this was the last attempt
            if (attempt === config.maxRetries) {
                break
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
                config.maxDelayMs
            )

            console.warn(
                `⚠️  Attempt ${attempt + 1}/${config.maxRetries + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
            )

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }

    throw new Error(
        `Failed after ${config.maxRetries + 1} attempts: ${lastError?.message || "Unknown error"}`
    )
}
```

**Key Points**:
- Generic type `<T>` for type-safe responses
- Exponential backoff: 1s → 2s → 4s → 8s
- Configurable retry parameters
- Detailed error logging

---

### 1.2 Batch Processor (`src/lib/batch-processor.ts`)

**Purpose**: Process large arrays in memory-efficient batches

```typescript
// src/lib/batch-processor.ts

/**
 * Async generator that yields batches of items from an array
 * 
 * @example
 * for await (const batch of batchGenerator(products, 10)) {
 *     await processBatch(batch);
 * }
 */
export async function* batchGenerator<T>(
    items: T[],
    batchSize: number
): AsyncGenerator<T[], void, unknown> {
    for (let i = 0; i < items.length; i += batchSize) {
        yield items.slice(i, i + batchSize)
    }
}
```

**Key Points**:
- Uses async generator (`async function*`)
- Yields batches one at a time
- Memory-efficient (only one batch in memory)
- Works with `for await...of` loops

---

## Step 2: Create Category Sync Workflow

### 2.1 Category Workflow (`src/workflows/sync-categories.ts`)

**Purpose**: Sync categories from external API to Medusa

```typescript
// src/workflows/sync-categories.ts

import {
    createWorkflow,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"

interface CategoryInput {
    name: string
    slug: string
}

interface CategoryResult {
    created: number
    existing: number
    categoryMap: Record<string, string> // slug → id
}

// Step: Sync categories
const syncCategoriesStep = createStep(
    "sync-categories",
    async (input: { categories: CategoryInput[] }, { container }) => {
        const query = container.resolve("query")

        // Get existing product categories
        const { data: existingCategories } = await query.graph({
            entity: "product_category",
            fields: ["id", "name", "handle"],
        })

        // Create map of existing categories
        const existingCategoryMap = new Map<string, string>(
            existingCategories.map((c: any) => [c.handle, c.id])
        )

        // Determine which categories need to be created
        const categoriesToCreate = input.categories.filter(
            (cat) => !existingCategoryMap.has(cat.slug)
        )

        const createdIds: string[] = []

        // Create new categories
        if (categoriesToCreate.length > 0) {
            const { result: categoryResult } = await createProductCategoriesWorkflow(
                container
            ).run({
                input: {
                    product_categories: categoriesToCreate.map((cat) => ({
                        name: cat.name.charAt(0).toUpperCase() + cat.name.slice(1),
                        handle: cat.slug,
                        is_active: true,
                    })),
                },
            })

            // Add created categories to the map
            for (const created of categoryResult) {
                existingCategoryMap.set(created.handle, created.id)
                createdIds.push(created.id)
            }
        }

        // Build the final category map
        const categoryMap: Record<string, string> = {}
        for (const cat of input.categories) {
            const id = existingCategoryMap.get(cat.slug)
            if (id) {
                categoryMap[cat.slug] = id
            }
        }

        const result: CategoryResult = {
            created: categoriesToCreate.length,
            existing: input.categories.length - categoriesToCreate.length,
            categoryMap,
        }

        return new StepResponse(result, { createdIds })
    },
    // Compensation function (rollback)
    async (data, { container }) => {
        if (!data?.createdIds || data.createdIds.length === 0) {
            return
        }

        const { Modules } = await import("@medusajs/framework/utils")
        const productCategoryService = container.resolve(Modules.PRODUCT)

        try {
            await productCategoryService.deleteProductCategories(data.createdIds)
        } catch (error) {
            console.error("Failed to rollback categories:", error)
        }
    }
)

// Workflow: Orchestrate category sync
export const syncCategoriesWorkflow = createWorkflow(
    "sync-categories",
    (input: { categories: CategoryInput[] }) => {
        const result = syncCategoriesStep(input)
        return new WorkflowResponse(result)
    }
)
```

**Key Points**:
- Uses Medusa's workflow SDK
- Checks for existing categories (idempotent)
- Creates only missing categories
- Returns category map (slug → id)
- Includes compensation function for rollback

---

## Step 3: Create Main Sync Job

### 3.1 Product Sync Job (`src/jobs/sync-products.ts`)

**Purpose**: Main orchestrator for product synchronization

```typescript
// src/jobs/sync-products.ts

import { MedusaContainer } from "@medusajs/framework/types"
import { fetchWithRetry } from "../lib/retry"
import { batchGenerator } from "../lib/batch-processor"
import { syncCategoriesWorkflow } from "../workflows/sync-categories"
import { ProductStatus } from "@medusajs/framework/utils"

// ============================================================
// INTERFACES
// ============================================================

interface DummyJSONProduct {
    id: number
    title: string
    description: string
    price: number
    category: string
    thumbnail: string
    images: string[]
}

interface DummyJSONResponse {
    products: DummyJSONProduct[]
    total: number
    skip: number
    limit: number
}

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

// ============================================================
// CONFIGURATION
// ============================================================

const DUMMYJSON_API_URL = "https://dummyjson.com/products"
const PAGE_SIZE = 30
const BATCH_SIZE = 15

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Fetches all products from DummyJSON API with pagination
 */
async function fetchAllProducts(): Promise<DummyJSONProduct[]> {
    const allProducts: DummyJSONProduct[] = []
    let skip = 0
    let hasMore = true

    console.log("📡 Fetching products from DummyJSON API...")

    while (hasMore) {
        const url = `${DUMMYJSON_API_URL}?limit=${PAGE_SIZE}&skip=${skip}`

        try {
            const response = await fetchWithRetry<DummyJSONResponse>(url, {
                maxRetries: 3,
                initialDelayMs: 1000,
            })

            allProducts.push(...response.products)

            console.log(
                `✅ Fetched ${response.products.length} products (${allProducts.length}/${response.total})`
            )

            skip += PAGE_SIZE
            hasMore = allProducts.length < response.total
        } catch (error) {
            console.error(`❌ Failed to fetch products at skip=${skip}:`, error)
            throw error
        }
    }

    console.log(`🎉 Successfully fetched ${allProducts.length} total products`)
    return allProducts
}

/**
 * Transforms DummyJSON product to Medusa product format
 */
function mapToMedusaFormat(product: DummyJSONProduct): MedusaProductInput {
    const rawHandle = product.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

    return {
        title: product.title,
        handle: rawHandle,
        description: product.description,
        metadata: {
            external_id: product.id.toString(),
            category: product.category,
            thumbnail: product.thumbnail,
        },
        thumbnail: product.thumbnail,
        images: product.images.map((url) => ({ url })),
        options: [
            {
                title: "Default Option",
                values: ["Default"],
            },
        ],
        variants: [
            {
                title: "Default",
                prices: [
                    {
                        amount: Math.round(product.price * 100), // Convert to cents
                        currency_code: "usd",
                    },
                ],
                options: {
                    "Default Option": "Default",
                },
            },
        ],
    }
}

// ============================================================
// MAIN JOB
// ============================================================

export default async function syncProductsJob(container: MedusaContainer) {
    const startTime = Date.now()
    console.log("🚀 Starting product sync job...")
    console.log("=".repeat(60))

    try {
        // STEP 1: Fetch all products from DummyJSON API
        const externalProducts = await fetchAllProducts()

        if (externalProducts.length === 0) {
            console.log("ℹ️  No products to sync")
            return
        }

        // STEP 2: Sync categories (Bar Raiser Feature)
        console.log("\n🏷️  Syncing categories...")
        const uniqueCategories = new Set(externalProducts.map((p) => p.category))
        const categoryInputs = Array.from(uniqueCategories).map((cat) => ({
            name: cat,
            slug: cat
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, ""),
        }))

        let categoryMap: Record<string, string> = {}

        try {
            const { result: categoryResult } = await syncCategoriesWorkflow(container).run({
                input: { categories: categoryInputs },
            })
            categoryMap = categoryResult.categoryMap
            console.log(
                `✅ Categories synced: ${categoryResult.created} created, ${categoryResult.existing} existing`
            )
        } catch (error) {
            console.error("⚠️  Category sync failed (continuing with product sync):", error)
        }

        // STEP 3: Get existing products (Idempotency)
        console.log("🔍 Checking for existing products...")
        const query = container.resolve("query")

        const { data: existingProducts } = await query.graph({
            entity: "product",
            fields: ["id", "handle", "metadata"],
        })

        const existingProductMap = new Map(
            existingProducts
                .filter((p) => p.metadata?.external_id)
                .map((p) => [p.metadata!.external_id, p])
        )

        const dbHandles = new Set(existingProducts.map((p) => p.handle))

        console.log(`📊 Found ${existingProductMap.size} existing products in Medusa`)

        // STEP 4: Transform and categorize products
        console.log("\n🔄 Transforming and sorting products...")

        const productsToCreate: MedusaProductInput[] = []
        const productsToUpdate: Array<{ id: string; data: Partial<MedusaProductInput> }> = []

        const usedHandles = new Set<string>()

        for (const externalProduct of externalProducts) {
            const product = mapToMedusaFormat(externalProduct)

            const externalId = externalProduct.id.toString()
            const existing = existingProductMap.get(externalId)

            if (existing) {
                // UPDATE existing product
                product.handle = existing.handle

                productsToUpdate.push({
                    id: existing.id,
                    data: {
                        title: product.title,
                        description: product.description,
                        metadata: product.metadata,
                        thumbnail: product.thumbnail,
                        images: product.images,
                    },
                })
            } else {
                // CREATE new product
                // Ensure unique handle
                let handle = product.handle
                const originalHandle = handle
                let counter = 1

                while (usedHandles.has(handle) || dbHandles.has(handle)) {
                    handle = `${originalHandle}-${counter}`
                    counter++
                }
                usedHandles.add(handle)
                product.handle = handle

                // Link to category
                const categorySlug = externalProduct.category
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "")
                if (categoryMap[categorySlug]) {
                    product.category_ids = [categoryMap[categorySlug]]
                }

                productsToCreate.push(product)
            }
        }

        console.log(`📝 ${productsToCreate.length} products to create`)
        console.log(`🔄 ${productsToUpdate.length} products to update`)

        // STEP 5: Process in batches
        let createdCount = 0
        let updatedCount = 0
        let errorCount = 0

        const { createProductsWorkflow, updateProductsWorkflow } = await import(
            "@medusajs/medusa/core-flows"
        )

        // Process creates
        if (productsToCreate.length > 0) {
            console.log(`\n🔨 Creating products in batches of ${BATCH_SIZE}...`)
            let batchNum = 0

            for await (const batch of batchGenerator(productsToCreate, BATCH_SIZE)) {
                batchNum++
                try {
                    await createProductsWorkflow(container).run({
                        input: { products: batch },
                    })

                    createdCount += batch.length
                    console.log(
                        `✅ Batch ${batchNum}: Created ${batch.length} products (${createdCount}/${productsToCreate.length})`
                    )
                } catch (error) {
                    errorCount += batch.length
                    console.error(`❌ Batch ${batchNum} failed:`, error)
                }
            }
        }

        // Process updates
        if (productsToUpdate.length > 0) {
            console.log(`\n🔄 Updating products in batches of ${BATCH_SIZE}...`)
            let batchNum = 0

            for await (const batch of batchGenerator(productsToUpdate, BATCH_SIZE)) {
                batchNum++
                try {
                    await updateProductsWorkflow(container).run({
                        input: { products: batch },
                    })

                    updatedCount += batch.length
                    console.log(
                        `✅ Batch ${batchNum}: Updated ${batch.length} products (${updatedCount}/${productsToUpdate.length})`
                    )
                } catch (error) {
                    errorCount += batch.length
                    console.error(`❌ Batch ${batchNum} failed:`, error)
                }
            }
        }

        // Final summary
        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log("\n" + "=".repeat(60))
        console.log("🎉 Product sync completed!")
        console.log("=".repeat(60))
        console.log(`✅ Created: ${createdCount}`)
        console.log(`🔄 Updated: ${updatedCount}`)
        console.log(`❌ Errors: ${errorCount}`)
        console.log(`⏱️  Duration: ${duration}s`)
        console.log("=".repeat(60))
    } catch (error) {
        console.error("\n💥 Product sync failed:", error)
        throw error
    }
}

// ============================================================
// JOB CONFIGURATION
// ============================================================

export const config = {
    name: "sync-products",
    schedule: "0 0 * * *", // Daily at midnight
    // schedule: "* * * * *", // For testing: Every minute
}
```

---

## Step 4: Testing

### 4.1 Manual Execution

Test the job manually before scheduling:

```bash
npx medusa exec dist/jobs/sync-products.js
```

### 4.2 Check Results

1. **View products in admin**:
   ```
   http://localhost:9000/app/products
   ```

2. **Check database**:
   ```bash
   npx medusa exec -c "
   const query = container.resolve('query');
   const { data } = await query.graph({
     entity: 'product',
     fields: ['id', 'title', 'handle']
   });
   console.log(data.length, 'products');
   "
   ```

### 4.3 Test Idempotency

Run the job twice and verify no duplicates:

```bash
npx medusa exec dist/jobs/sync-products.js
# Wait for completion
npx medusa exec dist/jobs/sync-products.js
# Should update, not create duplicates
```

---

## Step 5: Enable Scheduling

### 5.1 Update Configuration

In `src/jobs/sync-products.ts`:

```typescript
export const config = {
    name: "sync-products",
    schedule: "0 0 * * *", // Daily at midnight
}
```

### 5.2 Restart Medusa

```bash
npm run dev
```

The job will now run automatically at midnight every day.

---

## 📊 Implementation Checklist

- ✅ **Retry utility** with exponential backoff
- ✅ **Batch processor** for memory efficiency
- ✅ **Category sync workflow** (Bar Raiser)
- ✅ **Main sync job** with all features
- ✅ **Pagination handling** for API
- ✅ **Idempotency** using external_id
- ✅ **Handle uniqueness** enforcement
- ✅ **Error handling** at multiple levels
- ✅ **Comprehensive logging**
- ✅ **Cron scheduling**

---

**Next**: [05-api-reference.md](./05-api-reference.md) - Detailed API documentation
