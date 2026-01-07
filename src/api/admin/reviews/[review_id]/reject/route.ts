import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ReviewModuleService } from "../../../../../modules/review/index"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const reviewService = req.scope.resolve("review") as ReviewModuleService
  const { review_id } = req.params

  try {
    const review = await reviewService.updateReviewStatus(review_id, "rejected")

    res.json({ review })
  } catch (error) {
    console.error("Error rejecting review:", error)
    const message = error instanceof Error ? error.message : "Failed to reject review"
    res.status(500).json({ error: message })
  }
}