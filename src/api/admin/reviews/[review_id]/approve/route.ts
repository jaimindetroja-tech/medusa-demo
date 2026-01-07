import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ReviewModuleService } from "../../../../../modules/review/index"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const reviewService = req.scope.resolve("review") as ReviewModuleService
  const { review_id } = req.params
  // TODO: Get admin ID from auth context
  const adminId = "admin_user"

  try {
    const review = await reviewService.updateReviewStatus(review_id, "approved", adminId)

    res.json({ review })
  } catch (error) {
    console.error("Error approving review:", error)
    res.status(500).json({ error: "Failed to approve review" })
  }
}