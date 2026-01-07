import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { slugify } from "../utils/common"
import { DummyProduct } from "../services/dummy-json"

export type BatchWorkflowInput = {
  products: DummyProduct[]
}

export type SyncStatistics = {
  categoriesCreated: number
  productsCreated: number
  productsUpdated: number
  errors: number
}

/*
 * Step 1: Sync Categories
 * Ensures all categories from the batch exist in Medusa.
 */
export const syncCategoriesStep = createStep(
  "sync-categories-step",
  async (input: { products: DummyProduct[] }, { container }) => {
    const categoryNames = input.products.map((p) => p.category)
    const productModule = container.resolve(Modules.PRODUCT)
    const uniqueNames = [...new Set(categoryNames)]
    const handles = uniqueNames.map(slugify)

    // Find existing
    const existing = await productModule.listProductCategories(
      { handle: handles },
      { select: ["id", "name", "handle"] }
    )

    const existingMap = new Map(existing.map((c) => [c.handle, c.id]))
    const nameToId: Record<string, string> = {}
    const toCreate: any[] = []

    // Prepare missing
    for (const name of uniqueNames) {
      const handle = slugify(name)
      if (existingMap.has(handle)) {
        nameToId[name] = existingMap.get(handle)!
      } else {
        toCreate.push({
          name,
          handle,
          is_active: true,
          is_internal: false,
        })
      }
    }

    // Create missing
    if (toCreate.length > 0) {
      const created = await productModule.createProductCategories(toCreate)
      created.forEach((c) => {
        nameToId[c.name] = c.id
      })
    }

    return new StepResponse({
      categoryMap: nameToId,
      categoriesCreated: toCreate.length,
    })
  }
)

/*
 * Step 2: Upsert Products
 * Creates or updates products based on the external data.
 */
export const upsertProductsStep = createStep(
  "upsert-products-step",
  async (
    input: {
      products: DummyProduct[]
      categoryData: {
        categoryMap: Record<string, string>
        categoriesCreated: number
      }
    },
    { container }
  ) => {
    const productModule = container.resolve(Modules.PRODUCT)
    const { products, categoryData } = input
    const categoryMap = categoryData.categoryMap

    // Resolve Handles & Deduplicate
    const resolvedProducts: (DummyProduct & { handle: string })[] = []
    const seenHandles = new Set<string>()

    for (const p of products) {
      let handle = slugify(p.title)
      if (seenHandles.has(handle)) {
        handle = `${handle}-${p.id}`
      }
      seenHandles.add(handle)
      resolvedProducts.push({ ...p, handle })
    }

    // Identify existing to get IDs
    const handles = resolvedProducts.map((p) => p.handle)
    const existingProducts = await productModule.listProducts(
      { handle: handles },
      { select: ["id", "handle"] }
    )
    const handleToId = new Map(existingProducts.map((p) => [p.handle, p.id]))

    // Track statistics
    let productsCreated = 0
    let productsUpdated = 0

    // Map payload
    const upsertPayload = resolvedProducts.map((p) => {
      const existingId = handleToId.get(p.handle)
      const categoryId = categoryMap[p.category]

      // Track if this is a create or update
      if (existingId) {
        productsUpdated++
      } else {
        productsCreated++
      }

      return {
        id: existingId, // exists ? update : create
        title: p.title,
        handle: p.handle,
        description: p.description,
        thumbnail: p.thumbnail,
        images: p.images.map((url) => ({ url })),
        categories: categoryId ? [{ id: categoryId }] : [],
        variants: [
          {
            title: "Default",
            prices: [
              {
                currency_code: "usd",
                amount: p.price * 100,
              },
            ],
            options: { "Default Option": "Default Value" },
          },
        ],
        options: [{ title: "Default Option", values: ["Default Value"] }],
        metadata: {
          external_id: p.id.toString(),
          brand: p.brand,
        },
        status: "published" as const, // Cast to literal
      }
    })

    // Exec Upsert
    const result = await productModule.upsertProducts(upsertPayload)

    return new StepResponse({
      products: result,
      productsCreated,
      productsUpdated,
      categoriesCreated: categoryData.categoriesCreated,
    })
  }
)

/*
 * Workflow: Batch Products Workflow
 * Orchestrates the category sync and product upsert.
 */
export const batchProductsWorkflow = createWorkflow(
  "batch-products-workflow",
  (input: BatchWorkflowInput) => {
    const categoryData = syncCategoriesStep({ products: input.products })

    const result = upsertProductsStep({
      products: input.products,
      categoryData,
    })

    return new WorkflowResponse(result)
  }
)
