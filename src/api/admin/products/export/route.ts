
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { json2csv } from "json-2-csv"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
    try {
        const query = req.scope.resolve("query")

        // Fetch all products with necessary relations
        const { data: products } = await query.graph({
            entity: "product",
            fields: [
                "id",
                "title",
                "handle",
                "handle",
                "description",
                "variants.sku",
                "variants.prices.amount",
                "variants.prices.currency_code",
                "options.title",
                "options.values",
                "images.url",
                "collection.title",
                "type.value",
                "tags.value",
                "categories.name",
                "metadata",
                "created_at",
            ],
        })

        if (!products || products.length === 0) {
            return res.status(404).json({ message: "No products found" })
        }

        // Transform data for CSV readability (flattening)
        const flattenedProducts = products.map((product: any) => {
            // Flatten variants for simpler view (joining SKUs/Prices)
            const variants = product.variants.map((v: any) => {
                const prices = v.prices.map((p: any) => `${p.amount} ${p.currency_code}`).join(", ")
                return `[SKU: ${v.sku || 'N/A'}, Prices: ${prices}]`
            }).join("; ")

            // Flatten options
            const options = product.options.map((o: any) => `${o.title}: ${o.values?.join(", ")}`).join("; ")

            // Flatten images
            const images = product.images.map((i: any) => i.url).join(", ")

            // Flatten categories
            const categories = product.categories?.map((c: any) => c.name).join(", ") || ""

            return {
                ID: product.id,
                Title: product.title,
                Handle: product.handle,
                Description: product.description,
                Collection: product.collection?.title || "",
                Type: product.type?.value || "",
                Tags: product.tags?.map((t: any) => t.value).join(", ") || "",
                Categories: categories,
                Variants: variants,
                Options: options,
                Images: images,
                Created_At: product.created_at,
            }
        })

        // Generate CSV
        const csv = json2csv(flattenedProducts)

        // Set headers for download
        res.setHeader("Content-Type", "text/csv")
        res.setHeader("Content-Disposition", `attachment; filename=products_export_${Date.now()}.csv`)

        res.send(csv)

    } catch (error) {
        console.error("Export failed:", error)
        res.status(500).json({ message: "Failed to export products", error: error.message })
    }
}
