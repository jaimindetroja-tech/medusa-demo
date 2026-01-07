// src/jobs/sync-products.ts
// Production-ready product sync job from DummyJSON API
import { MedusaContainer } from "@medusajs/framework/types"
import { fetchWithRetry } from "../lib/retry"
import { batchGenerator } from "../lib/batch-processor"
import { syncCategoriesWorkflow } from "../workflows/sync-categories"
import { ProductStatus } from "@medusajs/framework/utils"

/**
 * DummyJSON Product Response Structure
 */
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

/**
 * Medusa Product Format
 */
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

const DUMMYJSON_API_URL = "https://dummyjson.com/products"
const PAGE_SIZE = 30
const BATCH_SIZE = 15

/**
 * Fetches all products from DummyJSON API with pagination
 * Handles network errors with automatic retries
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
 * Maps external schema to Medusa's expected structure
 */
function mapToMedusaFormat(product: DummyJSONProduct): MedusaProductInput {
    const rawHandle = product.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

    return {
        title: product.title,
        handle: rawHandle, // Handle uniqueness is managed in the main job function
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

/**
 * Main sync job that orchestrates the product sync process
 * 
 * FEATURES:
 * - Pagination: Handles all pages from DummyJSON API
 * - Batch Processing: Processes 15 products at a time to avoid memory spikes
 * - Error Handling: Retries failed requests with exponential backoff
 * - Idempotency: Uses external_id to prevent duplicate products
 * - Category Sync: Syncs categories as a bar raiser feature
 * - Logging: Comprehensive progress and error logging
 */
export default async function syncProductsJob(container: MedusaContainer) {
    const startTime = Date.now()
    console.log("🚀 Starting product sync job...")
    console.log("=".repeat(60))

    try {
        // Step 1: Fetch all products from DummyJSON API©
        const externalProducts = await fetchAllProducts()

        // Ensure unique handles

        // We will initialize dbHandles later, so we need a way to check it.
        // Actually, we should transform AFTER fetching existing products to know what handles are taken.
        // But we need handles to check duplicates. 
        // Let's move the transformation step AFTER fetching existing products.

        if (externalProducts.length === 0) {
            console.log("ℹ️  No products to sync")
            return
        }

        // Step 1.5: Extract and sync categories (Bar Raiser Feature)
        console.log("\n🏷️  Syncing categories...")
        const uniqueCategories = new Set(externalProducts.map((p) => p.category))
        const categoryInputs = Array.from(uniqueCategories).map((cat) => ({
            name: cat,
            slug: cat
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, ""),
        }))

        // categoryMap will store slug -> category_id mapping
        let categoryMap: Record<string, string> = {}

        try {
            const { result: categoryResult } = await syncCategoriesWorkflow(container).run({
                input: { categories: categoryInputs },
            })
            categoryMap = categoryResult.categoryMap
            console.log(
                `✅ Categories synced: ${categoryResult.created} created, ${categoryResult.existing} existing`
            )
            console.log(`📂 Category map: ${Object.keys(categoryMap).length} categories mapped`)
        } catch (error) {
            console.error("⚠️  Category sync failed (continuing with product sync):", error)
            // Don't fail the entire job if category sync fails
        }

        // Step 3: Get existing products from Medusa to check for duplicates (idempotency)
        console.log("🔍 Checking for existing products...")
        const query = container.resolve("query")

        const { data: existingProducts } = await query.graph({
            entity: "product",
            fields: ["id", "handle", "metadata"],
        })

        // Create a map of external_id -> product for quick lookup
        const existingProductMap = new Map(
            existingProducts
                .filter((p) => p.metadata?.external_id)
                .map((p) => [p.metadata!.external_id, p])
        )

        // Create a set of all existing handles in DB to prevent collisions
        const dbHandles = new Set(existingProducts.map((p) => p.handle))

        console.log(`📊 Found ${existingProductMap.size} existing products in Medusa`)

        // Step 2 & 4: Transform and separate products
        console.log("\n🔄 Transforming and sorting products...")

        const productsToCreate: MedusaProductInput[] = []
        const productsToUpdate: Array<{ id: string; data: Partial<MedusaProductInput> }> = []

        const usedHandles = new Set<string>()

        for (const externalProduct of externalProducts) {
            const product = mapToMedusaFormat(externalProduct)

            // Handle uniqueness logic
            let handle = product.handle
            const originalHandle = handle
            let counter = 1

            // Check against:
            // 1. Currently processing batch (usedHandles)
            // 2. Database handles (dbHandles) - BUT only if it's a NEW product (not an update)

            const externalId = externalProduct.id.toString()
            const existing = existingProductMap.get(externalId)

            if (existing) {
                // If updating, we keep the existing handle unless we explicitly want to update it.
                // Usually better to keep existing handle to avoid breaking URLs.
                // But mapToMedusaFormat generates a new handle.
                // Let's use the EXISTING handle from DB for updates to be safe.
                product.handle = existing.handle

                productsToUpdate.push({
                    id: existing.id,
                    data: {
                        title: product.title,
                        description: product.description,
                        metadata: product.metadata,
                        thumbnail: product.thumbnail,
                        images: product.images,
                        // Don't update handle to avoid breaking links
                    },
                })
            } else {
                // For new products, ensure handle is unique against DB and current batch
                while (usedHandles.has(handle) || dbHandles.has(handle)) {
                    handle = `${originalHandle}-${counter}`
                    counter++
                }
                usedHandles.add(handle)
                product.handle = handle

                // Add category_id if category exists in map
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

        // Step 5: Process in batches to avoid memory issues
        let createdCount = 0
        let updatedCount = 0
        let errorCount = 0

        // Import workflows
        const { createProductsWorkflow, updateProductsWorkflow } = await import(
            "@medusajs/medusa/core-flows"
        )

        // Process creates in batches
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
                    // Continue with next batch instead of failing entire sync
                }
            }
        }

        // Process updates in batches
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
                    // Continue with next batch instead of failing entire sync
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

export const config = {
    name: "sync-products",
    // schedule: "0 0 * * *", // Production: Daily at midnight (00:00)
    schedule: "* * * * *", // Testing: Every 1 minute
}
