import { test, expect } from './fixtures'
import { TEST_USERS } from './helpers/auth'

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByTestId('auth-email')).toBeVisible()
    await expect(page.getByTestId('auth-password')).toBeVisible()
    await expect(page.getByTestId('auth-submit')).toBeVisible()
    await expect(page.getByTestId('auth-submit')).toHaveText('Sign In')
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByTestId('auth-email').fill('wrong@email.com')
    await page.getByTestId('auth-password').fill('wrongpassword')
    await page.getByTestId('auth-submit').click()

    // Should show an error message
    await expect(page.getByText(/Invalid login credentials/i)).toBeVisible({ timeout: 5_000 })
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.getByTestId('auth-email').fill(TEST_USERS.james.email)
    await page.getByTestId('auth-password').fill(TEST_USERS.james.password)
    await page.getByTestId('auth-submit').click()

    // Should redirect to home and show the dashboard
    await page.waitForURL('/', { timeout: 10_000 })
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 10_000 })
  })

  test('can switch to signup mode', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('button', { name: 'Sign up' }).click()

    await expect(page.getByText('Join us')).toBeVisible()
    await expect(page.getByTestId('auth-submit')).toHaveText('Create Account')
  })

  test('can access forgot password flow', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('button', { name: /Forgot your password/i }).click()

    await expect(page.getByText('Reset password')).toBeVisible()
    await expect(page.getByTestId('auth-submit')).toHaveText('Send Reset Link')
  })
})
