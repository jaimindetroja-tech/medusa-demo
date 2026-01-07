import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import syncProductsJob from "../../../jobs/sync-products"



// POST /admin/sync/trigger - Manually trigger sync
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    try {
        // Run the job in the background (don't await)
        syncProductsJob(req.scope).catch((error) => {
            console.error("Manual sync failed:", error)
        })

        res.json({
            status: "success",
            message: "Sync job triggered successfully",
        })
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message,
        })
    }
}
