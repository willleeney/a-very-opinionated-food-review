import fs from 'fs'
import os from 'os'
import path from 'path'
import type { FullConfig } from '@playwright/test'
import { requireDatabaseUrl } from './helpers/env'
import { closePool, createTestUser, query } from './helpers/db'
import { TEST_USERS } from './helpers/auth'

/** Users this run created, so teardown removes only those. */
export const CREATED_USERS_FILE = path.join(os.tmpdir(), 'tastefull-e2e-created-users.json')

/**
 * Global setup: verify Neon is reachable, then create the test users in the
 * Better Auth tables (`user` + `account` with providerId='credential') along
 * with their `profiles` rows.
 */
export default async function globalSetup(_config: FullConfig) {
  const host = new URL(requireDatabaseUrl().replace(/^postgres(ql)?:/, 'http:')).host

  try {
    await query('SELECT 1 FROM "user" LIMIT 1')
    console.log(`[e2e setup] Neon is reachable (${host})`)
  } catch (error) {
    console.error('[e2e setup] Cannot query Neon at', host)
    console.error('[e2e setup] Check DATABASE_URL and that migrations have been applied.')
    await closePool()
    throw error
  }

  const created: string[] = []
  for (const user of Object.values(TEST_USERS)) {
    const { id, created: isNew } = await createTestUser(user)
    if (isNew) created.push(id)
    console.log(`[e2e setup] ${isNew ? 'created' : 'reusing'} ${user.email}`)
  }

  fs.writeFileSync(CREATED_USERS_FILE, JSON.stringify(created))
  await closePool()
}
