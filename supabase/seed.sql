-- Seed data for local development
-- This file is automatically run after migrations when using `supabase db reset`

-- Use proper UUID format for all IDs

-- Create test organisations
INSERT INTO organisations (id, name, slug, office_location, tagline) VALUES
  ('11111111-0000-0000-0000-000000000001', 'StackOne', 'stackone', '{"lat": 51.5047, "lng": -0.0886}', 'Runway East, London Bridge'),
  ('22222222-0000-0000-0000-000000000002', 'Acme Corp', 'acme', '{"lat": 51.5074, "lng": -0.1278}', 'Central London Office'),
  ('33333333-0000-0000-0000-000000000003', 'Test Org', 'test-org', NULL, 'No office set');

-- Create test restaurants (global - no org_id)
INSERT INTO restaurants (id, name, type, latitude, longitude, address, notes) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Borough Market Kitchen', 'British', 51.5055, -0.0910, '8 Southwark St, London SE1 1TL', 'Fresh local produce'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Padella', 'Italian', 51.5054, -0.0902, '1 Phipp St, London EC2A 4PS', 'Fresh pasta, long queues'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Hawksmoor Borough', 'Steakhouse', 51.5049, -0.0879, '16 Winchester Walk, London SE1 9AQ', 'Premium steaks'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Flat Iron', 'Steakhouse', 51.5063, -0.0892, '17a Henrietta St, London WC2E 8QH', 'Budget-friendly steaks'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Pho', 'Vietnamese', 51.5041, -0.0864, '3 Great Suffolk Yard, London SE1 0NS', 'Quick and tasty');

-- Note: For local development, create test users via the Supabase Auth API or UI
-- Direct inserts into auth.users don't work properly with password auth
--
-- After running `supabase start`, create users with:
--   curl -X POST "http://127.0.0.1:54321/auth/v1/signup" \
--     -H "apikey: <ANON_KEY>" \
--     -H "Content-Type: application/json" \
--     -d '{"email":"test@stackone.com","password":"password123"}'
--
-- Then add them to organisations:
--   INSERT INTO organisation_members (organisation_id, user_id, role)
--   VALUES ('11111111-0000-0000-0000-000000000001', '<user_id>', 'admin');

-- Note: Organisation memberships, reviews, and invites require real users
-- Create users via Supabase Auth API first, then add their memberships manually
-- See instructions above for creating test users

-- Create settings table entry for office location (for backwards compatibility)
INSERT INTO settings (key, value) VALUES
  ('office_location', '{"lat": 51.5047, "lng": -0.0886}')
ON CONFLICT (key) DO NOTHING;
