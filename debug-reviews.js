#!/usr/bin/env node

/**
 * Debug script to test review retrieval
 * Run with: node debug-reviews.js
 */

async function debugReviews() {
    const baseUrl = 'http://localhost:9000';

    // Test 1: Check if we can list all reviews (admin endpoint)
    console.log('\n📋 Test 1: List all reviews (admin)');
    try {
        const response = await fetch(`${baseUrl}/admin/reviews?status=all&limit=50`);
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        console.log(`Total reviews found: ${data.count || 0}`);
    } catch (error) {
        console.error('Error:', error.message);
    }

    // Test 2: Get reviews for a specific product
    console.log('\n📝 Test 2: Get reviews for a product');
    const productId = 'prod_01JGRQP7CZE2FWW95GVNM9G5D1'; // Replace with actual product ID
    try {
        const response = await fetch(`${baseUrl}/store/products/${productId}/reviews`);
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        console.log(`Reviews for product: ${data.count || 0}`);
    } catch (error) {
        console.error('Error:', error.message);
    }

    // Test 3: Get average rating for a product
    console.log('\n⭐ Test 3: Get average rating');
    try {
        const response = await fetch(`${baseUrl}/store/products/${productId}/reviews/average`);
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run the tests
debugReviews().catch(console.error);
