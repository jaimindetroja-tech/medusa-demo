# Implementation Plan: Production-Grade Product Sync Engine

## objective

Build a robust, scheduled sync engine to import products and categories from DummyJSON into Medusa, handling pagination, batches, retries, and data mapping.

## Architecture

### 1. **Scheduled Job** (`src/jobs/sync-products.ts`)

The entry point for the daily sync.

- **Schedule**: `0 0 * * *` (Daily Midnight).
- **Responsibilities**:
  - Orchestrate the fetching and syncing process.
  - Manage global state (offsets, total processed).
  - Handle high-level error logging.

### 2. **External Client Service** (Internal Helper)

Logic to interact with DummyJSON.

- **Functions**:
  - `fetchWithRetry(url)`: Implements exponential backoff (1s, 2s, 4s) for network resilience.
  - `fetchProducts(limit, skip)`: Uses `fetchWithRetry` to get paginated data.

### 3. **Medusa Workflow** (`src/workflows/sync-batch.ts`)

A workflow designed to handle a _single batch_ of products atomically.

- **Steps**:
  1.  **Sync Categories Step**:
      - Extract unique categories from the batch.
      - Check existence in Medusa (`listProductCategories`).
      - Create missing categories.
      - Return a map of `Category Name -> Category ID`.
  2.  **Prepare Product Data Step**:
      - Map DummyJSON fields to Medusa `CreateProductDTO` / `UpdateProductDTO`.
      - Generate deterministic handles (`kebab-case`).
      - Check which products already exist in Medusa (by handle/external_id).
      - Separate into `create` and `update` buckets.
  3.  **Upsert Products Step**:
      - Call `createProducts` for new items.
      - Call `updateProducts` for existing items.
  4.  **Link Categories Step**:
      - Associate the products with their respective Category IDs.

## Detailed Implementation Steps

### Step 1: Client & Helpers

- Implement `fetchWithRetry` mechanism inside the job or a utility file.
- Implement `mapToMedusaFormat` transforming DummyJSON structure to Medusa objects.
  - **Mapping**:
    - `title` -> `title`
    - `description` -> `description`
    - `price` -> Default Variant Price
    - `images` -> Product Images
    - `category` -> Used for Category lookup

### Step 2: workflows

Create `src/workflows/sync-batch.ts`.

- **`syncCategoriesStep`**:
  - Input: Array of category strings.
  - Output: Map of { name: id }.
- **`batchProductsWorkflow`**:
  - Input: Array of DummyJSON products.
  - Logic:
    - Resolve categories.
    - Transform products (injecting Category IDs).
    - Batch create/update.

### Step 3: Main Job Logic

- Initialize `skip = 0`, `limit = 20`.
- **Loop**:
  - Fetch page.
  - If empty, break.
  - Execute `batchProductsWorkflow`.
  - Log success/failure.
  - `skip += limit`.
- **Error Handling**:
  - If a batch fails, log detailed error but continue to next batch (or retry batch once).

## Success Criteria Checklist

- [ ] Job runs via `npx medusa exec ...`
- [ ] Retries on network failure.
- [ ] Pagination fetches all 100 products.
- [ ] Categories are created and linked.
- [ ] Idempotency: Re-running does not create duplicates.

## file Structure

- `src/jobs/sync-products.ts`
- `src/workflows/sync-batch.ts` (New file for the workflow)
