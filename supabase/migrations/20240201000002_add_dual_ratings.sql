-- Migration: Add value_rating and taste_rating to reviews
-- These are optional additional ratings alongside the overall 'rating' field

-- Add value_rating column (optional)
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 10);

-- Add taste_rating column (optional)
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS taste_rating INTEGER CHECK (taste_rating >= 1 AND taste_rating <= 10);

-- Create indexes for filtering by rating
CREATE INDEX IF NOT EXISTS idx_reviews_value_rating ON reviews (value_rating);
CREATE INDEX IF NOT EXISTS idx_reviews_taste_rating ON reviews (taste_rating);

-- Add comments
COMMENT ON COLUMN reviews.rating IS 'Overall rating (1-10): required';
COMMENT ON COLUMN reviews.value_rating IS 'Value rating (1-10): optional, bang for your buck';
COMMENT ON COLUMN reviews.taste_rating IS 'Taste rating (1-10): optional, how good the food is';
