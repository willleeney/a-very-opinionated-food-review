import type { FullConfig } from '@playwright/test'

/**
 * Global setup: verify local Supabase is running before tests start.
 * All e2e tests run against LOCAL Supabase only — never production.
 */
export default async function globalSetup(_config: FullConfig) {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
  const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || ''

  // Health check: verify Supabase is reachable
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: supabaseAnonKey },
    })
    if (!response.ok) {
      throw new Error(`Supabase returned ${response.status}`)
    }
    console.log('[e2e setup] Supabase is healthy')
  } catch (error) {
    console.error('[e2e setup] Supabase is not reachable at', supabaseUrl)
    console.error('[e2e setup] Run: supabase start && supabase db reset')
    throw error
  }
}
