// src/lib/retry.ts
// Utility for retrying failed HTTP requests with exponential backoff

interface RetryOptions {
    maxRetries?: number
    initialDelayMs?: number
    maxDelayMs?: number
    backoffMultiplier?: number
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
}

/**
 * Fetches a URL with automatic retry logic and exponential backoff
 * 
 * @param url - The URL to fetch
 * @param options - Retry configuration options
 * @returns Parsed JSON response
 * @throws Error if all retries are exhausted
 */
export async function fetchWithRetry<T>(
    url: string,
    options: RetryOptions = {}
): Promise<T> {
    const config = { ...DEFAULT_OPTIONS, ...options }
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`
                )
            }

            return await response.json() as T
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            // Don't retry if this was the last attempt
            if (attempt === config.maxRetries) {
                break
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
                config.maxDelayMs
            )

            console.warn(
                `⚠️  Attempt ${attempt + 1}/${config.maxRetries + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
            )

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }

    throw new Error(
        `Failed after ${config.maxRetries + 1} attempts: ${lastError?.message || "Unknown error"}`
    )
}
