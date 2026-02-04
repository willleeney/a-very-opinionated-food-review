-- Auto-delete organisations when the last member leaves

CREATE OR REPLACE FUNCTION delete_empty_organisation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if there are any remaining members in the organisation
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = OLD.organisation_id
  ) THEN
    -- Delete the organisation (this will cascade to invites and requests)
    DELETE FROM organisations WHERE id = OLD.organisation_id;
  END IF;

  RETURN OLD;
END;
$$;

-- Trigger to run after a member is deleted
DROP TRIGGER IF EXISTS on_last_member_removed ON organisation_members;
CREATE TRIGGER on_last_member_removed
  AFTER DELETE ON organisation_members
  FOR EACH ROW
  EXECUTE FUNCTION delete_empty_organisation();
