-- Review System Database Verification Queries

-- 1. Check if review table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'review';

-- 2. Check review table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'review'
ORDER BY ordinal_position;

-- 3. Count total reviews
SELECT COUNT(*) as total_reviews FROM review;

-- 4. Count reviews by status
SELECT status, COUNT(*) as count
FROM review
GROUP BY status;

-- 5. Get all reviews (limit 10)
SELECT id, product_id, customer_name, rating, status, created_at
FROM review
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check for the specific review you mentioned (rating = 5)
SELECT id, product_id, customer_name, rating, comment, status, created_at
FROM review
WHERE rating = 5;

-- 7. Get average rating per product
SELECT 
    product_id,
    COUNT(*) as review_count,
    AVG(rating) as average_rating,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
FROM review
GROUP BY product_id;

-- 8. Check for product-review links (if link table exists)
SELECT * FROM link_product_review LIMIT 10;

-- 9. Show indexes on review table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'review';

-- 10. Check for any deleted reviews (soft deletes)
SELECT COUNT(*) as deleted_reviews
FROM review
WHERE deleted_at IS NOT NULL;
