# Product Review System - Production Implementation Plan

## 🎯 Executive Summary

This document outlines a **production-grade Product Review system** for Medusa v2, following enterprise patterns, scalability considerations, and security best practices.

---

## 1. High-Level Architecture

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────┐
│                  API Layer                          │
├─────────────────┬───────────────────────────────────┤
│  Store Routes   │      Admin Routes                 │
│  - Add Review   │  - Approve/Reject Review          │
│  - List Reviews │  - List All Reviews               │
│  - Get Average  │  - Delete Review                  │
└─────────────────┴───────────────────────────────────┘
           ↓                        ↓
┌──────────────────────────────────────────────────────┐
│              Workflow Layer (Optional)               │
│  - Review Approval Workflow                          │
│  - Review Moderation Workflow                        │
│  - Event Emissions                                   │
└──────────────────────────────────────────────────────┘
           ↓                        ↓
┌──────────────────────────────────────────────────────┐
│                 Service Layer                        │
│  - ReviewModuleService                               │
│    * createReview()                                  │
│    * updateReviewStatus()                            │
│    * getAverageRating()                              │
│    * listReviews()                                   │
└──────────────────────────────────────────────────────┘
           ↓                        ↓
┌──────────────────────────────────────────────────────┐
│                 Data Layer                           │
│  - Review Model (MikroORM Entity)                    │
│  - Product ↔ Review Link                            │
│  - Indexes on product_id, status                     │
└──────────────────────────────────────────────────────┘
```

### 1.2 Design Philosophy

**Modular Architecture**: Reviews are a separate **custom module** (`review-module`), similar to how the existing `brand` module is structured. This ensures:

- ✅ Separation of concerns
- ✅ Independent scaling
- ✅ Reusability across multiple Medusa installations
- ✅ Easy testing and maintenance

**Link-Based Relationships**: Use Medusa's built-in Link system to connect Reviews to Products, maintaining referential integrity while keeping modules decoupled.

---

## 2. Data Model Design

### 2.1 Review Entity

**File**: `src/modules/review/models/review.ts`

```typescript
@Entity()
class Review {
  @PrimaryKey()
  id: string;

  @Property()
  product_id: string; // FK to Product

  @Property()
  customer_email?: string; // Optional: track reviewer (for logged-in users)

  @Property()
  customer_name: string; // Reviewer's display name

  @Property({ type: "smallint" })
  rating: number; // 1-5

  @Property({ type: "text", nullable: true })
  comment?: string;

  @Enum(() => ReviewStatus)
  status: ReviewStatus; // pending | approved | rejected

  @Property({ onCreate: () => new Date() })
  created_at: Date;

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updated_at: Date;

  @Property({ nullable: true })
  approved_at?: Date;

  @Property({ nullable: true })
  approved_by?: string; // Admin user ID who approved

  // Spam prevention
  @Property({ nullable: true })
  ip_address?: string;
}

enum ReviewStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}
```

### 2.2 Link Definition

**File**: `src/links/product-review.ts`

```typescript
import { defineLink } from "@medusajs/framework/utils";
import ProductModule from "@medusajs/medusa/product";
import ReviewModule from "../modules/review";

export default defineLink(
  ProductModule.linkable.product, // One Product
  ReviewModule.linkable.review, // Many Reviews
  {
    database: {
      extraColumns: {
        // Can add metadata if needed
      },
    },
  }
);
```

**Registration**: `medusa-config.ts`

```typescript
modules: {
  review: {
    resolve: "./src/modules/review";
  }
}
```

### 2.3 Database Indexes (Performance)

```sql
-- On Review table
CREATE INDEX idx_review_product_id ON review(product_id);
CREATE INDEX idx_review_status ON review(status);
CREATE INDEX idx_review_product_status ON review(product_id, status);  -- Composite
CREATE INDEX idx_review_created_at ON review(created_at DESC);
```

**Rationale**:

- `product_id`: Fast lookups for product-specific reviews
- `status`: Admin filtering (pending vs approved)
- Composite index: Optimizes "get approved reviews for product X"
- `created_at`: Pagination and sorting

---

## 3. Service Layer

### 3.1 ReviewModuleService

**File**: `src/modules/review/service.ts`

**Key Methods**:

```typescript
class ReviewModuleService extends MedusaService() {
  // CREATE
  async createReview(data: CreateReviewDTO): Promise<Review>;

