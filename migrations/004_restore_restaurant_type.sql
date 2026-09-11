-- Production's restaurants table kept both `type` and `cuisine`: the original
-- rename migration added `cuisine` but never dropped `type`, and ReviewTable.tsx
-- still renders and sorts by `type`. Restore it so the migrated data round-trips.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS type TEXT;

-- Production never ran the security-hardening migration, so `cuisine` is
-- nullable there. Match that rather than rejecting rows on import.
ALTER TABLE restaurants ALTER COLUMN cuisine DROP NOT NULL;
