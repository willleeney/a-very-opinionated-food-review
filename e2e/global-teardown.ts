import type { FullConfig } from '@playwright/test'

/**
 * Global teardown: best-effort cleanup of test-created data.
 * Since `supabase db reset` handles full cleanup on next run,
 * this is just for tidiness.
 */
export default async function globalTeardown(_config: FullConfig) {
  console.log('[e2e teardown] Tests complete')
}
