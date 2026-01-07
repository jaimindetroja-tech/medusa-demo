import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ReviewModuleService } from "../../../../../../modules/review/index"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const reviewService = req.scope.resolve("review") as ReviewModuleService
  const { product_id } = req.params

  try {
    const stats = await reviewService.getAverageRating(product_id)

    res.json({
      product_id,
      average_rating: stats.average,
      total_reviews: stats.total,
      rating_breakdown: stats.breakdown,
    })
  } catch (error) {
    console.error("Error fetching average rating:", error)
    res.status(500).json({ error: "Failed to fetch average rating" })
  }
}