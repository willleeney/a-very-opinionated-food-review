-- Tastefull schema for Neon Postgres
-- Migrated from Supabase: strips RLS, auth.users refs, storage buckets
-- Auth is handled by Better Auth (creates its own user/session/account/verification tables)
-- Access control moves to application middleware

------------------------------------------------------------
-- APPLICATION TABLES
------------------------------------------------------------

CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  categories TEXT[] DEFAULT '{}',
  latitude NUMERIC,
  longitude NUMERIC,
  address TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_categories CHECK (categories <@ ARRAY['lunch', 'dinner', 'coffee', 'brunch', 'pub']::TEXT[])
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  is_private BOOLEAN DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  office_location JSONB DEFAULT NULL,
  tagline TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);

CREATE TABLE organisation_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  invited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  UNIQUE(organisation_id, email)
);

CREATE TABLE organisation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  user_id TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 10),
  taste_rating INTEGER CHECK (taste_rating >= 1 AND taste_rating <= 10),
  comment TEXT,
  dish TEXT,
  photo_url TEXT,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE review_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(review_id, organisation_id)
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE review_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(review_id, tag_id)
);

CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE TABLE follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, target_id),
  CHECK (requester_id != target_id)
);

CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

------------------------------------------------------------
-- INDEXES
------------------------------------------------------------

CREATE INDEX idx_restaurants_categories ON restaurants USING GIN (categories);
CREATE INDEX idx_organisation_members_org ON organisation_members(organisation_id);
CREATE INDEX idx_organisation_members_user ON organisation_members(user_id);
CREATE INDEX idx_organisation_invites_org ON organisation_invites(organisation_id);
CREATE INDEX idx_organisation_invites_token ON organisation_invites(token);
CREATE INDEX idx_organisation_invites_email ON organisation_invites(email);
CREATE INDEX idx_organisation_requests_org ON organisation_requests(organisation_id);
CREATE INDEX idx_organisation_requests_user ON organisation_requests(user_id);
CREATE INDEX idx_reviews_organisation ON reviews(organisation_id);
CREATE INDEX idx_reviews_value_rating ON reviews(value_rating);
CREATE INDEX idx_reviews_taste_rating ON reviews(taste_rating);
CREATE INDEX idx_review_visibility_review ON review_visibility(review_id);
CREATE INDEX idx_review_visibility_org ON review_visibility(organisation_id);
CREATE INDEX idx_review_tags_review ON review_tags(review_id);
CREATE INDEX idx_review_tags_tag ON review_tags(tag_id);
CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);
CREATE INDEX idx_follow_requests_requester ON follow_requests(requester_id);
CREATE INDEX idx_follow_requests_target ON follow_requests(target_id);
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);

------------------------------------------------------------
-- HELPER FUNCTIONS
-- auth.uid() removed — caller passes user_id explicitly
------------------------------------------------------------

CREATE OR REPLACE FUNCTION user_org_ids(user_id TEXT)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT organisation_id FROM organisation_members WHERE organisation_members.user_id = user_org_ids.user_id
$$;

CREATE OR REPLACE FUNCTION can_add_org_member(org_id UUID, new_user_id TEXT, requesting_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM organisation_members
      WHERE organisation_id = org_id
      AND user_id = requesting_user_id
      AND role = 'admin'
    )
    OR NOT EXISTS (
      SELECT 1 FROM organisation_members
      WHERE organisation_id = org_id
    )
    OR (
      new_user_id = requesting_user_id
      AND EXISTS (
        SELECT 1 FROM organisation_invites i
        JOIN profiles p ON p.email = i.email
        WHERE i.organisation_id = org_id
        AND p.id = new_user_id
      )
    )
$$;

CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = org_id
    AND user_id = check_user_id
    AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION has_pending_follow_request(requester TEXT, target TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM follow_requests
    WHERE requester_id = requester AND target_id = target
  )
$$;

CREATE OR REPLACE FUNCTION get_pending_request_count(user_id TEXT)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM follow_requests WHERE target_id = user_id
$$;

CREATE OR REPLACE FUNCTION get_following_ids(user_id TEXT)
RETURNS SETOF TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT following_id FROM user_follows WHERE follower_id = user_id
$$;

CREATE OR REPLACE FUNCTION get_follower_count(user_id TEXT)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM user_follows WHERE following_id = user_id
$$;

CREATE OR REPLACE FUNCTION get_following_count(user_id TEXT)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM user_follows WHERE follower_id = user_id
$$;

CREATE OR REPLACE FUNCTION is_following(follower TEXT, target TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_follows
    WHERE follower_id = follower AND following_id = target
  )
$$;

CREATE OR REPLACE FUNCTION accept_follow_request(requester TEXT, current_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM follow_requests
    WHERE requester_id = requester AND target_id = current_user_id
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO user_follows (follower_id, following_id)
  VALUES (requester, current_user_id)
  ON CONFLICT DO NOTHING;

  DELETE FROM follow_requests
  WHERE requester_id = requester AND target_id = current_user_id;

  RETURN TRUE;
END;
$$;

------------------------------------------------------------
-- TRIGGERS
------------------------------------------------------------

CREATE OR REPLACE FUNCTION delete_empty_organisation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = OLD.organisation_id
  ) THEN
    DELETE FROM organisations WHERE id = OLD.organisation_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_last_member_removed
  AFTER DELETE ON organisation_members
  FOR EACH ROW
  EXECUTE FUNCTION delete_empty_organisation();

------------------------------------------------------------
-- SEED DATA
------------------------------------------------------------

INSERT INTO tags (name) VALUES
  ('High Protein'),
  ('Healthy'),
  ('Good Value'),
  ('Quick'),
  ('Large Portion'),
  ('Vegan Options'),
  ('Quiet'),
  ('Outdoor Seating')
ON CONFLICT (name) DO NOTHING;
