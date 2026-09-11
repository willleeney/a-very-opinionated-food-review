# Database migrations

SQL schema for the Neon Postgres database, applied with `psql` in filename order.
There is no migration runner — these are applied by hand and this directory is
the record of what has been run.

```bash
psql "$DATABASE_URL" -f migrations/001_schema.sql
```

`DATABASE_URL` is the Neon connection string. Use the **unpooled** (direct) one
for DDL; the pooled `-pooler` host is for the app.

## Order

| File | What it does |
| --- | --- |
| `001_schema.sql` | App tables, indexes, helper functions, the empty-org cleanup trigger, and the seed tags. Ported from the Supabase schema with RLS stripped — access control now lives in the API routes. |
| `002_better_auth.sql` | Better Auth's `user`, `session`, `account` and `verification` tables, plus the FK from `profiles` to `user`. Column names are quoted camelCase, which is Better Auth's convention. |
| `004_restore_restaurant_type.sql` | Restores `restaurants.type`. Production kept both `type` and `cuisine` because the original rename never completed, and `ReviewTable` still renders `type`. Also drops the NOT NULL on `cuisine` to match production. |
| `007_created_by_text.sql` | `restaurants.created_by` was `UUID`, but Better Auth user ids are `TEXT`. Migrated users kept their old UUID strings so inserts happened to work, but any new signup would fail with `invalid input syntax for type uuid`. |
| `008_invite_expiry.sql` | `can_add_org_member()` matched invites on email only, so an expired or already-used invite granted membership indefinitely. Adds the expiry check. |
| `009_profile_on_signup.sql` | Recreates the profile-on-signup trigger against `user`. Supabase had this on `auth.users`; that table does not exist in Neon, so after the migration every new account had no `profiles` row and rendered as "Unknown". Also backfills anyone caught in the gap. |

Numbers 003, 005 and 006 are not missing — they were one-off Node scripts rather
than SQL. See below.

## One-off migration scripts

`one-off/` holds the scripts that moved data off Supabase in September 2026.
They are kept as a record of how production was migrated. **They are archival and
are not expected to run again** — they read from a Supabase project that is now
dormant, and their dependencies (`@neondatabase/serverless`, `aws4fetch`,
`dotenv`) were installed outside this repo.

| File | What it did |
| --- | --- |
| `003_migrate_users.ts` | Copied 20 accounts from Supabase Auth into the Better Auth tables, preserving ids and provider links. Password hashes are not exposed by the Supabase API, so the three email/password users had to reset their passwords. |
| `005_migrate_data.ts` | Copied the application tables, preserving primary keys so every foreign key stayed intact. |
| `006_migrate_storage.ts` | Copied review photos into the R2 bucket and rewrote the stored URLs from Supabase Storage to `/api/media/...`. |

## Notes

- Credentials live outside this repo, in `~/Documents/personal/tastefull/.env`.
  Nothing in this directory contains secrets.
- Applying a migration does not update any local database automatically — the
  Neon `dev` branch is separate and needs the same file applied to it.
