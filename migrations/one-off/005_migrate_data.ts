/**
 * Copies application data from Supabase to Neon, preserving primary keys so all
 * foreign keys stay intact. Idempotent: re-running skips rows that already exist.
 *
 * Run AFTER 003_migrate_users.ts, since reviews/members reference user ids.
 */
import { Pool } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'

dotenv.config()

const { SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL } = process.env as Record<string, string>

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  const pageSize = 1000

  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        Range: `${offset}-${offset + pageSize - 1}`,
      },
    })
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)

    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    rows.push(...batch)
    if (batch.length < pageSize) break
  }

  return rows
}

/** Inserts rows, keeping their ids. Unlisted columns are ignored. */
async function copy(
  pool: Pool,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
  conflictTarget: string,
) {
  if (rows.length === 0) {
    console.log(`  ${table}: nothing to copy`)
    return
  }

  let inserted = 0
  for (const row of rows) {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const values = columns.map((c) => row[c] ?? null)
    const { rowCount } = await pool.query(
      `INSERT INTO ${table} (${columns.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (${conflictTarget}) DO NOTHING`,
      values,
    )
    inserted += rowCount ?? 0
  }
  console.log(`  ${table}: ${inserted} inserted, ${rows.length - inserted} already present`)
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL })

  // Tags first, and with production's real ids. 001_schema.sql seeded eight tags
  // with freshly generated uuids; review_tags references production's ids, so the
  // seeded rows have to go or those foreign keys would dangle.
  const tags = await fetchAll('tags')
  if (tags.length > 0) {
    const prodIds = tags.map((t) => t.id)
    const { rowCount: dropped } = await pool.query(
      `DELETE FROM tags WHERE id <> ALL($1) AND NOT EXISTS (
         SELECT 1 FROM review_tags WHERE review_tags.tag_id = tags.id
       )`,
      [prodIds],
    )
    if (dropped) console.log(`  tags: dropped ${dropped} seeded placeholder(s)`)
  }
  await copy(pool, 'tags', ['id', 'name', 'created_at'], tags, 'id')

  // profiles rows already exist from the user migration, but production holds the
  // real display_name/avatar_url/is_private — let those win.
  const profiles = await fetchAll('profiles')
  for (const p of profiles) {
    await pool.query(
      `INSERT INTO profiles (id, email, display_name, is_private, avatar_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         is_private = EXCLUDED.is_private,
         avatar_url = EXCLUDED.avatar_url`,
      [p.id, p.email, p.display_name, p.is_private ?? false, p.avatar_url, p.created_at],
    )
  }
  console.log(`  profiles: ${profiles.length} upserted`)

  // Remaining tables in foreign-key order.
  await copy(pool, 'organisations',
    ['id', 'name', 'slug', 'office_location', 'tagline', 'created_at'],
    await fetchAll('organisations'), 'id')

  await copy(pool, 'organisation_members',
    ['id', 'organisation_id', 'user_id', 'role', 'created_at'],
    await fetchAll('organisation_members'), 'id')

  await copy(pool, 'organisation_invites',
    ['id', 'organisation_id', 'email', 'token', 'invited_by', 'created_at', 'expires_at'],
    await fetchAll('organisation_invites'), 'id')

  await copy(pool, 'organisation_requests',
    ['id', 'organisation_id', 'user_id', 'created_at'],
    await fetchAll('organisation_requests'), 'id')

  // `created_by` does not exist in production (that migration never ran there),
  // so it lands as NULL — which the schema allows.
  await copy(pool, 'restaurants',
    ['id', 'name', 'type', 'cuisine', 'categories', 'latitude', 'longitude', 'address', 'created_at'],
    await fetchAll('restaurants'), 'id')

  await copy(pool, 'reviews',
    ['id', 'restaurant_id', 'user_id', 'rating', 'value_rating', 'taste_rating',
     'comment', 'dish', 'photo_url', 'organisation_id', 'created_at'],
    await fetchAll('reviews'), 'id')

  await copy(pool, 'review_tags',
    ['id', 'review_id', 'tag_id', 'created_at'],
    await fetchAll('review_tags'), 'id')

  await copy(pool, 'review_visibility',
    ['id', 'review_id', 'organisation_id', 'created_at'],
    await fetchAll('review_visibility'), 'id')

  await copy(pool, 'user_follows',
    ['id', 'follower_id', 'following_id', 'created_at'],
    await fetchAll('user_follows'), 'id')

  await copy(pool, 'follow_requests',
    ['id', 'requester_id', 'target_id', 'created_at'],
    await fetchAll('follow_requests'), 'id')

  await copy(pool, 'settings',
    ['key', 'value', 'updated_at'],
    await fetchAll('settings'), 'key')

  await pool.end()
  console.log('\nData migration complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
