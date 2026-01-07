import { ExecArgs } from "@medusajs/framework/types"
import syncProductsJob from "../jobs/sync-products"

export default async function ({ container }: ExecArgs) {
    console.log("🚀 Starting manual sync from script...")
    try {
        await syncProductsJob(container)
        console.log("✅ Manual sync finished successfully")
    } catch (error) {
        console.error("❌ Manual sync failed:", error)
        process.exit(1)
    }
}
