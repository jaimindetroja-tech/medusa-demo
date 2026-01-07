import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ReviewModuleService } from "../../../../modules/review/index"

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const reviewService = req.scope.resolve("review") as ReviewModuleService
  const { review_id } = req.params

  try {
    await reviewService.deleteReview(review_id)

    res.json({ id: review_id, deleted: true })
  } catch (error) {
    console.error("Error deleting review:", error)
    res.status(500).json({ error: "Failed to delete review" })
  }
}