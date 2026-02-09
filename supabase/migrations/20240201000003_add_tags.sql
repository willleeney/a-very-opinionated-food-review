-- Migration: Replace taste_rating and value_rating with tags system
-- Tags are descriptive labels like "High Protein", "Quick", "Good Value" etc.

-- Create tags table with predefined tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create review_tags junction table
CREATE TABLE IF NOT EXISTS review_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(review_id, tag_id)
);

-- Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_tags ENABLE ROW LEVEL SECURITY;

-- Tags are readable by everyone
CREATE POLICY "Anyone can view tags" ON tags FOR SELECT USING (true);

-- Review tags are readable by everyone (visibility handled in app layer like reviews)
CREATE POLICY "Anyone can view review tags" ON review_tags FOR SELECT USING (true);

-- Authenticated users can add review tags to their own reviews
CREATE POLICY "Users can add tags to own reviews" ON review_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND user_id = auth.uid()));

-- Users can remove tags from their own reviews
CREATE POLICY "Users can remove tags from own reviews" ON review_tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND user_id = auth.uid()));

-- Create indexes
CREATE INDEX idx_review_tags_review ON review_tags(review_id);
CREATE INDEX idx_review_tags_tag ON review_tags(tag_id);

-- Insert predefined tags
INSERT INTO tags (name, icon) VALUES
  ('High Protein', '💪'),
  ('Healthy', '🥗'),
  ('Good Value', '💰'),
  ('Quick', '⚡'),
  ('Large Portion', '🍽️'),
  ('Vegan Options', '🌱'),
  ('Quiet', '🤫'),
  ('Outdoor Seating', '☀️')
ON CONFLICT (name) DO NOTHING;

-- Drop the old rating columns (optional - can keep for historical data)
-- ALTER TABLE reviews DROP COLUMN IF EXISTS taste_rating;
-- ALTER TABLE reviews DROP COLUMN IF EXISTS value_rating;

-- Add comments
COMMENT ON TABLE tags IS 'Predefined tags for categorizing reviews';
COMMENT ON TABLE review_tags IS 'Junction table linking reviews to tags';
