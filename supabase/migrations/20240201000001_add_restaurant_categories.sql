-- Migration: Add categories to restaurants
-- Categories: lunch, dinner, coffee, brunch, pub
-- A restaurant can have multiple categories (stored as array)

-- Add categories column
ALTER TABLE restaurants
ADD COLUMN categories TEXT[] DEFAULT '{}';

-- Add check constraint for valid categories
ALTER TABLE restaurants
ADD CONSTRAINT valid_categories
CHECK (categories <@ ARRAY['lunch', 'dinner', 'coffee', 'brunch', 'pub']::TEXT[]);

-- Create index for category filtering (GIN index for array containment queries)
CREATE INDEX idx_restaurants_categories ON restaurants USING GIN (categories);

-- Migrate existing 'type' field to categories (best effort mapping based on common patterns)
UPDATE restaurants SET categories =
  CASE
    WHEN LOWER(type) LIKE '%coffee%' OR LOWER(type) LIKE '%cafe%' OR LOWER(type) LIKE '%café%' THEN ARRAY['coffee']
    WHEN LOWER(type) LIKE '%pub%' OR LOWER(type) LIKE '%bar%' THEN ARRAY['pub']
    WHEN LOWER(type) LIKE '%brunch%' OR LOWER(type) LIKE '%breakfast%' THEN ARRAY['brunch']
    WHEN LOWER(type) LIKE '%dinner%' OR LOWER(type) LIKE '%fine dining%' THEN ARRAY['dinner']
    ELSE ARRAY['lunch']  -- Default to lunch for existing entries
  END
WHERE categories = '{}' OR categories IS NULL;

-- Rename 'type' to 'cuisine' for clarity (type was used for cuisine like "British", "Italian")
ALTER TABLE restaurants RENAME COLUMN type TO cuisine;

-- Add comment for documentation
COMMENT ON COLUMN restaurants.categories IS 'Array of meal categories: lunch, dinner, coffee, brunch, pub';
COMMENT ON COLUMN restaurants.cuisine IS 'Cuisine type (e.g., British, Italian, Vietnamese)';
