-- Migration: Add follow requests for private accounts

-- Add is_private column to profiles (default: false = open account)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Create follow_requests table for private accounts
CREATE TABLE follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, target_id),
  CHECK (requester_id != target_id)  -- Can't request to follow yourself
);

-- Enable RLS
ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests (sent or received)
CREATE POLICY "Users can view own follow requests"
  ON follow_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid());

-- Users can create follow requests
CREATE POLICY "Users can create follow requests"
  ON follow_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Users can delete requests (cancel their own, or reject received ones)
CREATE POLICY "Users can delete follow requests"
  ON follow_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid());

-- Indexes for efficient querying
CREATE INDEX idx_follow_requests_requester ON follow_requests (requester_id);
CREATE INDEX idx_follow_requests_target ON follow_requests (target_id);

-- Helper function to check if there's a pending request
CREATE OR REPLACE FUNCTION has_pending_follow_request(requester UUID, target UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM follow_requests
    WHERE requester_id = requester AND target_id = target
  )
$$;

-- Helper function to get pending request count for a user
CREATE OR REPLACE FUNCTION get_pending_request_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM follow_requests WHERE target_id = user_uuid
$$;

-- Function to accept a follow request (bypasses RLS since target user approves)
CREATE OR REPLACE FUNCTION accept_follow_request(requester UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  -- Verify the request exists and is for the current user
  IF NOT EXISTS (
    SELECT 1 FROM follow_requests
    WHERE requester_id = requester AND target_id = current_user_id
  ) THEN
    RETURN FALSE;
  END IF;

  -- Create the follow relationship
  INSERT INTO user_follows (follower_id, following_id)
  VALUES (requester, current_user_id)
  ON CONFLICT DO NOTHING;

  -- Delete the request
  DELETE FROM follow_requests
  WHERE requester_id = requester AND target_id = current_user_id;

  RETURN TRUE;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE follow_requests IS 'Pending follow requests for private accounts';
COMMENT ON COLUMN follow_requests.requester_id IS 'The user requesting to follow';
COMMENT ON COLUMN follow_requests.target_id IS 'The private account user being requested to follow';
COMMENT ON COLUMN profiles.is_private IS 'If true, users must request to follow and be approved';
