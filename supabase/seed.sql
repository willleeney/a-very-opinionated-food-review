-- Seed data for local development
-- This file is automatically run after migrations when using `supabase db reset`

-- Use proper UUID format for all IDs

-- Create test organisations
INSERT INTO organisations (id, name, slug, office_location, tagline) VALUES
  ('11111111-0000-0000-0000-000000000001', 'StackOne', 'stackone', '{"lat": 51.5047, "lng": -0.0886}', 'Runway East, London Bridge'),
  ('22222222-0000-0000-0000-000000000002', 'Acme Corp', 'acme', '{"lat": 51.5074, "lng": -0.1278}', 'Central London Office'),
  ('33333333-0000-0000-0000-000000000003', 'Test Org', 'test-org', NULL, 'No office set');

-- Create test restaurants (global - no org_id)
-- Now uses 'cuisine' instead of 'type', and includes 'categories' array
INSERT INTO restaurants (id, name, cuisine, categories, latitude, longitude, address, notes) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Borough Market Kitchen', 'British', ARRAY['lunch', 'brunch'], 51.5055, -0.0910, '8 Southwark St, London SE1 1TL', 'Fresh local produce'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Padella', 'Italian', ARRAY['lunch', 'dinner'], 51.5054, -0.0902, '1 Phipp St, London EC2A 4PS', 'Fresh pasta, long queues'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Hawksmoor Borough', 'Steakhouse', ARRAY['dinner'], 51.5049, -0.0879, '16 Winchester Walk, London SE1 9AQ', 'Premium steaks'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Flat Iron', 'Steakhouse', ARRAY['lunch', 'dinner'], 51.5063, -0.0892, '17a Henrietta St, London WC2E 8QH', 'Budget-friendly steaks'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Pho', 'Vietnamese', ARRAY['lunch'], 51.5041, -0.0864, '3 Great Suffolk Yard, London SE1 0NS', 'Quick and tasty'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Monmouth Coffee', 'Cafe', ARRAY['coffee', 'brunch'], 51.5052, -0.0905, '2 Park St, London SE1 9AB', 'Best coffee in Borough'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'The Rake', 'Pub', ARRAY['pub', 'lunch'], 51.5057, -0.0908, '14 Winchester Walk, London SE1 9AG', 'Craft beer heaven'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Arabica Bar & Kitchen', 'Middle Eastern', ARRAY['lunch', 'dinner', 'brunch'], 51.5051, -0.0907, '3 Rochester Walk, London SE1 9AF', 'Great mezze');

-- Create test users directly in auth.users for local development
-- Password for all: 'password123' (bcrypt hash below)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'james@stackone.com', '$2a$06$zGAFqKk3V8Rak7rDVT3IC.8v.r7v7cnmNUa5uwomHEAOiaC5fZo5S', NOW(), NOW(), NOW(), '', '', '', ''),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sarah@stackone.com', '$2a$06$zGAFqKk3V8Rak7rDVT3IC.8v.r7v7cnmNUa5uwomHEAOiaC5fZo5S', NOW(), NOW(), NOW(), '', '', '', ''),
  ('bbbbbbbb-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alex@acme.com', '$2a$06$zGAFqKk3V8Rak7rDVT3IC.8v.r7v7cnmNUa5uwomHEAOiaC5fZo5S', NOW(), NOW(), NOW(), '', '', '', ''),
  ('bbbbbbbb-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maya@stackone.com', '$2a$06$zGAFqKk3V8Rak7rDVT3IC.8v.r7v7cnmNUa5uwomHEAOiaC5fZo5S', NOW(), NOW(), NOW(), '', '', '', ''),
  ('bbbbbbbb-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'private@example.com', '$2a$06$zGAFqKk3V8Rak7rDVT3IC.8v.r7v7cnmNUa5uwomHEAOiaC5fZo5S', NOW(), NOW(), NOW(), '', '', '', '');

-- Profiles are auto-created by trigger, but let's set display names and privacy
UPDATE profiles SET display_name = 'James Mitchell' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
UPDATE profiles SET display_name = 'Sarah Kim' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';
UPDATE profiles SET display_name = 'Alex Lee' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000003';
UPDATE profiles SET display_name = 'Maya Roberts' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000004';
UPDATE profiles SET display_name = 'Private User', is_private = true WHERE id = 'bbbbbbbb-0000-0000-0000-000000000005';

-- Add users to organisations
INSERT INTO organisation_members (organisation_id, user_id, role) VALUES
  ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'admin'),  -- James @ StackOne (admin)
  ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'member'), -- Sarah @ StackOne
  ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', 'member'), -- Maya @ StackOne
  ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003', 'admin'),  -- Alex @ Acme
  ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000005', 'member'); -- Private User @ StackOne

