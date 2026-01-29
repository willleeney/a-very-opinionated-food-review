-- Complete database schema for local development

------------------------------------------------------------
-- TABLES
------------------------------------------------------------

-- Restaurants (global, not org-specific)
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  notes TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles (auto-created on signup)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  user_id UUID REFERENCES auth.users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  comment TEXT,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Review visibility (which orgs can see the comment)
CREATE TABLE review_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(review_id, organisation_id)
);

-- Settings (key-value store)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    SPLIT_PART(NEW.email, '@', 1)
  );
  RETURN NEW;
END;
$$;

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
-- TRIGGERS
------------------------------------------------------------

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

------------------------------------------------------------
-- ROW LEVEL SECURITY
------------------------------------------------------------

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Restaurants: public read, authenticated write
CREATE POLICY "Anyone can view restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert restaurants" ON restaurants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update restaurants" ON restaurants FOR UPDATE TO authenticated USING (true);

-- Profiles: public read, own write
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Organisations: public read, authenticated create, admin update
CREATE POLICY "Anyone can view organisations" ON organisations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create organisations" ON organisations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update their organisations" ON organisations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = organisations.id AND user_id = auth.uid() AND role = 'admin'
  ));

-- Organisation members: members can view their org's members
CREATE POLICY "Members can view organisation members" ON organisation_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organisation_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY "Can add members" ON organisation_members FOR INSERT TO authenticated
  WITH CHECK (
    -- Admin of the org can add anyone
    EXISTS (
      SELECT 1 FROM organisation_members AS existing
      WHERE existing.organisation_id = organisation_id
      AND existing.user_id = auth.uid()
      AND existing.role = 'admin'
    )
    -- First member of a new org
    OR NOT EXISTS (
      SELECT 1 FROM organisation_members AS existing
      WHERE existing.organisation_id = organisation_id
    )
    -- User accepting their own invite (adding themselves)
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM organisation_invites
        WHERE organisation_invites.organisation_id = organisation_id
        AND organisation_invites.email = (SELECT email FROM profiles WHERE id = auth.uid())
      )
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

-- Organisation invites: members view, admin manage
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

-- Reviews: public read, own write
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Review visibility: public read, own review manage
CREATE POLICY "Anyone can view review visibility" ON review_visibility FOR SELECT USING (true);
CREATE POLICY "Users can insert review visibility for own reviews" ON review_visibility FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete review visibility for own reviews" ON review_visibility FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND user_id = auth.uid()));

-- Settings: public read, authenticated write
CREATE POLICY "Anyone can view settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update settings" ON settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);
