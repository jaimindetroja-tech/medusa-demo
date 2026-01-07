// src/workflows/sync-categories.ts
// Workflow to sync categories from DummyJSON API to Medusa's built-in product categories
import {
    createWorkflow,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"

interface CategoryInput {
    name: string
    slug: string
}

interface CategoryResult {
    created: number
    existing: number
    categoryMap: Record<string, string> // slug -> id
}

// Step: Sync categories using Medusa's built-in product categories
const syncCategoriesStep = createStep(
    "sync-categories",
    async (input: { categories: CategoryInput[] }, { container }) => {
        const query = container.resolve("query")

        // Get existing product categories from Medusa
        const { data: existingCategories } = await query.graph({
            entity: "product_category",
            fields: ["id", "name", "handle"],
        })

        // Create a map of existing category handles (slugs) to IDs
        const existingCategoryMap = new Map<string, string>(
            existingCategories.map((c: any) => [c.handle, c.id])
        )

        // Determine which categories need to be created
        const categoriesToCreate = input.categories.filter(
            (cat) => !existingCategoryMap.has(cat.slug)
        )

        const createdIds: string[] = []

        // Create new categories using Medusa's built-in workflow
        if (categoriesToCreate.length > 0) {
            const { result: categoryResult } = await createProductCategoriesWorkflow(
                container
            ).run({
                input: {
                    product_categories: categoriesToCreate.map((cat) => ({
                        name: cat.name.charAt(0).toUpperCase() + cat.name.slice(1), // Capitalize first letter
                        handle: cat.slug,
                        is_active: true,
                    })),
                },
            })

            // Add created categories to the map
            for (const created of categoryResult) {
                existingCategoryMap.set(created.handle, created.id)
                createdIds.push(created.id)
            }
        }

        // Build the final category map (slug -> id)
        const categoryMap: Record<string, string> = {}
        for (const cat of input.categories) {
            const id = existingCategoryMap.get(cat.slug)
            if (id) {
                categoryMap[cat.slug] = id
            }
        }

        const result: CategoryResult = {
            created: categoriesToCreate.length,
            existing: input.categories.length - categoriesToCreate.length,
            categoryMap,
        }

        return new StepResponse(result, { createdIds })
    },
    // Compensation function (rollback)
    async (data, { container }) => {
        if (!data?.createdIds || data.createdIds.length === 0) {
            return
        }

        // Note: Medusa doesn't have a built-in deleteProductCategoriesWorkflow
        // So we use the product category module service directly
        const { Modules } = await import("@medusajs/framework/utils")
        const productCategoryService = container.resolve(Modules.PRODUCT)

        try {
            await productCategoryService.deleteProductCategories(data.createdIds)
        } catch (error) {
            console.error("Failed to rollback categories:", error)
        }
    }
)

// Workflow: Orchestrate category sync
export const syncCategoriesWorkflow = createWorkflow(
    "sync-categories",
    (input: { categories: CategoryInput[] }) => {
        const result = syncCategoriesStep(input)
        return new WorkflowResponse(result)
    }
)
