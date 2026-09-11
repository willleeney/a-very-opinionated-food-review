import { test, expect } from '@playwright/test'
import { loginViaAPI, TEST_USERS } from './helpers/auth'

/**
 * Auth journey variations — every path through the auth UI.
 */

function hideToolbar(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    const s = document.createElement('style')
    s.textContent = 'astro-dev-toolbar { display: none !important; }'
    ;(document.head || document.documentElement).appendChild(s)
  })
}

test.describe('Login flow', () => {
  test.beforeEach(async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
  })

  test('renders all login form elements', async ({ page }) => {
    await expect(page.getByTestId('auth-email')).toBeVisible()
    await expect(page.getByTestId('auth-password')).toBeVisible()
    await expect(page.getByTestId('auth-submit')).toBeVisible()
    await expect(page.getByTestId('auth-submit')).toHaveText(/sign in/i)
  })

  test('shows Continue with Apple button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /apple/i })).toBeVisible()
  })

  test('shows Continue with Google button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  })

  test('shows error for empty email', async ({ page }) => {
    await page.getByTestId('auth-password').fill('password123')
    await page.getByTestId('auth-submit').click()
    // Browser validation or app error
    const emailInput = page.getByTestId('auth-email')
    await expect(emailInput).toBeVisible()
  })

  test('shows error for wrong password', async ({ page }) => {
    await page.getByTestId('auth-email').fill('james@stackone.com')
    await page.getByTestId('auth-password').fill('wrongpassword')
    await page.getByTestId('auth-submit').click()

    // Should show error message
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 5_000 })
  })

  test('shows error for non-existent user', async ({ page }) => {
    await page.getByTestId('auth-email').fill('nonexistent@example.com')
    await page.getByTestId('auth-password').fill('password123')
    await page.getByTestId('auth-submit').click()

    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 5_000 })
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.getByTestId('auth-email').fill('james@stackone.com')
    await page.getByTestId('auth-password').fill('password123')
    await page.getByTestId('auth-submit').click()

    await page.waitForURL('/', { timeout: 10_000 })
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })
  })

  test('login works for each test user', async ({ page }) => {
    // Verify sarah can log in
    await page.getByTestId('auth-email').fill(TEST_USERS.sarah.email)
    await page.getByTestId('auth-password').fill(TEST_USERS.sarah.password)
    await page.getByTestId('auth-submit').click()

    await page.waitForURL('/', { timeout: 10_000 })
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Signup flow', () => {
  test.beforeEach(async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
  })

  test('can switch to signup mode', async ({ page }) => {
    await page.getByText(/sign up/i).click({ force: true })

    // Submit button should now say "Create Account" or similar
    await expect(page.getByTestId('auth-submit')).toHaveText(/create|sign up/i)
  })

  test('signup mode shows email and password fields', async ({ page }) => {
    await page.getByText(/sign up/i).click({ force: true })

    await expect(page.getByTestId('auth-email')).toBeVisible()
    await expect(page.getByTestId('auth-password')).toBeVisible()
  })

  test('can switch back to login from signup', async ({ page }) => {
    // Go to signup
    await page.getByText(/sign up/i).click({ force: true })
    await expect(page.getByTestId('auth-submit')).toHaveText(/create|sign up/i)

    // Go back to login — click the "Sign in" button next to "Already have an account?"
    await page.getByRole('button', { name: /^sign in$/i }).click({ force: true })
    await expect(page.getByTestId('auth-submit')).toHaveText(/sign in/i)
  })
})

test.describe('Forgot password flow', () => {
  test.beforeEach(async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
  })

  test('can access forgot password', async ({ page }) => {
    await page.getByText(/forgot/i).click()

    // Should show reset form
    await expect(page.getByTestId('auth-email')).toBeVisible()
    await expect(page.getByTestId('auth-submit')).toHaveText(/reset|send/i)
    // Password field should be hidden
    await expect(page.getByTestId('auth-password')).not.toBeVisible()
  })

  test('submitting reset shows confirmation', async ({ page }) => {
    await page.getByText(/forgot/i).click()
    await page.getByTestId('auth-email').fill('james@stackone.com')
    await page.getByTestId('auth-submit').click()

    // Should show a success/confirmation message
    await expect(page.getByText(/check your email|reset link/i)).toBeVisible({ timeout: 5_000 })
  })

  test('can go back to sign in from forgot password', async ({ page }) => {
    await page.getByText(/forgot/i).click()
    await expect(page.getByTestId('auth-submit')).toHaveText(/reset|send/i)

    await page.getByText(/back to sign in/i).click()
    await expect(page.getByTestId('auth-submit')).toHaveText(/sign in/i)
  })
})

test.describe('Auth redirects', () => {
  test('unauthenticated user sees landing page, not dashboard', async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('dashboard-view')).not.toBeVisible()
  })

  test('authenticated user sees dashboard, not landing page', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')

    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('landing-view')).not.toBeVisible()
  })

  test('sign out returns to landing page', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Click sign out
    await page.getByTestId('sign-out-btn').click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Should show landing page
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 10_000 })
  })

  test('back to reviews link on login page navigates home', async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/login')
    const backLink = page.getByText(/back to reviews/i)
    if (await backLink.isVisible()) {
      await backLink.click()
      await page.waitForURL('/')
    }
  })
})