-- Create reviews with dual ratings (value_rating and taste_rating)
-- Note: 'rating' column is deprecated but still filled for backward compat
INSERT INTO reviews (id, restaurant_id, user_id, rating, value_rating, taste_rating, comment, organisation_id) VALUES
  -- Borough Market Kitchen reviews
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 8, 8, 7, 'Great value for Borough Market. Fresh ingredients, generous portions.', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 7, 7, 8, 'Lovely brunch spot. The eggs were perfect.', '11111111-0000-0000-0000-000000000001'),

  -- Padella reviews
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 9, 6, 9, 'Best pasta in London. Worth the queue but not cheap.', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003', 8, 5, 9, 'Incredible cacio e pepe. Pricey for what it is though.', '22222222-0000-0000-0000-000000000002'),

  -- Hawksmoor reviews
  ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 8, 4, 10, 'Expensive but the steak is phenomenal. Special occasion only.', '22222222-0000-0000-0000-000000000002'),

  -- Flat Iron reviews
  ('cccccccc-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 8, 9, 8, 'Best value steak in London. Free ice cream!', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000004', 7, 8, 7, 'Solid lunch option. Quick service.', '11111111-0000-0000-0000-000000000001'),

  -- Pho reviews
  ('cccccccc-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', 7, 8, 6, 'Quick and cheap. Not amazing but hits the spot.', '11111111-0000-0000-0000-000000000001'),

  -- Monmouth Coffee reviews
  ('cccccccc-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000002', 9, 7, 9, 'Best coffee in London. Period.', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000004', 8, 6, 9, 'Amazing flat white but tiny space and no seats.', '11111111-0000-0000-0000-000000000001'),

  -- The Rake reviews
  ('cccccccc-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000001', 7, 6, 7, 'Great beer selection. Food is just ok.', '11111111-0000-0000-0000-000000000001'),

  -- Arabica reviews
  ('cccccccc-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000002', 8, 7, 8, 'Fantastic mezze. Great for sharing.', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000003', 8, 7, 8, 'Love the shakshuka for brunch.', '22222222-0000-0000-0000-000000000002'),

  -- Private User's review (should only be visible to followers)
  ('cccccccc-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000005', 9, 8, 9, 'Secret review from private user - only followers can see this!', '11111111-0000-0000-0000-000000000001');

-- Create follow relationships
-- Maya follows James (but James does NOT follow Maya back - to test Follow back button)
INSERT INTO user_follows (follower_id, following_id) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002'),  -- James follows Sarah
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001'),  -- Sarah follows James
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004'),  -- Sarah follows Maya
  ('bbbbbbbb-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001'),  -- Maya follows James (James does NOT follow back)
  ('bbbbbbbb-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002'),  -- Maya follows Sarah
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000005');  -- James follows Private User (can see their reviews)

-- Create a pending follow request to the private user
INSERT INTO follow_requests (requester_id, target_id) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000005');  -- Sarah requested to follow Private User

-- Create settings table entry for office location (for backwards compatibility)
INSERT INTO settings (key, value) VALUES
  ('office_location', '{"lat": 51.5047, "lng": -0.0886}')
ON CONFLICT (key) DO NOTHING;
