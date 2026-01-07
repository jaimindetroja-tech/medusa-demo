import { MedusaService } from "@medusajs/framework/utils"
import { Review } from "./models/review"

type CreateReviewDTO = {
  product_id: string
  customer_email?: string
  customer_name: string
  rating: number
  comment?: string
  ip_address?: string
}

type FilterableReviewProps = {
  product_id?: string
  status?: "pending" | "approved" | "rejected"
  limit?: number
  offset?: number
  ip_address?: string
}

export default class ReviewModuleService extends MedusaService({
  Review,
}) {
  async createReview(data: CreateReviewDTO) {
    // Check if product exists (we'll add validation later)
    // Check rate limiting by IP
    if (data.ip_address) {
      const recentReviews = await this.checkRecentReviewsByIP(data.ip_address)
      if (recentReviews >= 3) {
        throw new Error("Too many reviews from this IP address recently")
      }
    }

    const review = await this.createReviews({
      ...data,
      status: "pending",
    })

    return review
  }

  async findReviews(filters: FilterableReviewProps = {}) {
    const { product_id, status, limit = 10, offset = 0, ip_address } = filters

    const where: any = {}
    if (product_id) where.product_id = product_id
    if (status) where.status = status
    if (ip_address) where.ip_address = ip_address

    try {
      // Use the correct method signature for listAndCountReviews
      const [reviews, count] = await this.listAndCountReviews(
        where,
        {
          skip: offset,
          take: limit,
        }
      )

      return { reviews, count }
    } catch (error) {
      console.error("Error in findReviews:", error)
      // Return empty result instead of throwing
      return { reviews: [], count: 0 }
    }
  }

  async getReviewById(id: string) {
    return await this.retrieveReview(id)
  }

  async getAverageRating(productId: string) {
    try {
      const { reviews } = await this.findReviews({
        product_id: productId,
        status: "approved",
        limit: 10000, // Get all for accurate calculation
      })

      if (reviews.length === 0) {
        return { average: 0, total: 0, breakdown: {} }
      }

      const total = reviews.length
      const sum = reviews.reduce((acc, review) => acc + review.rating, 0)
      const average = sum / total

      const breakdown = reviews.reduce((acc, review) => {
        acc[review.rating] = (acc[review.rating] || 0) + 1
        return acc
      }, {} as Record<number, number>)

      return { average, total, breakdown }
    } catch (error) {
      console.error("Error in getAverageRating:", error)
      return { average: 0, total: 0, breakdown: {} }
    }
  }

  async updateReviewStatus(id: string, status: "approved" | "rejected", adminId?: string) {
    const updateData: any = {
      id,
      status,
    }

    if (status === "approved") {
      updateData.approved_at = new Date()
      updateData.approved_by = adminId
    }

    const review = await this.updateReviews(updateData)
    return review
  }

  async deleteReview(id: string) {
    return await this.deleteReviews(id)
  }

  async checkRecentReviewsByIP(ip: string, minutes: number = 10) {
    const since = new Date(Date.now() - minutes * 60 * 1000)

    const { reviews } = await this.findReviews({
      ip_address: ip,
    })

    return reviews.filter(review =>
      review.created_at >= since
    ).length
  }
}