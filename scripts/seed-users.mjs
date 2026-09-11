/**
 * Creates the local test accounts by signing them up through the running dev
 * server, so Better Auth hashes the passwords itself (a hand-written `account`
 * row would not produce a working login).
 *
 *   pnpm dev            # in one terminal
 *   pnpm seed:users     # in another
 *
 * Only ever talks to localhost, so it cannot reach production.
 *
 * All accounts use the password `password123`:
 *   james@stackone.com    admin of the first org   — admin screens, homebase, invites
 *   sarah@stackone.com    member                   — member view
 *   maya@stackone.com     member                   — follows, admin transfer
 *   alex@acme.com         no org                   — join-request flow
 *   private@example.com   no org, private profile  — follow-request approval
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Pool } from '@neondatabase/serverless'

const BASE = process.env.SEED_BASE_URL ?? 'http://localhost:4321'
const PASSWORD = 'password123'
const PROD_HOST_FRAGMENT = 'ep-lucky-union'

const USERS = [
  { email: 'james@stackone.com',  name: 'James Mitchell', role: 'admin' },
  { email: 'sarah@stackone.com',  name: 'Sarah Kim',      role: 'member' },
  { email: 'maya@stackone.com',   name: 'Maya Roberts',   role: 'member' },
  { email: 'alex@acme.com',       name: 'Alex Lee',       role: null },
  { email: 'private@example.com', name: 'Private User',   role: null, isPrivate: true },
]

const here = dirname(fileURLToPath(import.meta.url))

function readDatabaseUrl() {
  const raw = readFileSync(join(here, '..', 'packages', 'web', '.dev.vars'), 'utf8')
  const line = raw.split('\n').find((l) => l.trim().startsWith('DATABASE_URL'))
  return line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
}

if (!BASE.includes('localhost') && !BASE.includes('127.0.0.1')) {
  console.error(`REFUSING TO RUN against ${BASE} — this script is for local dev only.`)
  process.exit(1)
}

const DATABASE_URL = readDatabaseUrl()
if (new URL(DATABASE_URL).host.includes(PROD_HOST_FRAGMENT)) {
  console.error('REFUSING TO RUN — local dev is pointed at the production database.')
  process.exit(1)
}

async function main() {
  // Better Auth rejects requests without an Origin (CSRF protection).
  const headers = { 'Content-Type': 'application/json', origin: BASE }

  for (const u of USERS) {
    const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: u.email, password: PASSWORD, name: u.name }),
    }).catch(() => null)

    if (!res) {
      console.error(`Could not reach ${BASE} — is \`pnpm dev\` running?`)
      process.exit(1)
    }
    const status = res.ok ? 'created' : (res.status === 422 ? 'already exists' : `FAILED ${res.status}`)
    console.log(`  ${u.email.padEnd(22)} ${status}`)
  }

  // Membership and privacy are not part of signup, so set them directly.
  const pool = new Pool({ connectionString: DATABASE_URL })
  const { rows: orgs } = await pool.query('SELECT id, name FROM organisations ORDER BY created_at LIMIT 1')

  if (orgs.length === 0) {
    console.log('\n  No organisation in this branch — skipping membership.')
  } else {
    for (const u of USERS.filter((u) => u.role)) {
      await pool.query(
        `INSERT INTO organisation_members (organisation_id, user_id, role)
         SELECT $1, id, $3 FROM "user" WHERE email = $2
         ON CONFLICT (organisation_id, user_id) DO UPDATE SET role = $3`,
        [orgs[0].id, u.email, u.role]
      )
    }
    console.log(`\n  Membership set on "${orgs[0].name}"`)
  }

  for (const u of USERS.filter((u) => u.isPrivate)) {
    await pool.query('UPDATE profiles SET is_private = true WHERE email = $1', [u.email])
  }

  await pool.end()
  console.log(`\n  All accounts use the password: ${PASSWORD}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
