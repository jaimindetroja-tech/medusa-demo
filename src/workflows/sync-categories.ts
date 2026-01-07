// src/workflows/sync-categories.ts
import {
    createWorkflow,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

interface CategoryInput {
    name: string
    slug: string
}

interface Category {
    id: string
    name: string
    slug: string
}

// Step: Sync categories
const syncCategoriesStep = createStep(
    "sync-categories",
    async (input: { categories: CategoryInput[] }, { container }) => {
        const categoryService = container.resolve("category") as any

        // Get existing categories
        const existingCategories = await categoryService.listCategories()
        const existingCategoryMap = new Map<string, Category>(
            existingCategories.map((c: Category) => [c.slug, c])
        )

        const created: Category[] = []
        const updated: Category[] = []

        for (const category of input.categories) {
            const existing: Category | undefined = existingCategoryMap.get(category.slug)

            if (existing) {
                const updatedCategory = await categoryService.updateCategories(
                    { id: existing.id },
                    { name: category.name }
                )
                updated.push(updatedCategory)
            } else {
                // Create new category
                const newCategory = await categoryService.createCategories(category)
                created.push(newCategory)
            }
        }

        return new StepResponse(
            { created, updated },
            { createdIds: created.map((c) => c.id) }
        )
    },
    // Compensation function (rollback)
    async (data, { container }) => {
        if (!data?.createdIds || data.createdIds.length === 0) {
            return
        }

        const categoryService = container.resolve("category") as any
        await categoryService.deleteCategories(data.createdIds)
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