  // READ
  async listReviews(filters: FilterableReviewProps): Promise<Review[]>;
  async getReviewById(id: string): Promise<Review>;
  async getAverageRating(
    productId: string
  ): Promise<{ average: number; total: number }>;

  // UPDATE
  async updateReviewStatus(
    id: string,
    status: ReviewStatus,
    adminId?: string
  ): Promise<Review>;

  // DELETE
  async deleteReview(id: string): Promise<void>;

  // SPAM PREVENTION
  async checkRecentReviewsByIP(
    ip: string,
    minutes: number = 10
  ): Promise<number>;
}
```

### 3.2 Business Logic

**Creating a Review**:

1. Validate `product_id` exists (query Product module)
2. Validate `rating` is between 1-5
3. Check IP-based rate limiting (max 3 reviews per 10 minutes)
4. Set default `status = "pending"`
5. Store IP address for spam tracking
6. Emit `review.created` event
7. Return created review

**Approving a Review**:

1. Verify review exists and is in `pending` state
2. Update `status = "approved"`
3. Set `approved_at` timestamp
4. Set `approved_by` to admin user ID
5. Emit `review.approved` event
6. Trigger cache invalidation for product's average rating
7. Return updated review

**Average Rating Calculation**:

```sql
SELECT
  AVG(rating) as average_rating,
  COUNT(*) as total_reviews
FROM review
WHERE product_id = ? AND status = 'approved'
```

---

## 4. API Endpoint Design

### 4.1 Store Endpoints (Public)

#### **POST /store/products/:product_id/reviews**

Create a new review for a product.

**Request**:

```json
{
  "rating": 5,
  "comment": "Great product, highly recommend!",
  "customer_name": "John Doe",
  "customer_email": "john@example.com" // optional
}
```

**Response (201)**:

```json
{
  "review": {
    "id": "review_123",
    "product_id": "prod_abc",
    "rating": 5,
    "comment": "Great product...",
    "status": "pending",
    "created_at": "2026-01-07T10:00:00Z"
  }
}
```

**Validation**:

- `rating`: Required, integer, min: 1, max: 5
- `comment`: Optional, string, max length: 1000
- `customer_name`: Required, string, min: 2, max: 100
- `product_id`: Must exist in database

**Guards**:

- Rate limit: Max 3 reviews per IP per 10 minutes
- Content filter: Reject if comment contains blacklisted words (basic implementation)

---

#### **GET /store/products/:product_id/reviews**

List approved reviews for a product.

**Query Params**:

- `limit` (default: 10, max: 50)
- `offset` (default: 0)
- `sort` (default: `created_at:desc`)

**Response (200)**:

```json
{
  "reviews": [
    {
      "id": "review_123",
      "rating": 5,
      "comment": "Great!",
      "customer_name": "John Doe",
      "created_at": "2026-01-07T10:00:00Z"
    }
  ],
  "count": 42,
  "limit": 10,
  "offset": 0
}
```

**Filter**: Only `status = 'approved'` reviews

---

#### **GET /store/products/:product_id/reviews/average**

Get average rating and total count.

**Response (200)**:

```json
{
  "product_id": "prod_abc",
  "average_rating": 4.5,
  "total_reviews": 42,
  "rating_breakdown": {
    "5": 20,
    "4": 15,
    "3": 5,
    "2": 2,
    "1": 0
  }
}
```

**Performance**:

- Cache this result in Redis with TTL of 5 minutes
- Invalidate on `review.approved` event

---

### 4.2 Admin Endpoints

#### **GET /admin/reviews**

List all reviews (for moderation dashboard).

**Query Params**:

- `status` (pending | approved | rejected | all)
- `product_id`
- `limit`, `offset`

**Response (200)**:

```json
{
  "reviews": [...],
  "count": 120,
  "limit": 20,
  "offset": 0
}
```

---

#### **POST /admin/reviews/:review_id/approve**

Approve a pending review.

**Request**: Empty body (or optional `{ "notes": "..." }`)

**Response (200)**:

```json
{
  "review": {
    "id": "review_123",
    "status": "approved",
    "approved_at": "2026-01-07T11:00:00Z",
    "approved_by": "admin_user_xyz"
  }
}
```

**Validation**:

- Review must exist
- Review must be in `pending` state
- Only admin users can access

---

#### **POST /admin/reviews/:review_id/reject**

Reject a pending review.

**Request**:

```json
{
  "reason": "Spam content" // optional
}
```

**Response (200)**:

```json
{
  "review": {
    "id": "review_123",
    "status": "rejected"
  }
}
```

---

#### **DELETE /admin/reviews/:review_id**

Permanently delete a review.

**Response (200)**:

```json
{
  "id": "review_123",
  "deleted": true
}
```

---

## 5. Folder Structure

```
src/
├── modules/
│   └── review/
│       ├── index.ts                    # Module exports
│       ├── models/
│       │   └── review.ts               # Review entity (MikroORM)
│       ├── service.ts                  # ReviewModuleService
│       └── migrations/
│           └── 1234567890_CreateReview.ts
│
├── links/
│   └── product-review.ts               # Product ↔ Review link
│
├── api/
│   ├── store/
│   │   └── products/
│   │       └── [product_id]/
│   │           └── reviews/
│   │               ├── route.ts        # POST, GET /store/products/:id/reviews
│   │               └── average/
│   │                   └── route.ts    # GET /store/products/:id/reviews/average
│   └── admin/
│       └── reviews/
│           ├── route.ts                # GET /admin/reviews
│           └── [review_id]/
│               ├── approve/
│               │   └── route.ts        # POST /admin/reviews/:id/approve
│               ├── reject/
│               │   └── route.ts        # POST /admin/reviews/:id/reject
│               └── route.ts            # DELETE /admin/reviews/:id
│
├── workflows/
│   └── approve-review.ts               # Workflow for review approval (optional)
│
└── subscribers/
    └── review-approved.ts              # Event listener (e.g., send notifications)
