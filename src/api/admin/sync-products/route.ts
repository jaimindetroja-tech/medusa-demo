import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncProductsJob from "../../../jobs/sync-products"

export async function POST(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const logger = req.scope.resolve("logger")

    try {
        logger.info("Manual trigger of sync products job via Admin API")

        // Run the job synchronously to ensure we wait for completion before responding
        // This allows the UI to refresh immediately after
        await syncProductsJob({ container: req.scope })

        res.json({
            message: "Product sync job completed successfully",
            success: true
        })
    } catch (error) {
        logger.error("Failed to start sync job manually", error)
        res.status(500).json({ error: "Failed to run sync job" })
    }
}
