import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * Basic CSV stringifier
 */
function jsonToCsv(items: Record<string, any>[]): string {
  if (items.length === 0) {
    return "";
  }

  const headers = Object.keys(items[0]);
  const csvRows = [headers.join(",")];

  for (const item of items) {
    const values = headers.map(header => {
      const val = item[header];
      // Escape logic: wrap strings in quotes, escape existing quotes
      if (typeof val === "string") {
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      return val;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve("query");

  // 1. Fetch products with categories using Query Graph API
  // For production, we would use pagination loop. For now, fetching reasonable limit.
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
      "categories.handle"
    ],
    pagination: {
      take: 1000
    }
  });

  // 2. Transform to Flat JSON for CSV
  const flatProducts = products.map((p: any) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    description: p.description?.slice(0, 100) || "", // Truncate desc for cleaner CSV
    category_name: p.categories?.[0]?.name || "", // First category name
    category_handle: p.categories?.[0]?.handle || "", // First category handle
    created_at: p.created_at ? new Date(p.created_at).toISOString() : ""
  }));

  // 3. Convert to CSV
  const csvContent = jsonToCsv(flatProducts);

  // 4. Send Response
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="products_export_${Date.now()}.csv"`
  );

  res.send(csvContent);
};
