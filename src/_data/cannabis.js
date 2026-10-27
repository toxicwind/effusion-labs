// src/_data/cannabis.js
// fetch is global in Node 22+

const API_URL = process.env.CANNABIS_API_URL || 'http://localhost:8000/api/cannabis'

async function fetchCannabisData() {
    try {
        const res = await fetch(API_URL)
        if (!res.ok) throw new Error(`API returned ${res.status}`)
        return await res.json()
    } catch (err) {
        console.warn(`[cannabis] API fetch failed (${err.message}). Using fallback data.`)
        return generateFallbackData()
    }
}

function generateFallbackData() {
    // Matches the structure expected by the template
    return {
        last_scrape_time: new Date().toISOString(),
        dispensaries_count: 5,
        dispensaries: Array.from({ length: 5 }, (_, i) => ({
            name: `Mock Dispensary ${i + 1}`,
            address: '123 Fake St, Denver, CO',
            rating: 4.5,
            lat: 39.7392 + (Math.random() - 0.5) * 0.1,
            lon: -104.9903 + (Math.random() - 0.5) * 0.1
        })),
        deals: [
            { dispensary: "Mock Dispensary 1", product: "Blue Dream", price_per_g: 5.0, category: "Flower" },
            { dispensary: "Mock Dispensary 2", product: "OG Kush", price_per_g: 6.5, category: "Flower" },
            { dispensary: "Mock Dispensary 3", product: "Edible Gummies", price_per_g: 8.0, category: "Edible" }
        ]
    }
}

export default async function () {
    return await fetchCannabisData()
}
