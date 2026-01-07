import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ReviewModuleService } from "../../../../../modules/review/index"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const reviewService = req.scope.resolve("review") as ReviewModuleService
  const { review_id } = req.params

  // Get admin ID from authenticated user context
  const adminId = (req as any).auth?.actor_id || (req as any).auth?.user_id || "admin_user"

  try {
    const review = await reviewService.updateReviewStatus(review_id, "approved", adminId)

    res.json({ review })
  } catch (error) {
    console.error("Error approving review:", error)
    const message = error instanceof Error ? error.message : "Failed to approve review"
    res.status(500).json({ error: message })
  }
}