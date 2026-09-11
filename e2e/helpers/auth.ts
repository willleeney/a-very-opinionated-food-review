import { type Page } from '@playwright/test'

// Test user credentials. Created in Neon by e2e/global-setup.ts and removed again
// by e2e/global-teardown.ts.
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
 * Log in via the Better Auth API directly (faster, no UI interaction needed).
 *
 * `page.request` shares its cookie jar with the browser context, so the
 * Set-Cookie from Better Auth's sign-in endpoint becomes the page's session
 * cookie. Better Auth issues (and signs) that cookie itself, so we never have
 * to know its name or forge a `session` row.
 */
export async function loginViaAPI(page: Page, user: TestUser = 'james') {
  const { email, password } = TEST_USERS[user]

  const response = await page.request.post('/api/auth/sign-in/email', {
    data: { email, password },
  })

  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()} ${await response.text()}`)
  }

  // Load the app with the session cookie in place
  await page.goto('/')
  await page.waitForLoadState('networkidle')
}
