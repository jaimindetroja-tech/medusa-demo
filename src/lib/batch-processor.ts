// src/lib/batch-processor.ts
// Utility for processing large arrays in smaller batches

/**
 * Async generator that yields batches of items from an array
 * Prevents memory spikes and allows for progressive processing
 * 
 * @param items - Array of items to process
 * @param batchSize - Number of items per batch
 * @yields Batches of items
 * 
 * @example
 * ```typescript
 * for await (const batch of batchGenerator(products, 10)) {
 *     await processBatch(batch);
 * }
 * ```
 */
export async function* batchGenerator<T>(
    items: T[],
    batchSize: number
): AsyncGenerator<T[], void, unknown> {
    for (let i = 0; i < items.length; i += batchSize) {
        yield items.slice(i, i + batchSize)
    }
}
