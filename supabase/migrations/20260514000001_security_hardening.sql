-- Security hardening migration
-- Adds created_by to restaurants, tightens RLS on restaurants and settings

-- 1. Add created_by column to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. Tighten restaurant UPDATE policy
-- Drop the existing overly-permissive UPDATE policy (if it exists)
DROP POLICY IF EXISTS "Authenticated users can update restaurants" ON restaurants;
DROP POLICY IF EXISTS "Anyone can update restaurants" ON restaurants;

-- Only the creator can update a restaurant (legacy rows with NULL created_by can be updated by anyone authenticated)
CREATE POLICY "Creator can update restaurants" ON restaurants
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL);

-- 3. Tighten restaurant INSERT policy
-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert restaurants" ON restaurants;

-- Must set created_by to own user id
CREATE POLICY "Authenticated users can insert restaurants" ON restaurants
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 4. Tighten settings policies
-- Drop overly-permissive settings INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON settings;
DROP POLICY IF EXISTS "Anyone can insert settings" ON settings;

-- Only org admins can modify settings
CREATE POLICY "Org admins can insert settings" ON settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Org admins can update settings" ON settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
