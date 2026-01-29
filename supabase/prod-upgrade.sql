-- ONE-TIME PRODUCTION UPGRADE
-- Run this in Supabase SQL Editor to add multi-org support
-- This assumes base tables (restaurants, reviews, profiles, settings) already exist

------------------------------------------------------------
-- NEW TABLES
------------------------------------------------------------

-- Organisations
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  office_location JSONB DEFAULT NULL,
  tagline TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Organisation members
CREATE TABLE organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);

-- Organisation invites
CREATE TABLE organisation_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  UNIQUE(organisation_id, email)
);

-- Review visibility (which orgs can see the comment)
CREATE TABLE review_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(review_id, organisation_id)
);

------------------------------------------------------------
-- MODIFY EXISTING TABLES
------------------------------------------------------------

-- Add organisation_id to reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);

------------------------------------------------------------
-- INDEXES
------------------------------------------------------------

CREATE INDEX idx_organisation_members_org ON organisation_members(organisation_id);
CREATE INDEX idx_organisation_members_user ON organisation_members(user_id);
CREATE INDEX idx_organisation_invites_org ON organisation_invites(organisation_id);
CREATE INDEX idx_organisation_invites_token ON organisation_invites(token);
CREATE INDEX idx_organisation_invites_email ON organisation_invites(email);
CREATE INDEX idx_reviews_organisation ON reviews(organisation_id);
CREATE INDEX idx_review_visibility_review ON review_visibility(review_id);
CREATE INDEX idx_review_visibility_org ON review_visibility(organisation_id);

------------------------------------------------------------
-- FUNCTIONS
------------------------------------------------------------

-- Helper function to get user's org IDs (avoids RLS recursion)
CREATE OR REPLACE FUNCTION user_org_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT organisation_id FROM organisation_members WHERE user_id = user_uuid
$$;

------------------------------------------------------------
-- ROW LEVEL SECURITY
------------------------------------------------------------

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_visibility ENABLE ROW LEVEL SECURITY;

-- Organisations: public read, authenticated create, admin update
CREATE POLICY "Anyone can view organisations" ON organisations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create organisations" ON organisations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update their organisations" ON organisations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = organisations.id AND user_id = auth.uid() AND role = 'admin'
  ));

-- Organisation members
CREATE POLICY "Members can view organisation members" ON organisation_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organisation_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY "Admins can add members" ON organisation_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members
      WHERE organisation_id = organisation_members.organisation_id AND user_id = auth.uid() AND role = 'admin'
    )
    OR NOT EXISTS (
      SELECT 1 FROM organisation_members WHERE organisation_id = organisation_members.organisation_id
    )
  );

CREATE POLICY "Admins can remove members" ON organisation_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = organisation_members.organisation_id AND om.user_id = auth.uid() AND om.role = 'admin'
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Admins can update member roles" ON organisation_members FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.organisation_id = organisation_members.organisation_id AND om.user_id = auth.uid() AND om.role = 'admin'
  ));

-- Organisation invites
CREATE POLICY "Members can view their organisation's invites" ON organisation_invites FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisation_invites.organisation_id AND user_id = auth.uid())
    OR email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can create invites" ON organisation_invites FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = organisation_invites.organisation_id AND user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can delete invites" ON organisation_invites FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisation_invites.organisation_id AND user_id = auth.uid() AND role = 'admin')
    OR email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Review visibility
CREATE POLICY "Anyone can view review visibility" ON review_visibility FOR SELECT USING (true);
CREATE POLICY "Users can insert review visibility for own reviews" ON review_visibility FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete review visibility for own reviews" ON review_visibility FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND user_id = auth.uid()));

------------------------------------------------------------
-- SEED INITIAL ORGANISATION (StackOne)
------------------------------------------------------------

-- Create StackOne org with existing office location
INSERT INTO organisations (name, slug, office_location, tagline)
SELECT 'StackOne', 'stackone', value, 'Runway East, London Bridge'
FROM settings WHERE key = 'office_location';

-- Add all @stackone.com users as members, make will@stackone.com admin
INSERT INTO organisation_members (organisation_id, user_id, role)
SELECT
  (SELECT id FROM organisations WHERE slug = 'stackone'),
  id,
  CASE WHEN email = 'will@stackone.com' THEN 'admin' ELSE 'member' END
FROM auth.users WHERE email LIKE '%@stackone.com';

-- Make existing StackOne reviews visible to StackOne org
INSERT INTO review_visibility (review_id, organisation_id)
SELECT r.id, (SELECT id FROM organisations WHERE slug = 'stackone')
FROM reviews r
JOIN auth.users u ON r.user_id = u.id
WHERE u.email LIKE '%@stackone.com';
