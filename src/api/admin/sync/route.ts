import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncProductsJob from "../../../jobs/sync-products"

// In-memory sync status (in production, use Redis or database)
let syncStatus = {
    isRunning: false,
    lastRun: null as Date | null,
    lastStatus: "idle" as "idle" | "running" | "success" | "error",
    lastError: null as string | null,
    lastDuration: null as number | null,
    productsCreated: 0,
    productsUpdated: 0,
    errors: 0,
}

/**
 * GET /admin/sync/status
 * Get current sync status
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
    try {
        res.json({
            status: "success",
            data: {
                isRunning: syncStatus.isRunning,
                lastRun: syncStatus.lastRun,
                lastStatus: syncStatus.lastStatus,
                lastError: syncStatus.lastError,
                lastDuration: syncStatus.lastDuration,
                stats: {
                    created: syncStatus.productsCreated,
                    updated: syncStatus.productsUpdated,
                    errors: syncStatus.errors,
                },
            },
        })
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
        })
    }
}

/**
 * POST /admin/sync/trigger
 * Manually trigger product sync job
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    try {
        // Check if sync is already running
        if (syncStatus.isRunning) {
            return res.status(409).json({
                status: "error",
                message: "Sync job is already running",
                data: {
                    startedAt: syncStatus.lastRun,
                },
            })
        }

        // Update status to running
        syncStatus.isRunning = true
        syncStatus.lastRun = new Date()
        syncStatus.lastStatus = "running"
        syncStatus.lastError = null

        // Run the job in the background
        const startTime = Date.now()

        syncProductsJob(req.scope)
            .then(() => {
                // Success
                syncStatus.isRunning = false
                syncStatus.lastStatus = "success"
                syncStatus.lastDuration = (Date.now() - startTime) / 1000
                console.log("✅ Manual sync completed successfully")
            })
            .catch((error) => {
                // Error
                syncStatus.isRunning = false
                syncStatus.lastStatus = "error"
                syncStatus.lastError = error instanceof Error ? error.message : "Unknown error"
                syncStatus.lastDuration = (Date.now() - startTime) / 1000
                console.error("❌ Manual sync failed:", error)
            })

        // Return immediate response
        res.json({
            status: "success",
            message: "Sync job triggered successfully",
            data: {
                startedAt: syncStatus.lastRun,
                checkStatusAt: "/admin/sync/status",
            },
        })
    } catch (error) {
        syncStatus.isRunning = false
        syncStatus.lastStatus = "error"
        syncStatus.lastError = error instanceof Error ? error.message : "Unknown error"

        res.status(500).json({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
        })
    }
}
