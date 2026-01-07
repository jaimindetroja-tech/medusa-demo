# Implementation Plan: Product CSV Export Endpoint

## Overview

We will create a custom **Admin API Endpoint** that allows authorized users to export all products from the store into a CSV file. This is useful for backups, analysis, or migration.

## Architecture

### 1. **API Route**

- **Path**: `GET /admin/products/export`
- **Access**: Protected (Authenticated Admin).
- **Response**: `text/csv` file download.

### 2. **Data Fetching**

- Use the **Medusa Query API** (or Product Module Service) to fetch products.
- **Pagination Handling**: To ensure "ALL" products are exported, we will fetch in batches (or utilize a large limit if dataset is reasonable) to prevent memory overflows, though for this iteration, a standard fetch of a high limit (e.g., 1000) or loop logic is sufficient.

### 3. **CSV Conversion**

- Transform the complex nested Product JSON (including Variants/Prices if needed) into a flat CSV structure.
- **Columns**: `id`, `title`, `handle`, `status`, `description`, `collection_id`, `created_at`.

## Step-by-Step Implementation

### Step 1: Create the Route File

Location: `src/api/admin/products/export/route.ts`

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // Logic here
};
```

### Step 2: Implement Data Fetching

- Resolve `Modules.PRODUCT`.
- Use `listProducts` to get the raw data.
- Ideally, select only necessary fields to optimize performance.

### Step 3: Implement CSV Utility

- Create a simple helper function to convert an array of objects to a CSV string.
- Ensure fields heavily containing text (like `description`) are properly escaped (wrapped in quotes).

### Step 4: Stream Response

- Set headers:
  - `Content-Type: text/csv`
  - `Content-Disposition: attachment; filename="products_export.csv"`
- Send the CSV string as the body.

## Verification

1.  Start the Medusa backend.
2.  Use Postman to send a **GET** request to `http://localhost:9000/admin/products/export`.
3.  Ensure an `x-medusa-access-token` (Admin Token) is provided in headers.
4.  Verify the response is a downloadable CSV file.
