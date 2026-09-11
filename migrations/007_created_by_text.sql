-- restaurants.created_by was left as UUID from the Supabase schema, but Better
-- Auth user ids are TEXT. Migrated users kept their old UUID strings so inserts
-- happened to work for them; any NEW signup gets a Better Auth nanoid and
-- INSERT INTO restaurants would fail with "invalid input syntax for type uuid".
-- Every other user-id column (reviews.user_id, profiles.id, ...) is already TEXT.
ALTER TABLE restaurants ALTER COLUMN created_by TYPE TEXT USING created_by::text;

-- Match the other user-id columns: point it at the Better Auth user table.
ALTER TABLE restaurants
  ADD CONSTRAINT fk_restaurants_created_by
  FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE SET NULL;
