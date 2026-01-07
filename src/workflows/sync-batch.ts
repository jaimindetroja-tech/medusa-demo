import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";

// Types for our external data
export interface DummyProduct {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  thumbnail: string;
  images: string[];
  brand?: string;
  rating?: number;
}

export type BatchWorkflowInput = {
  products: DummyProduct[];
};

export type SyncStatistics = {
  categoriesCreated: number;
  productsCreated: number;
  productsUpdated: number;
  errors: number;
};

const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");

// ---------------------------------------------------------
// STEP 1: SYNC CATEGORIES
// ---------------------------------------------------------
export const syncCategoriesStep = createStep(
  "sync-categories-step",
  async (input: { products: DummyProduct[] }, { container }) => {
    const categoryNames = input.products.map(p => p.category);
    const productModule = container.resolve(Modules.PRODUCT);
    const uniqueNames = [...new Set(categoryNames)];
    const handles = uniqueNames.map(slugify);

    // 1. Find existing
    const existing = await productModule.listProductCategories(
      { handle: handles },
      { select: ["id", "name", "handle"] }
    );

    const existingMap = new Map(existing.map((c) => [c.handle, c.id]));
    const nameToId: Record<string, string> = {};
    const toCreate: any[] = [];

    // 2. Prepare missing
    for (const name of uniqueNames) {
      const handle = slugify(name);
      if (existingMap.has(handle)) {
        nameToId[name] = existingMap.get(handle)!;
      } else {
        toCreate.push({
          name,
          handle,
          is_active: true,
          is_internal: false
        });
      }
    }

    // 3. Create missing
    if (toCreate.length > 0) {
      const created = await productModule.createProductCategories(toCreate);
      created.forEach((c) => {
        nameToId[c.name] = c.id;
      });
    }

    return new StepResponse({
      categoryMap: nameToId,
      categoriesCreated: toCreate.length
    });
  }
);

// ---------------------------------------------------------
// STEP 2: UPSERT PRODUCTS
// ---------------------------------------------------------
export const upsertProductsStep = createStep(
  "upsert-products-step",
  async (input: {
    products: DummyProduct[];
    categoryData: { categoryMap: Record<string, string>; categoriesCreated: number }
  }, { container }) => {
    const productModule = container.resolve(Modules.PRODUCT);
    const { products, categoryData } = input;
    const categoryMap = categoryData.categoryMap;

    // 1. Resolve Handles & Deduplicate
    const resolvedProducts: (DummyProduct & { handle: string })[] = [];
    const seenHandles = new Set<string>();

    for (const p of products) {
      let handle = slugify(p.title);
      if (seenHandles.has(handle)) {
        handle = `${handle}-${p.id}`;
      }
      seenHandles.add(handle);
      resolvedProducts.push({ ...p, handle });
    }

    // 2. Identify existing to get IDs
    const handles = resolvedProducts.map((p) => p.handle);
    const existingProducts = await productModule.listProducts(
      { handle: handles },
      { select: ["id", "handle"] }
    );
    const handleToId = new Map(existingProducts.map((p) => [p.handle, p.id]));

    // Track statistics
    let productsCreated = 0;
    let productsUpdated = 0;

    // 3. Map payload
    const upsertPayload = resolvedProducts.map((p) => {
      const existingId = handleToId.get(p.handle);
      const categoryId = categoryMap[p.category];

      // Track if this is a create or update
      if (existingId) {
        productsUpdated++;
      } else {
        productsCreated++;
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
                amount: p.price * 100
              }
            ],
            options: { "Default Option": "Default Value" }
          }
        ],
        options: [
          { title: "Default Option", values: ["Default Value"] }
        ],
        metadata: {
          external_id: p.id.toString(),
          brand: p.brand
        },
        status: "published"
      };
    });

    // 3. Exec Upsert
    // Note: upsertProducts might throw if variant handling is strict. 
    // If it fails, we might need separate create/update calls. 
    // But modern Product Module supports upserts.
    const result = await productModule.upsertProducts(upsertPayload);

    return new StepResponse({
      products: result,
      productsCreated,
      productsUpdated,
      categoriesCreated: categoryData.categoriesCreated
    });
  }
);

// ---------------------------------------------------------
// WORKFLOW
// ---------------------------------------------------------
export const batchProductsWorkflow = createWorkflow(
  "batch-products-workflow",
  (input: BatchWorkflowInput) => {
    const categoryData = syncCategoriesStep({ products: input.products });

    const result = upsertProductsStep({
      products: input.products,
      categoryData
    });

    return new WorkflowResponse(result);
  }
);
