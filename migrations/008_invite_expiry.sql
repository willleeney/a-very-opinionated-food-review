-- can_add_org_member()'s self-add-with-invite branch joined organisation_invites
-- on email only: no expiry check, and the invite is never consumed. So an expired
-- or already-used invite granted membership indefinitely, and one invite could be
-- reused to rejoin after being removed.
--
-- Adding the expiry predicate here. (Consuming the invite is the API layer's job —
-- org-invites DELETE runs after a successful join.)
CREATE OR REPLACE FUNCTION can_add_org_member(org_id UUID, new_user_id TEXT, requesting_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT
    -- Requester is an admin of this org
    EXISTS (
      SELECT 1 FROM organisation_members
      WHERE organisation_id = org_id
      AND user_id = requesting_user_id
      AND role = 'admin'
    )
    -- Or the org has no members yet (first-member bootstrap). The organisations
    -- POST route now creates the org and its admin in one transaction, so this
    -- window is no longer reachable through normal use.
    OR NOT EXISTS (
      SELECT 1 FROM organisation_members
      WHERE organisation_id = org_id
    )
    -- Or the requester is adding themselves against an unexpired invite
    OR (
      new_user_id = requesting_user_id
      AND EXISTS (
        SELECT 1 FROM organisation_invites i
        JOIN profiles p ON p.email = i.email
        WHERE i.organisation_id = org_id
        AND p.id = new_user_id
        AND (i.expires_at IS NULL OR i.expires_at > now())
      )
    )
$$;
