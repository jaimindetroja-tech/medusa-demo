# 🔥 Bar Raiser Features

## 🎯 Overview

Bar Raiser features are advanced implementations that go beyond the basic requirements. This document covers:

1. ✅ **Category Sync** (Implemented)
2. 🚧 **Admin Widget** (Implementation guide)
3. 💡 **Bonus Challenges** (Ideas and implementations)

---

## 1️⃣ Category Sync (Implemented)

### ✅ What It Does

Automatically syncs product categories from DummyJSON API to Medusa's built-in product categories.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Category Sync Workflow                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Input: External Products                               │
│  ┌────────────────────────────────────────────────┐    │
│  │ Product 1: { category: "smartphones" }         │    │
│  │ Product 2: { category: "laptops" }             │    │
│  │ Product 3: { category: "smartphones" }         │    │
│  │ ...                                            │    │
│  └────────────────────────────────────────────────┘    │
│                     │                                   │
│                     ▼                                   │
│  Extract Unique Categories                              │
│  ┌────────────────────────────────────────────────┐    │
│  │ Set: ["smartphones", "laptops", "beauty", ...] │    │
│  │ Total: 24 unique categories                    │    │
│  └────────────────────────────────────────────────┘    │
│                     │                                   │
│                     ▼                                   │
│  Transform to Medusa Format                             │
│  ┌────────────────────────────────────────────────┐    │
│  │ [                                              │    │
│  │   { name: "Smartphones", slug: "smartphones" },│    │
│  │   { name: "Laptops", slug: "laptops" },        │    │
│  │   ...                                          │    │
│  │ ]                                              │    │
│  └────────────────────────────────────────────────┘    │
│                     │                                   │
│                     ▼                                   │
│  syncCategoriesWorkflow()                               │
│  ┌────────────────────────────────────────────────┐    │
│  │ 1. Query existing categories                   │    │
│  │ 2. Filter new categories                       │    │
│  │ 3. Create missing categories                   │    │
│  │ 4. Build category map (slug → id)              │    │
│  └────────────────────────────────────────────────┘    │
│                     │                                   │
│                     ▼                                   │
│  Link Products to Categories                            │
│  ┌────────────────────────────────────────────────┐    │
│  │ Product: { category_ids: ["cat_01..."] }       │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Features

✅ **Idempotent**: Running multiple times doesn't create duplicates  
✅ **Automatic Linking**: Products automatically linked to categories  
✅ **Rollback Support**: Failed workflow rolls back changes  
✅ **Slug Generation**: Automatic URL-friendly slug creation  

### Implementation Details

**File**: `src/workflows/sync-categories.ts`

**Key Code**:
```typescript
// Extract unique categories
const uniqueCategories = new Set(externalProducts.map((p) => p.category))

// Transform to input format
const categoryInputs = Array.from(uniqueCategories).map((cat) => ({
    name: cat,
    slug: cat.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
}))

// Sync categories
const { result } = await syncCategoriesWorkflow(container).run({
    input: { categories: categoryInputs },
})

// Use category map to link products
if (categoryMap[categorySlug]) {
    product.category_ids = [categoryMap[categorySlug]]
}
```

### Benefits

- 📊 **Better Organization**: Products organized by category
- 🔍 **Improved Search**: Filter products by category
- 🎨 **Better UX**: Category navigation in storefront
- 📈 **Analytics**: Track sales by category

---

## 2️⃣ Admin Widget (Implementation Guide)

### 🎯 Goal

Create an admin widget that shows:
- Last sync time
- Products synced
- Errors encountered
- "Sync Now" button

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Admin Widget                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Product Sync Status                            │   │
│  ├─────────────────────────────────────────────────┤   │
│  │                                                 │   │
│  │  Last Sync: 2026-01-07 12:34:56                 │   │
│  │  Status: ✅ Success                             │   │
│  │                                                 │   │
│  │  📊 Statistics:                                 │   │
│  │  • Products Synced: 194                         │   │
│  │  • Created: 0                                   │   │
│  │  • Updated: 194                                 │   │
│  │  • Errors: 0                                    │   │
│  │  • Duration: 12.34s                             │   │
│  │                                                 │   │
│  │  [Sync Now] [View Logs]                        │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Create Sync Status Model

