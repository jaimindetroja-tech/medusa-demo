import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { generateProductExportCsv } from "./helpers";

/**
 * GET /admin/products/export
 * Exports all products with category information to CSV
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve("query");

  // Generate CSV content
  const csvContent = await generateProductExportCsv(query);

  // Send CSV response
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="products_export_${Date.now()}.csv"`
  );

  res.send(csvContent);
};
