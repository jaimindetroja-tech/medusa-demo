import { batchProductsWorkflow } from "../workflows/sync-batch"
import { DummyJsonService } from "../services/dummy-json"

// Main Job Configuration
export const config = {
  name: "sync-products",
  schedule: process.env.SYNC_SCHEDULE || "*/30 * * * * *",
}

export default async function syncProductsJob(root: any) {
  const container = root.container || root
  const logger = container.resolve("logger")

  logger.info("🚀 [Sync] Starting daily product sync job...")

  const stats = {
    totalProductsProcessed: 0,
    totalProductsCreated: 0,
    totalProductsUpdated: 0,
    totalCategoriesCreated: 0,
    totalErrors: 0,
    batchesProcessed: 0,
    batchesFailed: 0,
  }

  const BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE || "20")
  const SAFE_MAX = parseInt(process.env.SYNC_SAFE_MAX || "5000")

  try {
    let skip = 0
    let hasMore = true

    while (hasMore && skip < SAFE_MAX) {
      // 1. Fetch
      logger.info(
        `[Sync] Fetching batch (Limit: ${BATCH_SIZE}, Skip: ${skip})...`
      )
      const data = await DummyJsonService.fetchProductsPage(BATCH_SIZE, skip)

      const batch = data.products
      if (!batch || batch.length === 0) {
        hasMore = false
        break
      }

      // 2. Process Batch via Workflow
      logger.info(`[Sync] Processing batch of ${batch.length} products...`)

      try {
        const { result, errors } = await batchProductsWorkflow(container).run({
          input: { products: batch },
          throwOnError: false, // Handle gracefully
        })

        if (errors && errors.length > 0) {
          logger.error(`[Sync] ❌ Batch failed with ${errors.length} errors.`)
          errors.forEach((e) => logger.error(JSON.stringify(e)))
          stats.totalErrors += errors.length
          stats.batchesFailed++
        } else {
          // Extract statistics from workflow result
          const batchStats = result as {
            products: any
            productsCreated: number
            productsUpdated: number
            categoriesCreated: number
          }

          stats.totalProductsCreated += batchStats.productsCreated
          stats.totalProductsUpdated += batchStats.productsUpdated
          stats.totalCategoriesCreated += batchStats.categoriesCreated
          stats.totalProductsProcessed += batch.length
          stats.batchesProcessed++

          // Log batch statistics
          logger.info(`[Sync] ✅ Batch completed successfully:`)
          logger.info(`  - Products Created: ${batchStats.productsCreated}`)
          logger.info(`  - Products Updated: ${batchStats.productsUpdated}`)
          logger.info(`  - Categories Created: ${batchStats.categoriesCreated}`)
        }
      } catch (workflowErr) {
        logger.error(
          `[Sync] ❌ Critical Workflow Error: ${(workflowErr as Error).message}`
        )
        stats.totalErrors++
        stats.batchesFailed++
      }

      // 3. Pagination
      skip += BATCH_SIZE
      if (skip >= data.total) {
        hasMore = false
      }
    }

    // Final summary
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("✅ [Sync] Job completed successfully!")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info(`📊 SYNC STATISTICS:`)
    logger.info(
      `  ├─ Total Products Processed: ${stats.totalProductsProcessed}`
    )
    logger.info(`  ├─ Products Created: ${stats.totalProductsCreated} 🆕`)
    logger.info(`  ├─ Products Updated: ${stats.totalProductsUpdated} 🔄`)
    logger.info(`  ├─ Categories Created: ${stats.totalCategoriesCreated} 📁`)
    logger.info(`  ├─ Batches Processed: ${stats.batchesProcessed}`)
    logger.info(`  ├─ Batches Failed: ${stats.batchesFailed}`)
    logger.info(
      `  └─ Total Errors: ${stats.totalErrors} ${stats.totalErrors > 0 ? "⚠️" : "✓"
      }`
    )
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  } catch (err) {
    logger.error(`❌ [Sync] Job Crashed: ${(err as Error).message}`)
  }
}