**File**: `src/models/sync-status.ts`

```typescript
import { model } from "@medusajs/framework/utils"

const SyncStatus = model.define("sync_status", {
    id: model.id().primaryKey(),
    job_name: model.text(),
    last_sync_at: model.dateTime(),
    status: model.enum(["success", "failed", "running"]),
    products_synced: model.number(),
    products_created: model.number(),
    products_updated: model.number(),
    errors: model.number(),
    duration_seconds: model.number(),
    error_message: model.text().nullable(),
})

export default SyncStatus
```

#### Step 2: Update Job to Save Status

**File**: `src/jobs/sync-products.ts`

```typescript
export default async function syncProductsJob(container: MedusaContainer) {
    const startTime = Date.now()
    
    // Get sync status service
    const syncStatusService = container.resolve("syncStatusService")
    
    // Create running status
    await syncStatusService.create({
        job_name: "sync-products",
        status: "running",
        last_sync_at: new Date(),
    })
    
    try {
        // ... existing sync logic ...
        
        // Update with success status
        await syncStatusService.update({
            job_name: "sync-products",
            status: "success",
            products_synced: createdCount + updatedCount,
            products_created: createdCount,
            products_updated: updatedCount,
            errors: errorCount,
            duration_seconds: (Date.now() - startTime) / 1000,
        })
    } catch (error) {
        // Update with failed status
        await syncStatusService.update({
            job_name: "sync-products",
            status: "failed",
            error_message: error.message,
        })
        throw error
    }
}
```

#### Step 3: Create API Endpoint

**File**: `src/api/admin/sync/status/route.ts`

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const syncStatusService = req.scope.resolve("syncStatusService")
    
    const status = await syncStatusService.retrieve({
        job_name: "sync-products"
    })
    
    res.json({ status })
}
```

**File**: `src/api/admin/sync/trigger/route.ts`

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const container = req.scope
    
    // Import and run sync job
    const { default: syncProductsJob } = await import("../../../../jobs/sync-products")
    
    // Run in background
    syncProductsJob(container).catch(console.error)
    
    res.json({ 
        message: "Sync started",
        status: "running"
    })
}
```

#### Step 4: Create Admin Widget

**File**: `src/admin/widgets/product-sync-status.tsx`

```tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

const ProductSyncStatusWidget = () => {
    const [status, setStatus] = useState(null)
    const [loading, setLoading] = useState(false)
    
    const fetchStatus = async () => {
        const res = await fetch("/admin/sync/status")
        const data = await res.json()
        setStatus(data.status)
    }
    
    const triggerSync = async () => {
        setLoading(true)
        await fetch("/admin/sync/trigger", { method: "POST" })
        setLoading(false)
        // Refresh status after 2 seconds
        setTimeout(fetchStatus, 2000)
    }
    
    useEffect(() => {
        fetchStatus()
        // Refresh every 30 seconds
        const interval = setInterval(fetchStatus, 30000)
        return () => clearInterval(interval)
    }, [])
    
    if (!status) return <div>Loading...</div>
    
    return (
        <Container>
            <Heading level="h2">Product Sync Status</Heading>
            
            <div className="mt-4 space-y-2">
                <Text>
                    <strong>Last Sync:</strong>{" "}
                    {new Date(status.last_sync_at).toLocaleString()}
                </Text>
                
                <Text>
                    <strong>Status:</strong>{" "}
                    {status.status === "success" ? "✅" : status.status === "failed" ? "❌" : "🔄"}{" "}
                    {status.status}
                </Text>
                
                {status.status === "success" && (
                    <>
                        <Text>
                            <strong>Products Synced:</strong> {status.products_synced}
                        </Text>
                        <Text>
                            <strong>Created:</strong> {status.products_created}
                        </Text>
                        <Text>
                            <strong>Updated:</strong> {status.products_updated}
                        </Text>
                        <Text>
                            <strong>Errors:</strong> {status.errors}
                        </Text>
                        <Text>
                            <strong>Duration:</strong> {status.duration_seconds}s
                        </Text>
                    </>
                )}
                
                {status.status === "failed" && (
                    <Text className="text-red-500">
                        <strong>Error:</strong> {status.error_message}
                    </Text>
                )}
            </div>
            
            <div className="mt-4">
                <Button 
                    onClick={triggerSync}
                    disabled={loading || status.status === "running"}
                >
                    {loading ? "Starting..." : "Sync Now"}
                </Button>
            </div>
        </Container>
    )
}

export const config = defineWidgetConfig({
    zone: "product.list.before",
})

export default ProductSyncStatusWidget
```

