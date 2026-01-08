import { delay } from "../utils/common"

export interface DummyProduct {
    id: number
    title: string
    description: string
    price: number
    category: string
    thumbnail: string
    images: string[]
    brand?: string
    rating?: number
}

export interface DummyResponse {
    products: DummyProduct[]
    total: number
    skip: number
    limit: number
}

export class DummyJsonService {
    private static API_URL = process.env.SYNC_API_URL || "https://dummyjson.com/products"
    private static MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES || "3")
    private static RATE_LIMIT_DELAY = parseInt(process.env.SYNC_RATE_LIMIT_DELAY || "500") // ms between requests

    /**
     * Fetch a single page of products from the DummyJSON API.
     * Includes a small delay before each request to prevent rate limiting.
     */
    static async fetchProductsPage(limit: number, skip: number): Promise<DummyResponse> {
        // Add delay before request to prevent rate limiting
        await delay(this.RATE_LIMIT_DELAY)

        const url = `${this.API_URL}?limit=${limit}&skip=${skip}`
        const response = await this.fetchWithRetry(url)
        return (await response.json()) as DummyResponse
    }

    /**
     * Robust fetch with exponential backoff.
     * Handles 429 (rate limit) with longer delays.
     */
    private static async fetchWithRetry(url: string, retries = this.MAX_RETRIES): Promise<Response> {
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url)

                // Handle rate limiting specifically
                if (response.status === 429) {
                    const retryAfter = response.headers.get("Retry-After")
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * attempt

                    if (attempt < retries) {
                        await delay(waitTime)
                        continue
                    }
                    throw new Error(`HTTP 429: Rate limited after ${retries} attempts`)
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }

                return response
            } catch (err) {
                lastError = err as Error
                if (attempt < retries) {
                    // Exponential backoff: 1s, 2s, 4s...
                    const backoff = 1000 * Math.pow(2, attempt - 1)
                    await delay(backoff)
                }
            }
        }
        throw lastError || new Error("Unknown network error")
    }
}
