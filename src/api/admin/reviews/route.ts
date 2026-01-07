import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ReviewModuleService } from "../../../modules/review/index"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const reviewService = req.scope.resolve("review") as ReviewModuleService
  const { status, product_id, limit = 20, offset = 0 } = req.query

  try {
    const filters: any = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    }

    if (status && status !== "all") {
      filters.status = status
    }

    if (product_id) {
      filters.product_id = product_id
    }

    const { reviews, count } = await reviewService.findReviews(filters)

    res.json({
      reviews,
      count,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    })
  } catch (error) {
    console.error("Error fetching reviews:", error)
    res.status(500).json({ error: "Failed to fetch reviews" })
  }
}