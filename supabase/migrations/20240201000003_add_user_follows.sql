-- Migration: Add user following functionality

-- Create user_follows table
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)  -- Can't follow yourself
);

-- Enable RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see follow relationships (for discovery/display)
CREATE POLICY "Follow relationships are viewable by authenticated users"
  ON user_follows FOR SELECT TO authenticated
  USING (true);

-- Users can only create their own follows
CREATE POLICY "Users can follow others"
  ON user_follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());

-- Users can only delete their own follows
CREATE POLICY "Users can unfollow"
  ON user_follows FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

-- Indexes for efficient querying
CREATE INDEX idx_user_follows_follower ON user_follows (follower_id);
CREATE INDEX idx_user_follows_following ON user_follows (following_id);

-- Helper function to get IDs of users that a user follows
CREATE OR REPLACE FUNCTION get_following_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT following_id FROM user_follows WHERE follower_id = user_uuid
$$;

-- Helper function to get follower count for a user
CREATE OR REPLACE FUNCTION get_follower_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM user_follows WHERE following_id = user_uuid
$$;

-- Helper function to get following count for a user
CREATE OR REPLACE FUNCTION get_following_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM user_follows WHERE follower_id = user_uuid
$$;

-- Helper function to check if user A follows user B
CREATE OR REPLACE FUNCTION is_following(follower UUID, target UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_follows
    WHERE follower_id = follower AND following_id = target
  )
$$;

-- Add comments for documentation
COMMENT ON TABLE user_follows IS 'Tracks which users follow which other users';
COMMENT ON COLUMN user_follows.follower_id IS 'The user who is following';
COMMENT ON COLUMN user_follows.following_id IS 'The user being followed';
