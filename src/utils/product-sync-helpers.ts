import { DummyJsonService } from "../services/dummy-json"
import { batchProductsWorkflow } from "../workflows/sync-batch"

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------
export interface SyncStats {
    totalProductsProcessed: number
    totalProductsCreated: number
    totalProductsUpdated: number
    totalCategoriesCreated: number
    totalErrors: number
    batchesProcessed: number
    batchesFailed: number
}

interface BatchTask {
    skip: number
    batchSize: number
}

interface ProcessContext {
    container: any
    logger: any
    stats: SyncStats
    totalTasks: number
    completedCount: { value: number }
}

// -----------------------------------------------------------------------------
// TRUE PARALLEL PROCESSING - Main Entry Point
// -----------------------------------------------------------------------------

/**
 * Process all batches in TRUE parallel with concurrency limit.
 * 
 * How it works:
 * 1. Generate all batch tasks
 * 2. Split tasks into N groups (one per worker)
 * 3. Each worker processes its assigned tasks
 * 4. All workers run simultaneously
 */
export function processAllBatchesInParallel(
    totalProducts: number,
    batchSize: number,
    concurrencyLimit: number,
    container: any,
    logger: any,
    stats: SyncStats
): Promise<void> {

    // Step 1: Generate all batch tasks
    const allTasks: BatchTask[] = generateBatchTasks(totalProducts, batchSize)

    logger.info(`[Sync] Created ${allTasks.length} batch tasks. Running ${concurrencyLimit} workers in parallel...`)

    // Step 2: Create shared context
    const context: ProcessContext = {
        container,
        logger,
        stats,
        totalTasks: allTasks.length,
        completedCount: { value: 0 },
    }

    // Step 3: Distribute tasks to workers (round-robin distribution)
    const workerTaskGroups: BatchTask[][] = distributeTasksToWorkers(allTasks, concurrencyLimit)

    // Step 4: Start all workers in parallel - each worker gets its own task list
    const workerPromises = workerTaskGroups.map((tasks, index) =>
        processTaskList(tasks, context, index + 1)
    )

    // Step 5: Wait for all workers
    return Promise.all(workerPromises).then(() => {
        logger.info(`[Sync] All ${concurrencyLimit} workers finished.`)
    })
}

// -----------------------------------------------------------------------------
// TASK GENERATION & DISTRIBUTION
// -----------------------------------------------------------------------------

/**
 * Generates batch tasks based on total products and batch size.
 */
function generateBatchTasks(totalProducts: number, batchSize: number): BatchTask[] {
    const tasks: BatchTask[] = []
    for (let skip = 0; skip < totalProducts; skip += batchSize) {
        tasks.push({ skip, batchSize })
    }
    return tasks
}

/**
 * Distributes tasks across workers using round-robin.
 * Example: 10 tasks, 3 workers → Worker1: [0,3,6,9], Worker2: [1,4,7], Worker3: [2,5,8]
 */
function distributeTasksToWorkers(tasks: BatchTask[], workerCount: number): BatchTask[][] {
    const groups: BatchTask[][] = []

    for (let i = 0; i < workerCount; i++) {
        groups.push([])
    }

    tasks.forEach((task, index) => {
        const workerIndex = index % workerCount
        groups[workerIndex].push(task)
    })

    return groups
}

// -----------------------------------------------------------------------------
// TASK LIST PROCESSING - Sequential chain for each worker
// -----------------------------------------------------------------------------

/**
 * Processes a list of tasks sequentially using .then() chaining.
 * Uses reduce to build a promise chain - NO recursion.
 */
function processTaskList(
    tasks: BatchTask[],
    context: ProcessContext,
    workerId: number
): Promise<void> {
    const { logger } = context

    if (tasks.length === 0) {
        return Promise.resolve()
    }

    logger.info(`[Sync] Worker ${workerId}: Starting with ${tasks.length} tasks`)

    // Build promise chain: task1.then(() => task2).then(() => task3)...
    return tasks.reduce(
        (promiseChain, task) => {
            return promiseChain.then(() => processSingleTask(task, context, workerId))
        },
        Promise.resolve()
    )
}

