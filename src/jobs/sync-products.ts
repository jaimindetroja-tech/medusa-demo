import { DummyJsonService } from "../services/dummy-json"
import {
  processAllBatchesInParallel,
  logJobSummary,
  SyncStats
} from "../utils/product-sync-helpers"

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------
export const config = {
  name: "sync-products",
  schedule: process.env.SYNC_SCHEDULE || "*/30 * * * * *",
}

// -----------------------------------------------------------------------------
// MAIN JOB
// -----------------------------------------------------------------------------
export default async function syncProductsJob(root: any) {
  const container = root.container || root
  const logger = container.resolve("logger")

  // Config from environment
  const BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE || "20")
  const SAFE_MAX = parseInt(process.env.SYNC_SAFE_MAX || "5000")
  const CONCURRENCY = parseInt(process.env.SYNC_CONCURRENCY || "5")

  logger.info("🚀 [Sync] Starting daily product sync job...")
  logger.info(`[Sync] Config: BatchSize=${BATCH_SIZE}, SafeMax=${SAFE_MAX}, Concurrency=${CONCURRENCY}`)

  const stats: SyncStats = {
    totalProductsProcessed: 0,
    totalProductsCreated: 0,
    totalProductsUpdated: 0,
    totalCategoriesCreated: 0,
    totalErrors: 0,
    batchesProcessed: 0,
    batchesFailed: 0,
  }

  try {
    // 1. Initial Fetch to get total count
    logger.info(`[Sync] Fetching initial info...`)
    const initialData = await DummyJsonService.fetchProductsPage(1, 0)
    const total = initialData.total
    const realTotal = Math.min(total, SAFE_MAX)

    logger.info(`[Sync] Total products to sync: ${realTotal}`)

    // 2. Process ALL batches in TRUE PARALLEL
    // Multiple workers run simultaneously, each fetching and processing independently
    await processAllBatchesInParallel(
      realTotal,
      BATCH_SIZE,
      CONCURRENCY,
      container,
      logger,
      stats
    )

    // 3. Final Summary
    logJobSummary(logger, stats)
  } catch (err) {
    logger.error(`❌ [Sync] Job Crashed: ${(err as Error).message}`)
  }
}
