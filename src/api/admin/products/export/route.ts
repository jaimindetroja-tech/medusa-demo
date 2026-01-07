import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

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
  const productModule = req.scope.resolve(Modules.PRODUCT);

  // 1. Fetch products
  // For production, we would use pagination loop. For now, fetching reasonable limit.
  const [products, count] = await productModule.listAndCountProducts(
    {}, 
    { 
      take: 1000,
      select: ["id", "title", "handle", "status", "description", "created_at"]
    }
  );

  // 2. Transform to Flat JSON for CSV
  const flatProducts = products.map(p => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    description: p.description?.slice(0, 100) || "", // Truncate desc for cleaner CSV
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
