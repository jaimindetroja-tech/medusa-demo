import { RemoteQueryFunction } from "@medusajs/framework/types";
import { jsonToCsv } from "../../../../utils/csv";

export type ProductExportData = {
    id: string;
    title: string;
    handle: string;
    status: string;
    description: string;
    category_name: string;
    category_handle: string;
    created_at: string;
};

/**
 * Fetches products with category data and transforms them for CSV export
 */
export async function getProductsForExport(
    query: any
): Promise<ProductExportData[]> {
    // Fetch products with categories using Query Graph API
    const { data: products } = await query.graph({
        entity: "product",
        fields: [
            "id",
            "title",
            "handle",
            "status",
            "description",
            "created_at",
            "categories.id",
            "categories.name",
            "categories.handle",
        ],
        pagination: {
            take: 1000, // For production, implement proper pagination
        },
    });

    // Transform to flat structure for CSV
    return products.map((p: any) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        status: p.status,
        description: p.description?.slice(0, 100) || "",
        category_name: p.categories?.[0]?.name || "",
        category_handle: p.categories?.[0]?.handle || "",
        created_at: p.created_at ? new Date(p.created_at).toISOString() : "",
    }));
}

/**
 * Generates CSV content from product data
 */
export async function generateProductExportCsv(
    query: any
): Promise<string> {
    const products = await getProductsForExport(query);
    return jsonToCsv(products);
}