### Testing the Widget

1. **Build the admin**:
   ```bash
   npm run build
   ```

2. **Start Medusa**:
   ```bash
   npm run dev
   ```

3. **Open admin panel**:
   ```
   http://localhost:9000/app/products
   ```

4. **Verify widget appears** above product list

5. **Test "Sync Now" button**

---

## 3️⃣ Bonus Challenges

### 🖼️ Challenge 1: Sync Product Images to Medusa File Storage

**Goal**: Upload images to Medusa's file storage instead of using external URLs

**Implementation**:

```typescript
// src/lib/image-uploader.ts

import { MedusaContainer } from "@medusajs/framework/types"

export async function uploadImage(
    container: MedusaContainer,
    imageUrl: string,
    productId: string
): Promise<string> {
    const fileService = container.resolve("fileService")
    
    // Download image
    const response = await fetch(imageUrl)
    const buffer = await response.arrayBuffer()
    
    // Upload to Medusa
    const result = await fileService.upload({
        filename: `product-${productId}-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
        content: Buffer.from(buffer),
    })
    
    return result.url
}

// Usage in sync job:
const uploadedImages = await Promise.all(
    product.images.map((img, i) => 
        uploadImage(container, img, `${product.id}-${i}`)
    )
)

product.images = uploadedImages.map(url => ({ url }))
```

**Benefits**:
- ✅ Images stored locally
- ✅ Faster loading
- ✅ No dependency on external CDN
- ✅ Better control over images

---

### 📦 Challenge 2: Track Inventory from External Source

**Goal**: Sync inventory levels from DummyJSON API

**Implementation**:

```typescript
// DummyJSON product includes stock
interface DummyJSONProduct {
    // ... existing fields
    stock: number
}

// Map to Medusa variant
function mapToMedusaFormat(product: DummyJSONProduct): MedusaProductInput {
    return {
        // ... existing fields
        variants: [
            {
                title: "Default",
                prices: [...],
                inventory_quantity: product.stock, // Add inventory
                manage_inventory: true,
            },
        ],
    }
}

// Update inventory on subsequent syncs
if (existing) {
    productsToUpdate.push({
        id: existing.id,
        data: {
            // ... existing fields
            variants: [{
                id: existing.variants[0].id,
                inventory_quantity: externalProduct.stock,
            }],
        },
    })
}
```

**Benefits**:
- ✅ Accurate stock levels
- ✅ Automatic inventory updates
- ✅ Prevent overselling
- ✅ Real-time sync

---

### 🔔 Challenge 3: Webhook to Trigger Sync on External Changes

**Goal**: Trigger sync when external API has updates

**Implementation**:

```typescript
// src/api/webhooks/product-update/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const { product_id } = req.body
    
    // Verify webhook signature
    const signature = req.headers["x-webhook-signature"]
    if (!verifySignature(signature, req.body)) {
        return res.status(401).json({ error: "Invalid signature" })
    }
    
    // Trigger sync for specific product
    const container = req.scope
    const { default: syncProductsJob } = await import("../../../jobs/sync-products")
    
    // Run sync in background
    syncProductsJob(container).catch(console.error)
    
    res.json({ message: "Sync triggered" })
}

