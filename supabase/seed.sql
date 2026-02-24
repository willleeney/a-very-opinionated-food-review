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
INSERT INTO restaurants (id, name, cuisine, categories, latitude, longitude, address) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Borough Market Kitchen', 'British', ARRAY['lunch', 'brunch'], 51.5055, -0.0910, '8 Southwark St, London SE1 1TL'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Padella', 'Italian', ARRAY['lunch', 'dinner'], 51.5054, -0.0902, '1 Phipp St, London EC2A 4PS'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Hawksmoor Borough', 'Steakhouse', ARRAY['dinner'], 51.5049, -0.0879, '16 Winchester Walk, London SE1 9AQ'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Flat Iron', 'Steakhouse', ARRAY['lunch', 'dinner'], 51.5063, -0.0892, '17a Henrietta St, London WC2E 8QH'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Pho', 'Vietnamese', ARRAY['lunch'], 51.5041, -0.0864, '3 Great Suffolk Yard, London SE1 0NS'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Monmouth Coffee', 'Cafe', ARRAY['coffee', 'brunch'], 51.5052, -0.0905, '2 Park St, London SE1 9AB'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'The Rake', 'Pub', ARRAY['pub', 'lunch'], 51.5057, -0.0908, '14 Winchester Walk, London SE1 9AG'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Arabica Bar & Kitchen', 'Middle Eastern', ARRAY['lunch', 'dinner', 'brunch'], 51.5051, -0.0907, '3 Rochester Walk, London SE1 9AF');

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
-- photo_url uses Unsplash for seed data (in production, stored in Supabase Storage)
INSERT INTO reviews (id, restaurant_id, user_id, rating, value_rating, taste_rating, comment, dish, photo_url, organisation_id) VALUES
  -- Borough Market Kitchen reviews (4 reviews, 3 with photos)
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 8, 8, 7, 'Great value for Borough Market. Fresh ingredients, generous portions.', 'Full English', 'https://images.unsplash.com/photo-1533920379810-6bed1ceca39c?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 7, 7, 8, 'Lovely brunch spot. The eggs were perfect.', 'Eggs Benedict', 'https://images.unsplash.com/photo-1608039829572-9b1234ef1321?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', 8, 8, 8, 'The sourdough toast with smoked salmon is unreal. Great coffee too.', 'Smoked Salmon Toast', 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000016', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', 6, 5, 7, 'Overpriced for what it is. Decent but not worth the Borough premium.', NULL, NULL, '22222222-0000-0000-0000-000000000002'),

  -- Padella reviews (5 reviews, 4 with photos)
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 9, 6, 9, 'Best pasta in London. Worth the queue but not cheap.', 'Pici Cacio e Pepe', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003', 8, 5, 9, 'Incredible cacio e pepe. Pricey for what it is though.', 'Cacio e Pepe', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&h=600&fit=crop', '22222222-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 10, 7, 10, 'Perfect pappardelle ragu. I dream about this pasta.', 'Pappardelle Ragu', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000018', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004', 9, 6, 10, 'The tagliatelle with nduja is incredible. Queue was 45 min though.', 'Tagliatelle Nduja', 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000005', 9, 8, 9, 'Secret review from private user - only followers can see this!', 'Pici Ragu', NULL, '11111111-0000-0000-0000-000000000001'),

  -- Hawksmoor reviews (3 reviews, 2 with photos)
  ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 8, 4, 10, 'Expensive but the steak is phenomenal. Special occasion only.', 'Bone-in Prime Rib', 'https://images.unsplash.com/photo-1558030006-450675393462?w=600&h=600&fit=crop', '22222222-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000019', 'aaaaaaaa-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 9, 3, 10, 'The pre-theatre menu is unbelievable value. Steak was cooked to perfection.', 'Ribeye', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000020', 'aaaaaaaa-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 7, 3, 9, 'Amazing steak but honestly too pricey for a regular lunch.', 'Fillet Steak', NULL, '11111111-0000-0000-0000-000000000001'),

  -- Flat Iron reviews (4 reviews, 3 with photos)
  ('cccccccc-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 8, 9, 8, 'Best value steak in London. Free ice cream!', 'Flat Iron Steak', 'https://images.unsplash.com/photo-1432139509613-5c4255a1d197?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000004', 7, 8, 7, 'Solid lunch option. Quick service.', 'Flat Iron Steak', 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 8, 9, 7, 'Such good value. The creamed spinach side is a must.', 'Flat Iron Steak', 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000022', 'aaaaaaaa-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000003', 7, 8, 6, 'Decent steak for the price. Nothing fancy but it works.', NULL, NULL, '22222222-0000-0000-0000-000000000002'),

  -- Pho reviews (3 reviews, 2 with photos)
  ('cccccccc-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', 7, 8, 6, 'Quick and cheap. Not amazing but hits the spot.', 'Pho Bo', 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000023', 'aaaaaaaa-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', 6, 7, 5, 'Bit bland honestly. The banh mi was better than the pho.', 'Banh Mi', 'https://images.unsplash.com/photo-1600454021915-de0ec7b65c18?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000024', 'aaaaaaaa-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000004', 7, 8, 7, 'Good for a quick lunch. Spring rolls are great.', 'Spring Rolls', NULL, '11111111-0000-0000-0000-000000000001'),

  -- Monmouth Coffee reviews (3 reviews, 2 with photos)
  ('cccccccc-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000002', 9, 7, 9, 'Best coffee in London. Period.', 'Flat White', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000004', 8, 6, 9, 'Amazing flat white but tiny space and no seats.', 'Espresso', 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000025', 'aaaaaaaa-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000001', 9, 7, 10, 'The single origin filter is next level. Queue can be brutal on Saturdays.', 'Filter Coffee', NULL, '11111111-0000-0000-0000-000000000001'),

  -- The Rake reviews (3 reviews, 2 with photos)
  ('cccccccc-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000001', 7, 6, 7, 'Great beer selection. Food is just ok.', 'IPA', 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000026', 'aaaaaaaa-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000004', 6, 5, 6, 'Tiny pub with good vibes. Beer is expensive though.', 'Pale Ale', 'https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000027', 'aaaaaaaa-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000002', 7, 6, 7, 'Nice for a quick after-work pint. Nothing more.', NULL, NULL, '11111111-0000-0000-0000-000000000001'),

  -- Arabica reviews (5 reviews, 4 with photos)
  ('cccccccc-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000002', 8, 7, 8, 'Fantastic mezze. Great for sharing.', 'Mezze Platter', 'https://images.unsplash.com/photo-1540914124281-342587941389?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000003', 8, 7, 8, 'Love the shakshuka for brunch.', 'Shakshuka', 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=600&h=600&fit=crop', '22222222-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000028', 'aaaaaaaa-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000001', 9, 8, 9, 'The lamb shawarma wrap is insane. Best lunch under a tenner.', 'Lamb Shawarma', 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000029', 'aaaaaaaa-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000004', 8, 7, 9, 'Hummus is the best I have had outside of the Middle East. Warm bread is perfect.', 'Hummus & Bread', 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=600&h=600&fit=crop', '11111111-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000030', 'aaaaaaaa-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000005', 7, 6, 7, 'Decent but portions are small for the price.', NULL, NULL, '11111111-0000-0000-0000-000000000001');

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

-- Add review tags (look up tag IDs by name)
INSERT INTO review_tags (review_id, tag_id) VALUES
  -- Borough Market Kitchen: Full English → High Protein, Large Portion
  ('cccccccc-0000-0000-0000-000000000001', (SELECT id FROM tags WHERE name = 'High Protein')),
  ('cccccccc-0000-0000-0000-000000000001', (SELECT id FROM tags WHERE name = 'Large Portion')),
  -- Borough Market Kitchen: Eggs Benedict → Healthy
  ('cccccccc-0000-0000-0000-000000000002', (SELECT id FROM tags WHERE name = 'Healthy')),
  -- Borough Market Kitchen: Smoked Salmon Toast → Healthy, Outdoor Seating
  ('cccccccc-0000-0000-0000-000000000015', (SELECT id FROM tags WHERE name = 'Healthy')),
  ('cccccccc-0000-0000-0000-000000000015', (SELECT id FROM tags WHERE name = 'Outdoor Seating')),

  -- Padella: Pici Cacio e Pepe → Good Value
  ('cccccccc-0000-0000-0000-000000000003', (SELECT id FROM tags WHERE name = 'Good Value')),
  -- Padella: Pappardelle Ragu → Large Portion
  ('cccccccc-0000-0000-0000-000000000017', (SELECT id FROM tags WHERE name = 'Large Portion')),
  -- Padella: Tagliatelle Nduja → High Protein
  ('cccccccc-0000-0000-0000-000000000018', (SELECT id FROM tags WHERE name = 'High Protein')),

  -- Hawksmoor: Bone-in Prime Rib → High Protein, Large Portion
  ('cccccccc-0000-0000-0000-000000000005', (SELECT id FROM tags WHERE name = 'High Protein')),
  ('cccccccc-0000-0000-0000-000000000005', (SELECT id FROM tags WHERE name = 'Large Portion')),
  -- Hawksmoor: Ribeye → High Protein
  ('cccccccc-0000-0000-0000-000000000019', (SELECT id FROM tags WHERE name = 'High Protein')),

  -- Flat Iron: Steak (James) → Good Value, High Protein, Quick
  ('cccccccc-0000-0000-0000-000000000006', (SELECT id FROM tags WHERE name = 'Good Value')),
  ('cccccccc-0000-0000-0000-000000000006', (SELECT id FROM tags WHERE name = 'High Protein')),
  ('cccccccc-0000-0000-0000-000000000006', (SELECT id FROM tags WHERE name = 'Quick')),
  -- Flat Iron: Steak (Maya) → Quick
  ('cccccccc-0000-0000-0000-000000000007', (SELECT id FROM tags WHERE name = 'Quick')),
  -- Flat Iron: Steak (Sarah) → Good Value, Large Portion
  ('cccccccc-0000-0000-0000-000000000021', (SELECT id FROM tags WHERE name = 'Good Value')),
  ('cccccccc-0000-0000-0000-000000000021', (SELECT id FROM tags WHERE name = 'Large Portion')),

  -- Pho: Pho Bo → Quick, Good Value
  ('cccccccc-0000-0000-0000-000000000008', (SELECT id FROM tags WHERE name = 'Quick')),
  ('cccccccc-0000-0000-0000-000000000008', (SELECT id FROM tags WHERE name = 'Good Value')),
  -- Pho: Spring Rolls → Quick, Vegan Options
  ('cccccccc-0000-0000-0000-000000000024', (SELECT id FROM tags WHERE name = 'Quick')),
  ('cccccccc-0000-0000-0000-000000000024', (SELECT id FROM tags WHERE name = 'Vegan Options')),

  -- Monmouth Coffee: Flat White → Quick
  ('cccccccc-0000-0000-0000-000000000009', (SELECT id FROM tags WHERE name = 'Quick')),
  -- Monmouth Coffee: Espresso → Quick
  ('cccccccc-0000-0000-0000-000000000010', (SELECT id FROM tags WHERE name = 'Quick')),

  -- The Rake: IPA → Outdoor Seating
  ('cccccccc-0000-0000-0000-000000000011', (SELECT id FROM tags WHERE name = 'Outdoor Seating')),
  -- The Rake: Pale Ale → Outdoor Seating
  ('cccccccc-0000-0000-0000-000000000026', (SELECT id FROM tags WHERE name = 'Outdoor Seating')),

  -- Arabica: Mezze Platter → Healthy, Vegan Options
  ('cccccccc-0000-0000-0000-000000000012', (SELECT id FROM tags WHERE name = 'Healthy')),
  ('cccccccc-0000-0000-0000-000000000012', (SELECT id FROM tags WHERE name = 'Vegan Options')),
  -- Arabica: Shakshuka → Healthy
  ('cccccccc-0000-0000-0000-000000000013', (SELECT id FROM tags WHERE name = 'Healthy')),
  -- Arabica: Lamb Shawarma → Good Value, High Protein
  ('cccccccc-0000-0000-0000-000000000028', (SELECT id FROM tags WHERE name = 'Good Value')),
  ('cccccccc-0000-0000-0000-000000000028', (SELECT id FROM tags WHERE name = 'High Protein')),
  -- Arabica: Hummus & Bread → Vegan Options
  ('cccccccc-0000-0000-0000-000000000029', (SELECT id FROM tags WHERE name = 'Vegan Options'));

-- Create settings table entry for office location (for backwards compatibility)
INSERT INTO settings (key, value) VALUES
  ('office_location', '{"lat": 51.5047, "lng": -0.0886}')
ON CONFLICT (key) DO NOTHING;