```

---

## 6. Data Flow Diagrams

### 6.1 Review Creation Flow

```
┌─────────────┐
│   Customer  │
└──────┬──────┘
       │ POST /store/products/123/reviews
       │ { rating: 5, comment: "..." }
       ↓
┌──────────────────────────────────────┐
│  API Route Handler                   │
│  - Extract product_id from params    │
│  - Validate request body             │
│  - Get customer IP address           │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  ReviewModuleService                 │
│  1. Verify product exists            │
│  2. Check IP rate limit              │
│  3. Create review (status: pending)  │
│  4. Emit "review.created" event      │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Database                            │
│  INSERT INTO review (...)            │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Response to Customer                │
│  { review: { id, status: "pending" }}│
└──────────────────────────────────────┘
```

### 6.2 Review Approval Flow

```
┌─────────────┐
│    Admin    │
└──────┬──────┘
       │ POST /admin/reviews/review_123/approve
       ↓
┌──────────────────────────────────────┐
│  Admin Route Handler                 │
│  - Authenticate admin                │
│  - Extract review_id                 │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Approve Review Workflow (Optional)  │
│  Step 1: Validate review state       │
│  Step 2: Update status               │
│  Step 3: Emit events                 │
│  Step 4: Invalidate cache            │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  ReviewModuleService                 │
│  updateReviewStatus(id, "approved")  │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Database                            │
│  UPDATE review                       │
│  SET status = 'approved',            │
│      approved_at = NOW()             │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Event Bus                           │
│  Emit "review.approved"              │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Subscribers                         │
│  - Clear average rating cache        │
│  - Send notification (optional)      │
└──────────────────────────────────────┘
```

### 6.3 Average Rating Calculation Flow

**Option A: Dynamic Calculation (Recommended for MVP)**

```
GET /store/products/123/reviews/average
       ↓
┌──────────────────────────────────────┐
│  Check Redis Cache                   │
│  Key: "product:123:avg_rating"       │
└──────┬───────────────────────────────┘
       │
       ├─ Cache Hit ──→ Return cached value
       │
       └─ Cache Miss
          ↓
┌──────────────────────────────────────┐
│  Query Database                      │
│  SELECT AVG(rating), COUNT(*)        │
│  FROM review                         │
│  WHERE product_id = 123              │
│    AND status = 'approved'           │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Store in Redis (TTL: 5 min)         │
│  Return result                       │
└──────────────────────────────────────┘
```

**Option B: Materialized View (For High Scale)**

If you have products with 10,000+ reviews:

- Create a `product_ratings` table
- Update it on every `review.approved` event
- Trade: Write complexity for read performance

---

## 7. Performance & Scalability

### 7.1 Caching Strategy

| Data Type        | Cache Location | TTL    | Invalidation Trigger    |
| ---------------- | -------------- | ------ | ----------------------- |
| Average Rating   | Redis          | 5 min  | `review.approved` event |
| Review List      | None (DB)      | -      | Real-time data          |
| Rating Breakdown | Redis          | 10 min | `review.approved` event |

### 7.2 Query Optimization

**Slow Query (Bad)**:

```sql
-- Fetches all columns for all reviews per page load
SELECT * FROM review WHERE product_id = ?
```

**Optimized Query (Good)**:

```sql
-- Only fetch needed columns, use index
SELECT id, rating, comment, customer_name, created_at
FROM review
WHERE product_id = ? AND status = 'approved'
ORDER BY created_at DESC
LIMIT 10 OFFSET 0
```

### 7.3 Pagination Best Practices

- Use **offset pagination** for admin (manageable data volume)
- Consider **cursor pagination** for public reviews if scale exceeds 10k reviews/product

### 7.4 Rate Limiting

**IP-Based**:

```typescript
// In service
const recentCount = await this.reviewRepository.count({
  where: {
    ip_address: userIP,
    created_at: { $gte: tenMinutesAgo },
  },
});

