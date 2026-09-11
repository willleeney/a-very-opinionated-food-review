import fs from 'fs'
import type { FullConfig } from '@playwright/test'
import { closePool, deleteTestUser } from './helpers/db'
import { CREATED_USERS_FILE } from './global-setup'

/**
 * Global teardown: remove the users global setup created, plus the rows that do
 * not cascade from `"user"` (reviews and restaurants). Users that already
 * existed before the run are left alone.
 */
export default async function globalTeardown(_config: FullConfig) {
  if (!fs.existsSync(CREATED_USERS_FILE)) {
    console.log('[e2e teardown] Nothing to clean up')
    return
  }

  const ids: string[] = JSON.parse(fs.readFileSync(CREATED_USERS_FILE, 'utf8'))

  try {
    for (const id of ids) {
      await deleteTestUser(id)
    }
    console.log(`[e2e teardown] Removed ${ids.length} test user(s)`)
  } finally {
    fs.rmSync(CREATED_USERS_FILE, { force: true })
    await closePool()
  }
}
