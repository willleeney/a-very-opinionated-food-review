-- Add dish and photo_url columns to reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS dish TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create review-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for review-photos bucket
CREATE POLICY "Anyone can view review photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-photos');

CREATE POLICY "Users can upload own review photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'review-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own review photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'review-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own review photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'review-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
