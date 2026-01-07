# Medusa Product Reviews API - Postman Collection

## 📋 Overview
This Postman collection contains all the API endpoints for testing the product review system implemented in your Medusa store.

## 🚀 Quick Start

### 1. Import the Collection
1. Open Postman
2. Click "Import" button
3. Select "File"
4. Choose `Medusa_Reviews_API.postman_collection.json`
5. Click "Import"

### 2. Set Environment Variables
Create a new environment in Postman with these variables:
- `base_url`: `http://localhost:9000` (your Medusa server URL)
- `product_id`: A valid product ID from your store (e.g., `prod_123`)
- `review_id`: A review ID (will be returned when creating reviews)

### 3. Get Admin Token (for Admin APIs)
Before testing admin endpoints, you need to authenticate:

1. Login to your Medusa admin panel
2. Open browser developer tools → Network tab
3. Login and find the authentication request
4. Copy the JWT token from the response
5. Replace `YOUR_ADMIN_TOKEN` in the Authorization header with the actual token

## 📚 API Endpoints

### Store APIs (Public)
- **POST** `/store/products/{product_id}/reviews` - Add a new review
- **GET** `/store/products/{product_id}/reviews` - Get approved reviews
- **GET** `/store/products/{product_id}/reviews/average` - Get rating statistics

### Admin APIs (Protected)
- **GET** `/admin/reviews` - List all reviews for moderation
- **POST** `/admin/reviews/{review_id}/approve` - Approve a review
- **POST** `/admin/reviews/{review_id}/reject` - Reject a review
- **DELETE** `/admin/reviews/{review_id}` - Delete a review

## 🧪 Testing Workflow

1. **Create a Review**: Use "Add Product Review" request
2. **Check Pending Reviews**: Use "List All Reviews" with `status=pending`
3. **Approve the Review**: Use "Approve Review" with the review ID
4. **View Approved Reviews**: Use "Get Product Reviews" - should now show the review
5. **Check Average Rating**: Use "Get Product Average Rating"

## 📝 Notes

- Reviews start in "pending" status and are only visible after admin approval
- Rate limiting: Max 3 reviews per IP per 10 minutes
- All admin endpoints require authentication
- Replace placeholder values with actual IDs from your database

## 🔧 Troubleshooting

- **401 Unauthorized**: Check your admin token is valid
- **404 Not Found**: Verify the product/review IDs exist
- **500 Internal Server Error**: Check server logs for detailed error messages

Happy testing! 🎉