// -----------------------------------------------------------------------------
// SINGLE TASK PROCESSING
// -----------------------------------------------------------------------------

/**
 * Fetches and processes a single batch task.
 */
function processSingleTask(
    task: BatchTask,
    context: ProcessContext,
    workerId: number
): Promise<void> {
    const { skip, batchSize } = task
    const { logger, container, stats, totalTasks, completedCount } = context

    logger.info(`[Sync] Worker ${workerId}: Fetching batch (Skip: ${skip})...`)

    return DummyJsonService.fetchProductsPage(batchSize, skip)
        .then((data) => processProductBatch(data.products, skip, context, workerId))
        .catch((err) => handleFetchError(err, skip, workerId, context))
}

/**
 * Processes products through the workflow.
 */
function processProductBatch(
    products: any[],
    skip: number,
    context: ProcessContext,
    workerId: number
): Promise<void> {
    const { logger, container, stats, totalTasks, completedCount } = context

    if (!products || products.length === 0) {
        return Promise.resolve()
    }

    logger.info(`[Sync] Worker ${workerId}: Processing ${products.length} products (Skip: ${skip})...`)

    return batchProductsWorkflow(container)
        .run({
            input: { products },
            throwOnError: false,
        })
        .then(({ result, errors }) => {
            completedCount.value++
            updateStatsFromResult(result, errors, products.length, skip, workerId, context)
        })
}

// -----------------------------------------------------------------------------
// STATS & ERROR HANDLERS
// -----------------------------------------------------------------------------

/**
 * Updates stats based on workflow result.
 */
function updateStatsFromResult(
    result: any,
    errors: any[],
    batchLength: number,
    skip: number,
    workerId: number,
    context: ProcessContext
): void {
    const { logger, stats, totalTasks, completedCount } = context

    if (errors && errors.length > 0) {
        logger.error(`[Sync] Worker ${workerId}: ❌ Batch (Skip: ${skip}) failed with ${errors.length} errors.`)
        errors.forEach((e: any) => logger.error(JSON.stringify(e)))
        stats.totalErrors += errors.length
        stats.batchesFailed++
    } else {
        const batchStats = result as {
            productsCreated: number
            productsUpdated: number
            categoriesCreated: number
        }
        stats.totalProductsCreated += batchStats.productsCreated
        stats.totalProductsUpdated += batchStats.productsUpdated
        stats.totalCategoriesCreated += batchStats.categoriesCreated
        stats.totalProductsProcessed += batchLength
        stats.batchesProcessed++

        logger.info(
            `[Sync] Worker ${workerId}: ✅ Batch (Skip: ${skip}) done. [${completedCount.value}/${totalTasks}] (New: ${batchStats.productsCreated}, Updated: ${batchStats.productsUpdated})`
        )
    }
}

/**
 * Handles fetch-level errors.
 */
function handleFetchError(
    err: Error,
    skip: number,
    workerId: number,
    context: ProcessContext
): void {
    const { logger, stats, completedCount } = context

    completedCount.value++
    logger.error(`[Sync] Worker ${workerId}: ❌ Fetch error (Skip: ${skip}): ${err.message}`)
    stats.totalErrors++
    stats.batchesFailed++
}

// -----------------------------------------------------------------------------
// JOB SUMMARY
// -----------------------------------------------------------------------------

/**
 * Logs the final job summary.
 */
export function logJobSummary(logger: any, stats: SyncStats): void {
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("✅ [Sync] Job completed successfully!")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info(`📊 SYNC STATISTICS:`)
    logger.info(`  ├─ Total Products Processed: ${stats.totalProductsProcessed}`)
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
}
