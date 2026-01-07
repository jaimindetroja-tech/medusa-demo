// src/workflows/create-brand.ts
import {
    createWorkflow,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

// Step: Create brand
const createBrandStep = createStep(
    "create-brand",
    async (input: { name: string }, { container }) => {
        const service = container.resolve("brand")
        const brand = await service.createBrands(input)
        return new StepResponse(brand, brand.id)
    },
    // Compensation function (rollback)
    async (brandId, { container }) => {
        if (!brandId) {
            return
        }
        const service = container.resolve("brand")
        await service.deleteBrands(brandId)
    }
)

// Workflow: Orchestrate steps
export const createBrandWorkflow = createWorkflow(
    "create-brand",
    (input: { name: string }) => {
        const brand = createBrandStep(input)
        return new WorkflowResponse({ brand })
    }
)