if (recentCount >= 3) {
  throw new Error("Too many reviews. Please wait.");
}
```

**Future**: Use Redis for distributed rate limiting across multiple app instances.

---

## 8. Security & Validation

### 8.1 Input Validation (Zod Schemas)

**File**: `src/api/store/products/[product_id]/reviews/validators.ts`

```typescript
import { z } from "zod";

export const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  customer_name: z.string().min(2).max(100),
  customer_email: z.string().email().optional(),
});
```

### 8.2 Admin Access Control

Use Medusa's built-in authentication middleware:

```typescript
// In admin route
import { authenticate } from "@medusajs/medusa";

export default [authenticate("admin", ["session", "bearer"])];

export const POST = async (req: AuthenticatedMedusaRequest, res) => {
  const adminUserId = req.auth_context.actor_id;
  // Proceed with approval logic
};
```

### 8.3 SQL Injection Prevention

✅ **MikroORM** handles parameterized queries automatically.

### 8.4 XSS Prevention

- Sanitize `comment` field before display (frontend responsibility)
- Backend: Validate max length, no HTML tags

### 8.5 Spam Prevention

**Implemented Guards**:

1. **Rate Limiting**: Max 3 reviews per IP per 10 minutes
2. **Content Filtering**: Block reviews with excessive URLs or blacklisted keywords
3. **Honeypot Field**: Add a hidden field in form; reject if filled

**Future Enhancements**:

- reCAPTCHA integration
- Email verification before review goes live
- Machine learning spam detection

---

## 9. Event System Integration

### 9.1 Emitted Events

| Event Name        | When             | Payload                                  |
| ----------------- | ---------------- | ---------------------------------------- |
| `review.created`  | Review submitted | `{ review_id, product_id }`              |
| `review.approved` | Admin approves   | `{ review_id, product_id, approved_by }` |
| `review.rejected` | Admin rejects    | `{ review_id, reason }`                  |

### 9.2 Subscriber Example

**File**: `src/subscribers/review-approved.ts`

```typescript
import { SubscriberArgs } from "@medusajs/framework";

export default async function reviewApprovedHandler({
  event,
  container,
}: SubscriberArgs) {
  const { review_id, product_id } = event.data;

  // Clear cached average rating
  const redisClient = container.resolve("redis");
  await redisClient.del(`product:${product_id}:avg_rating`);

  // Optional: Send notification email to product owner
  // const notificationService = container.resolve("notification")
  // await notificationService.send(...)
}

export const config = {
  event: "review.approved",
};
```

---

## 10. Optional Enhancements (Phase 2)

### 10.1 Helpful/Unhelpful Votes

**Model Extension**:

```typescript
@Property({ default: 0 })
helpful_count: number

