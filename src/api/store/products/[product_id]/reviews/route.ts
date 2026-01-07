import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ReviewModuleService } from "../../../../../modules/review/index"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const reviewService = req.scope.resolve("review") as ReviewModuleService
  const { product_id } = req.params
  const { rating, comment, customer_name, customer_email } = req.body as any

  // Basic validation
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" })
  }

  if (!customer_name || customer_name.length < 2) {
    return res.status(400).json({ error: "Customer name is required and must be at least 2 characters" })
  }

  // Get client IP (simplified)
  const ip_address = req.headers['x-forwarded-for'] as string ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress

  try {
    const review = await reviewService.createReview({
      product_id,
      customer_name,
      customer_email,
      rating,
      comment,
      ip_address,
    })

    res.status(201).json({ review })
  } catch (error) {
    console.error("Error creating review:", error)
    res.status(500).json({ error: "Failed to create review" })
  }
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const reviewService = req.scope.resolve("review") as ReviewModuleService
  const { product_id } = req.params
  const { limit = 10, offset = 0 } = req.query

  try {
    const { reviews, count } = await reviewService.findReviews({
      product_id,
      status: "approved",
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    })

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