function verifySignature(signature: string, body: any): boolean {
    // Implement signature verification
    // Example: HMAC-SHA256
    const crypto = require("crypto")
    const secret = process.env.WEBHOOK_SECRET
    const hash = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(body))
        .digest("hex")
    return hash === signature
}
```

**Setup**:

1. **Configure webhook in external system**:
   ```
   URL: https://your-domain.com/webhooks/product-update
   Events: product.created, product.updated
   ```

2. **Add webhook secret to .env**:
   ```
   WEBHOOK_SECRET=your-secret-key
   ```

**Benefits**:
- ✅ Real-time updates
- ✅ No need to wait for scheduled sync
- ✅ Reduced API calls
- ✅ Event-driven architecture

---

### 📊 Challenge 4: Advanced Analytics

**Goal**: Track sync performance and product metrics

**Implementation**:

```typescript
// src/models/sync-analytics.ts

const SyncAnalytics = model.define("sync_analytics", {
    id: model.id().primaryKey(),
    sync_id: model.text(),
    timestamp: model.dateTime(),
    metric_name: model.text(),
    metric_value: model.number(),
})

// Track metrics during sync
async function trackMetric(
    container: MedusaContainer,
    syncId: string,
    name: string,
    value: number
) {
    const analyticsService = container.resolve("syncAnalyticsService")
    await analyticsService.create({
        sync_id: syncId,
        timestamp: new Date(),
        metric_name: name,
        metric_value: value,
    })
}

// Usage in sync job
const syncId = `sync-${Date.now()}`

await trackMetric(container, syncId, "api_fetch_duration", fetchDuration)
await trackMetric(container, syncId, "products_fetched", products.length)
await trackMetric(container, syncId, "categories_created", categoryResult.created)
await trackMetric(container, syncId, "products_created", createdCount)
await trackMetric(container, syncId, "products_updated", updatedCount)
await trackMetric(container, syncId, "total_duration", totalDuration)
```

**Dashboard**:

```tsx
// src/admin/routes/sync-analytics/page.tsx

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

const SyncAnalyticsPage = () => {
    const [data, setData] = useState([])
    
    useEffect(() => {
        fetch("/admin/sync/analytics")
            .then(res => res.json())
            .then(data => setData(data))
    }, [])
    
    return (
        <div>
            <h1>Sync Analytics</h1>
            
            <LineChart width={800} height={400} data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="total_duration" stroke="#8884d8" />
                <Line type="monotone" dataKey="products_synced" stroke="#82ca9d" />
            </LineChart>
        </div>
    )
}
```

**Benefits**:
- ✅ Performance tracking
- ✅ Identify bottlenecks
- ✅ Historical trends
- ✅ Data-driven optimization

---

## 🏆 Evaluation Criteria

### Base Requirements (70 points)

- ✅ Job runs on schedule (10 points)
- ✅ Fetches all API pages (10 points)
- ✅ Batch processing (10 points)
- ✅ Error handling with retries (10 points)
- ✅ Creates/updates products (15 points)
- ✅ Clean code & documentation (15 points)

### Bar Raiser (20 points)

- ✅ Category sync (10 points)
- ✅ Admin widget (10 points)

### Bonus Challenges (10 points)

- ✅ Image sync (3 points)
- ✅ Inventory tracking (3 points)
- ✅ Webhook integration (2 points)
- ✅ Analytics dashboard (2 points)

**Total Possible**: 100 points

---

## 📈 Performance Benchmarks

| Metric | Target | Excellent |
|--------|--------|-----------|
| **Total Duration** | < 30s | < 15s |
| **Products/Second** | > 10 | > 20 |
| **Memory Usage** | < 250MB | < 150MB |
| **API Requests** | 7 pages | Parallel fetch |
| **Error Rate** | < 1% | 0% |
| **Idempotency** | 100% | 100% |

---

## 🎓 Key Takeaways

1. **Category Sync**: Essential for organized product catalog
2. **Admin Widget**: Improves operational visibility
3. **Image Upload**: Better performance and control
4. **Inventory Sync**: Prevents overselling
5. **Webhooks**: Real-time updates
6. **Analytics**: Data-driven optimization

---

**Congratulations!** 🎉 You've completed the comprehensive documentation for the Medusa Product Sync Job!