@Property({ default: 0 })
unhelpful_count: number
```

**Endpoint**: `POST /store/reviews/:id/vote`

### 10.2 Review Images

**Model Extension**:

```typescript
@Property({ type: 'json', nullable: true })
image_urls?: string[]
```

**Flow**: Customer uploads images → Stored in Medusa File Service → URLs saved in review

### 10.3 Verified Purchase Badge

**Logic**: Check if customer actually purchased the product

- Add `order_id` column to `review` table
- Validate `order_id` during creation
- Display "Verified Purchase" badge in UI

### 10.4 Admin Dashboard Widget

Create a custom admin UI widget showing:

- Pending reviews count
- Average rating trends
- Recent reviews requiring moderation

**File**: `src/admin/widgets/review-moderation.tsx`

### 10.5 Email Notifications

**Triggers**:

- Customer submits review → Email: "Thank you, review pending approval"
- Admin approves review → Email: "Your review is now live"

---

## 11. Testing Strategy

### 11.1 Unit Tests

**Files**: `src/modules/review/__tests__/service.spec.ts`

**Tests**:

- ✅ `createReview()` with valid data
- ✅ `createReview()` rejects invalid rating
- ✅ Rate limiting blocks excessive requests
- ✅ `getAverageRating()` calculates correctly
- ✅ `updateReviewStatus()` only updates pending reviews

### 11.2 Integration Tests

**Files**: `integration-tests/http/review/create-review.spec.ts`

**Tests**:

- ✅ POST `/store/products/:id/reviews` creates pending review
- ✅ POST `/admin/reviews/:id/approve` requires admin auth
- ✅ GET `/store/products/:id/reviews` returns only approved reviews
- ✅ Average rating endpoint returns correct data

### 11.3 Load Testing

**Scenario**: 100 concurrent users submitting reviews
**Tool**: k6 or Apache JMeter
**Expected**: < 200ms response time, no database locks

---

## 12. Migration Plan

### 12.1 Database Migration

**File**: `src/modules/review/migrations/1234567890_CreateReview.ts`

```typescript
import { Migration } from "@mikro-orm/migrations";

export class CreateReview extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE review (
        id VARCHAR(255) PRIMARY KEY,
        product_id VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        ip_address VARCHAR(45),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMP,
        approved_by VARCHAR(255)
      );
    `);

    this.addSql("CREATE INDEX idx_review_product_id ON review(product_id);");
    this.addSql("CREATE INDEX idx_review_status ON review(status);");
    this.addSql(
      "CREATE INDEX idx_review_product_status ON review(product_id, status);"
    );
  }

  async down(): Promise<void> {
    this.addSql("DROP TABLE review;");
  }
}
```

### 12.2 Rollout Plan

1. **Week 1**: Deploy module + admin endpoints (review moderation)
2. **Week 2**: Deploy store endpoints (review creation)
3. **Week 3**: Enable caching + monitoring
4. **Week 4**: Launch publicly + gather feedback

---

## 13. Monitoring & Observability

### 13.1 Metrics to Track

| Metric                | Purpose             | Alert Threshold |
| --------------------- | ------------------- | --------------- |
| Pending Reviews Count | Moderation backlog  | > 100           |
| Average Approval Time | Admin efficiency    | > 24 hours      |
| Review Creation Rate  | Detect spam attacks | > 100/min       |
| Cache Hit Rate        | Performance tuning  | < 70%           |

### 13.2 Logging

**Key Events to Log**:

- Review creation (with IP)
- Review approval/rejection (with admin ID)
- Rate limit triggers
- Cache invalidations

---

## 14. Documentation Deliverables

1. **API Reference**: OpenAPI/Swagger spec for all endpoints
2. **Admin Guide**: How to moderate reviews
3. **Customer Guide**: How to submit a review
4. **Developer Docs**: Module integration guide

---

## 15. Estimated Effort

| Phase       | Tasks                                | Effort      |
| ----------- | ------------------------------------ | ----------- |
| **Phase 1** | Data model, service, store endpoints | 3 days      |
| **Phase 2** | Admin endpoints, approval workflow   | 2 days      |
| **Phase 3** | Caching, rate limiting, security     | 2 days      |
| **Phase 4** | Testing (unit + integration)         | 2 days      |
| **Phase 5** | Documentation + deployment           | 1 day       |
| **Total**   | -                                    | **10 days** |

---

## 16. Success Criteria

✅ Customers can submit reviews for products  
✅ Reviews default to "pending" status  
✅ Admins can approve/reject reviews  
✅ Only approved reviews are visible publicly  
✅ Average rating is calculated accurately and efficiently  
✅ System handles 1000 reviews/day without performance issues  
✅ No security vulnerabilities (validated input, auth enforced)  
✅ 95% test coverage

---

## 17. Next Steps

1. **Review & Approve This Plan** with stakeholders
2. **Set Up Review Module Scaffolding** (`index.ts`, `models/`, `service.ts`)
3. **Implement Data Model + Migration**
4. **Build Service Layer Methods**
5. **Create API Endpoints** (store first, then admin)
6. **Add Caching Layer** (Redis integration)
7. **Write Tests** (parallel with development)
8. **Deploy to Staging** for UAT
9. **Production Launch** 🚀

---

**END OF PLAN**

This is a **production-ready, enterprise-grade** implementation plan. All architectural decisions prioritize **scalability, security, and maintainability**.
