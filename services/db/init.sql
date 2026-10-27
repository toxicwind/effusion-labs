-- Initialize Effusion Labs Database Schema

-- Cannabis/Weedmaps Tables
CREATE TABLE IF NOT EXISTS dispensaries (
    id SERIAL PRIMARY KEY,
    wmid BIGINT UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('dispensary', 'delivery', 'doctor')),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    phone_number VARCHAR(50),
    email VARCHAR(255),
    website TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    rating DECIMAL(3, 2) DEFAULT 0.00,
    reviews_count INTEGER DEFAULT 0,
    license_type VARCHAR(50),
    business_hours JSONB,
    social JSONB,
    licenses JSONB,
    avatar_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dispensaries_city ON dispensaries(city);
CREATE INDEX idx_dispensaries_state ON dispensaries(state);
CREATE INDEX idx_dispensaries_type ON dispensaries(type);
CREATE INDEX idx_dispensaries_location ON dispensaries USING GIST(
    ll_to_earth(latitude, longitude)
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    dispensary_id INTEGER REFERENCES dispensaries(id) ON DELETE CASCADE,
    wmid BIGINT,
    slug VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    genetics VARCHAR(50) CHECK (genetics IN ('indica', 'sativa', 'hybrid', 'cbd')),
    thc_percentage DECIMAL(5, 2),
    cbd_percentage DECIMAL(5, 2),
    thc_milligrams DECIMAL(10, 2),
    cbd_milligrams DECIMAL(10, 2),
    picture_url TEXT,
    description TEXT,
    online_orderable BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dispensary_id, slug)
);

CREATE INDEX idx_products_dispensary ON products(dispensary_id);
CREATE INDEX idx_products_genetics ON products(genetics);
CREATE INDEX idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    label VARCHAR(100),
    weight_value DECIMAL(10, 3),
    weight_unit VARCHAR(20),
    price_amount DECIMAL(10, 2) NOT NULL,
    price_currency VARCHAR(3) DEFAULT 'USD',
    sale_price_amount DECIMAL(10, 2),
    items_per_pack INTEGER,
    discount_label VARCHAR(100),
    license_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_price ON product_variants(price_amount);

-- Scraping Metadata
CREATE TABLE IF NOT EXISTS scrape_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    region_slug VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX idx_scrape_jobs_created ON scrape_jobs(created_at DESC);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dispensaries_updated_at BEFORE UPDATE ON dispensaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- PostGIS extension for geo queries (if available)
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
