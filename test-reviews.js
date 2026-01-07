#!/usr/bin/env node

/**
 * Comprehensive Review API Test Script
 * 
 * This script tests all review endpoints to verify the fixes
 * Run with: node test-reviews.js <product_id>
 */

const BASE_URL = process.env.MEDUSA_URL || 'http://localhost:9000';
const PRODUCT_ID = process.argv[2] || 'prod_01JGRQP7CZE2FWW95GVNM9G5D1';

console.log('🧪 Review API Test Suite');
console.log('========================\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Product ID: ${PRODUCT_ID}\n`);

async function testEndpoint(name, url, options = {}) {
    console.log(`\n📡 ${name}`);
    console.log(`   URL: ${url}`);

    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type');

        console.log(`   Status: ${response.status} ${response.statusText}`);

        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            console.log(`   Response:`, JSON.stringify(data, null, 2));

            // Validate response structure
            if (data.error) {
                console.log(`   ❌ Error received: ${data.error}`);
            } else {
                console.log(`   ✅ Valid JSON response`);
            }

            return data;
        } else {
            const text = await response.text();
            console.log(`   Response (text):`, text);
            return null;
        }
    } catch (error) {
        console.log(`   ❌ Request failed: ${error.message}`);
        return null;
    }
}

async function runTests() {
    console.log('\n📋 Part 1: Store Endpoints (Public Access)\n');
    console.log('='.repeat(50));

    // Test 1: Get reviews for product
    const reviewsData = await testEndpoint(
        'Get Product Reviews',
        `${BASE_URL}/store/products/${PRODUCT_ID}/reviews?limit=10&offset=0`
    );

    if (reviewsData) {
        console.log(`\n   Analysis:`);
        console.log(`   - Total reviews: ${reviewsData.count || 0}`);
        console.log(`   - Returned: ${reviewsData.reviews?.length || 0} reviews`);

        if (reviewsData.reviews && reviewsData.reviews.length > 0) {
            console.log(`   - First review rating: ${reviewsData.reviews[0].rating}`);
            console.log(`   - First review status: ${reviewsData.reviews[0].status}`);
        }
    }

    // Test 2: Get average rating
    const avgData = await testEndpoint(
        'Get Average Rating',
        `${BASE_URL}/store/products/${PRODUCT_ID}/reviews/average`
    );

    if (avgData) {
        console.log(`\n   Analysis:`);
        console.log(`   - Average rating: ${avgData.average_rating || 0}`);
        console.log(`   - Total reviews: ${avgData.total_reviews || 0}`);

        if (avgData.rating_breakdown) {
            console.log(`   - Rating breakdown:`);
            Object.entries(avgData.rating_breakdown).forEach(([stars, count]) => {
                console.log(`     ${stars} stars: ${count} reviews`);
            });
        }
    }

    // Test 3: Create a new review
    console.log('\n\n📝 Test: Create New Review');
    const newReview = await testEndpoint(
        'Create Review',
        `${BASE_URL}/store/products/${PRODUCT_ID}/reviews`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                rating: 5,
                comment: 'Test review from API test script',
                customer_name: 'Test User',
                customer_email: 'test@example.com'
            })
        }
    );

    if (newReview && newReview.review) {
        console.log(`\n   ✅ Review created successfully!`);
        console.log(`   - Review ID: ${newReview.review.id}`);
        console.log(`   - Status: ${newReview.review.status}`);
        console.log(`   - Rating: ${newReview.review.rating}`);
    }

    console.log('\n\n📋 Part 2: Admin Endpoints (Requires Auth)\n');
    console.log('='.repeat(50));
    console.log('⚠️  Note: These endpoints require admin authentication');

    // Test 4: List all reviews (admin)
    await testEndpoint(
        'List All Reviews (Admin)',
        `${BASE_URL}/admin/reviews?status=all&limit=20&offset=0`
    );

    // Test 5: List pending reviews
    await testEndpoint(
        'List Pending Reviews (Admin)',
        `${BASE_URL}/admin/reviews?status=pending&limit=20&offset=0`
    );

    // Test 6: List approved reviews
    await testEndpoint(
        'List Approved Reviews (Admin)',
        `${BASE_URL}/admin/reviews?status=approved&limit=20&offset=0`
    );

    console.log('\n\n📊 Summary:\n');
    console.log('='.repeat(50));
    console.log(`✅ Tests completed`);
    console.log(`\nIf you see errors:`);
    console.log(`  1. Check that the Medusa server is running on ${BASE_URL}`);
    console.log(`  2. Verify the product ID exists: ${PRODUCT_ID}`);
    console.log(`  3. Check server logs for detailed error messages`);
    console.log(`  4. Make sure you've run: npm run build`);
    console.log(`\nTo approve pending reviews:`);
    console.log(`  POST ${BASE_URL}/admin/reviews/<review_id>/approve`);
    console.log(`  (Requires admin authentication)`);
}

// Run the tests
runTests().catch(console.error);
