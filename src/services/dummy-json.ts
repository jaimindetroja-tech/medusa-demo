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
    private static MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES || "2")

    /**
     * Fetch a single page of products from the DummyJSON API
     */
    static async fetchProductsPage(limit: number, skip: number): Promise<DummyResponse> {
        const url = `${this.API_URL}?limit=${limit}&skip=${skip}`
        const response = await this.fetchWithRetry(url)
        return (await response.json()) as DummyResponse
    }

    /**
     * Robust fetch with exponential backoff
     */
    private static async fetchWithRetry(url: string, retries = this.MAX_RETRIES): Promise<Response> {
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url)
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }
                return response
            } catch (err) {
                lastError = err as Error
                if (attempt < retries) {
                    const backoff = 1000 * Math.pow(2, attempt - 1)
                    await delay(backoff)
                }
            }
        }
        throw lastError || new Error("Unknown network error")
    }
}
