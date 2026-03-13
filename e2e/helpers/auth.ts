import { type Page } from '@playwright/test'

// Seed user credentials from supabase/seed.sql
export const TEST_USERS = {
  james: { email: 'james@stackone.com', password: 'password123', name: 'James Mitchell' },
  sarah: { email: 'sarah@stackone.com', password: 'password123', name: 'Sarah Kim' },
  alex: { email: 'alex@acme.com', password: 'password123', name: 'Alex Lee' },
  maya: { email: 'maya@stackone.com', password: 'password123', name: 'Maya Roberts' },
  private: { email: 'private@example.com', password: 'password123', name: 'Private User' },
} as const

export type TestUser = keyof typeof TEST_USERS

/**
 * Log in via the login page UI.
 * Navigates to /login, fills credentials, submits, and waits for redirect to /.
 * Note: Astro dev toolbar is hidden automatically by the test fixture in fixtures.ts.
 */
export async function loginViaUI(page: Page, user: TestUser = 'james') {
  const { email, password } = TEST_USERS[user]

  await page.goto('/login')
  await page.getByTestId('auth-email').fill(email)
  await page.getByTestId('auth-password').fill(password)
  await page.getByTestId('auth-submit').click()

  // Wait for redirect to home page after successful login
  await page.waitForURL('/', { timeout: 10_000 })
}

/**
 * Log in via Supabase API directly (faster, no UI interaction needed).
 * Sets the session tokens in localStorage so the app picks them up.
 */
export async function loginViaAPI(page: Page, user: TestUser = 'james') {
  const { email, password } = TEST_USERS[user]

  // Get the Supabase URL from the page's environment
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
  const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || ''

  // Sign in via Supabase REST API
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Login failed for ${email}: ${response.status} ${await response.text()}`)
  }

  const session = await response.json()

  // Navigate to the app first (need a page context for localStorage)
  await page.goto('/')

  // Set the session in localStorage (Supabase stores it here)
  await page.evaluate((sessionData) => {
    const storageKey = Object.keys(localStorage).find(k => k.includes('supabase'))
      || `sb-${new URL(sessionData.supabaseUrl).hostname.split('.')[0]}-auth-token`

    localStorage.setItem(storageKey, JSON.stringify({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      expires_at: sessionData.expires_at,
      expires_in: sessionData.expires_in,
      token_type: sessionData.token_type,
      user: sessionData.user,
    }))
  }, { ...session, supabaseUrl })

  // Reload to pick up the session
  await page.reload()
  await page.waitForLoadState('networkidle')
}
