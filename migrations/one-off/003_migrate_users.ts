import { Pool } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!
const DATABASE_URL = process.env.DATABASE_URL!

async function fetchSupabaseUsers() {
  // Use Supabase Admin API to list all users
  const users: any[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
        'apikey': SUPABASE_SECRET_KEY,
      },
    })

    if (!res.ok) {
      throw new Error(`Supabase API error: ${res.status} ${await res.text()}`)
    }

    const data = await res.json()
    const batch = data.users || data
    if (!Array.isArray(batch) || batch.length === 0) break

    users.push(...batch)
    if (batch.length < perPage) break
    page++
  }

  return users
}

async function migrateUsers() {
  console.log('Fetching users from Supabase...')
  const supabaseUsers = await fetchSupabaseUsers()
  console.log(`Found ${supabaseUsers.length} users`)

  const pool = new Pool({ connectionString: DATABASE_URL })

  for (const su of supabaseUsers) {
    const userId = su.id
    const email = su.email || ''
    const name = su.user_metadata?.full_name || su.user_metadata?.name || email.split('@')[0]
    const image = su.user_metadata?.avatar_url || su.user_metadata?.picture || null
    const emailVerified = !!su.email_confirmed_at
    const createdAt = su.created_at

    console.log(`  Migrating: ${email} (${userId})`)

    // Insert into Better Auth "user" table
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (id) DO NOTHING`,
      [userId, name, email, emailVerified, image, createdAt]
    )

    // Insert email/password account if they have a password
    // Supabase stores encrypted_password but we can't access it via the API
    // Users with passwords will need to use "forgot password" on first login
    const hasIdentity = (provider: string) =>
      su.identities?.some((i: any) => i.provider === provider)

    if (hasIdentity('email')) {
      await pool.query(
        `INSERT INTO account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
         VALUES ($1, $2, 'credential', $3, $4, $4)
         ON CONFLICT DO NOTHING`,
        [`${userId}_credential`, userId, userId, createdAt]
      )
    }

    // Insert Google OAuth account if present
    if (hasIdentity('google')) {
      const googleIdentity = su.identities.find((i: any) => i.provider === 'google')
      await pool.query(
        `INSERT INTO account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
         VALUES ($1, $2, 'google', $3, $4, $4)
         ON CONFLICT DO NOTHING`,
        [`${userId}_google`, googleIdentity?.identity_data?.sub || userId, userId, createdAt]
      )
    }

    // Insert Apple OAuth account if present
    if (hasIdentity('apple')) {
      const appleIdentity = su.identities.find((i: any) => i.provider === 'apple')
      await pool.query(
        `INSERT INTO account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
         VALUES ($1, $2, 'apple', $3, $4, $4)
         ON CONFLICT DO NOTHING`,
        [`${userId}_apple`, appleIdentity?.identity_data?.sub || userId, userId, createdAt]
      )
    }

    // Ensure profiles row exists (may already exist from Supabase trigger)
    // Check if profile already exists in Neon
    const existing = await pool.query('SELECT id FROM profiles WHERE id = $1', [userId])
    if (existing.rowCount === 0) {
      const displayName = su.user_metadata?.full_name || su.user_metadata?.name || email.split('@')[0]
      await pool.query(
        `INSERT INTO profiles (id, email, display_name, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [userId, email, displayName, createdAt]
      )
    }
  }

  await pool.end()
  console.log(`\nDone. Migrated ${supabaseUsers.length} users.`)
  console.log('\nNote: Users who signed up with email/password will need to use')
  console.log('"Forgot password" on first login — Supabase password hashes are')
  console.log('not accessible via the API.')
}

migrateUsers().catch(console.error)
