-- Every new signup was landing without a profiles row.
--
-- Under Supabase, handle_new_user() fired on INSERT INTO auth.users and created
-- the profile. That table does not exist in Neon and the trigger was never
-- re-pointed at Better Auth's "user" table, so since the migration each new
-- account has had no display_name, avatar or privacy flag — they render as
-- "Unknown" in member lists and PersonalSettings has nothing to load.
--
-- Recreate it against "user". A trigger rather than application code, so it
-- covers every insert path (email signup, OAuth, and the e2e seed helpers).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    -- Better Auth collects a name at signup; fall back to the email local-part
    -- the way the original Supabase trigger did.
    COALESCE(NULLIF(TRIM(NEW.name), ''), SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created ON "user";
CREATE TRIGGER on_user_created
  AFTER INSERT ON "user"
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill anyone who signed up in the gap.
INSERT INTO profiles (id, email, display_name)
SELECT u.id, u.email, COALESCE(NULLIF(TRIM(u.name), ''), SPLIT_PART(u.email, '@', 1))
FROM "user" u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
