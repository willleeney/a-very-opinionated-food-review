import { randomBytes, randomUUID, scrypt } from 'crypto'
import { Pool } from '@neondatabase/serverless'
import { requireDatabaseUrl } from './env'

/**
 * Direct Neon connection for seeding and verifying the database in tests.
 * Replaces the old Supabase service_role admin client.
 *
 * Lazy + re-creatable: global setup and global teardown share one process, and
 * each closes the pool when it is done so the Playwright runner can exit.
 */
let activePool: Pool | null = null

export function getPool(): Pool {
  if (!activePool) {
    activePool = new Pool({ connectionString: requireDatabaseUrl(), allowExitOnIdle: true })
  }
  return activePool
}

export async function closePool() {
  if (!activePool) return
  const p = activePool
  activePool = null
  await p.end()
}

export function query(sql: string, params: unknown[] = []) {
  return getPool().query(sql, params)
}

export async function getRestaurantByName(name: string) {
  const { rows } = await query('SELECT * FROM restaurants WHERE name = $1 LIMIT 1', [name])
  return rows[0] ?? null
}

export async function getReviewsByRestaurant(restaurantId: string) {
  const { rows } = await query('SELECT * FROM reviews WHERE restaurant_id = $1', [restaurantId])
  return rows
}

export async function getReviewsByUser(userId: string) {
  const { rows } = await query('SELECT * FROM reviews WHERE user_id = $1', [userId])
  return rows
}

export async function deleteRestaurantByName(name: string) {
  await query('DELETE FROM reviews WHERE restaurant_id IN (SELECT id FROM restaurants WHERE name = $1)', [name])
  await query('DELETE FROM restaurants WHERE name = $1', [name])
}

/**
 * Better Auth's default password hashing (scrypt, `salt:key` hex format).
 * Mirrors @better-auth/utils/password so rows we insert verify against the
 * running server's sign-in endpoint.
 */
const SCRYPT = { N: 16384, r: 16, p: 1, dkLen: 64 }

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      SCRYPT.dkLen,
      { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 },
      (err, key) => (err ? reject(err) : resolve(key))
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${(await derive(password, salt)).toString('hex')}`
}

/**
 * Create a credential user directly in the Better Auth tables, plus its
 * `profiles` row. Returns the user id and whether we actually created it —
 * teardown only removes users it created itself.
 *
 * The id is a UUID because app tables (e.g. `restaurants.created_by`) are
 * typed `uuid`, even though Better Auth's own columns are `text`.
 */
export async function createTestUser(user: { email: string; password: string; name: string }) {
  const existing = await query('SELECT id FROM "user" WHERE email = $1', [user.email])
  if (existing.rows[0]) return { id: existing.rows[0].id as string, created: false }

  const id = randomUUID()

  await query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, now(), now())`,
    [id, user.name, user.email]
  )

  await query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now(), now())`,
    [randomUUID(), id, id, await hashPassword(user.password)]
  )

  await query(
    'INSERT INTO profiles (id, email, display_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
    [id, user.email, user.name]
  )

  return { id, created: true }
}

/**
 * Delete a test user and everything that does not cascade from `"user"`.
 * `session`, `account` and `profiles` cascade; the app tables hold plain
 * (unconstrained) user columns, so they are cleaned up explicitly.
 */
export async function deleteTestUser(userId: string) {
  await query('DELETE FROM organisation_members WHERE user_id = $1', [userId])
  await query('DELETE FROM organisation_requests WHERE user_id = $1', [userId])
  await query('DELETE FROM user_follows WHERE follower_id = $1 OR following_id = $1', [userId])
  await query('DELETE FROM follow_requests WHERE requester_id = $1 OR target_id = $1', [userId])
  await query('DELETE FROM reviews WHERE user_id = $1', [userId])
  await query('DELETE FROM reviews WHERE restaurant_id IN (SELECT id FROM restaurants WHERE created_by = $1)', [userId])
  await query('DELETE FROM restaurants WHERE created_by = $1', [userId])
  await query('DELETE FROM "user" WHERE id = $1', [userId])
}
