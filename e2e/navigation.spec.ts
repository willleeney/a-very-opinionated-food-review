import { test, expect } from './fixtures'
import { loginViaUI } from './helpers/auth'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, 'james')
  })

  test('home link navigates to dashboard', async ({ page }) => {
    // Navigate away first
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Click Home link
    await page.getByTestId('top-nav').getByText('Home').click()
    await expect(page).toHaveURL('/')
  })

  test('network link navigates to network page', async ({ page }) => {
    await page.getByTestId('top-nav').getByText('Network').click()
    await expect(page).toHaveURL('/network')
  })

  test('settings link navigates to settings page', async ({ page }) => {
    await page.getByTestId('top-nav').getByText('Settings').click()
    await expect(page).toHaveURL('/settings')
  })

  test('org admin link is visible for org admins', async ({ page }) => {
    // James is admin of StackOne
    const nav = page.getByTestId('top-nav')
    await expect(nav.getByText('Organisation')).toBeVisible()
  })

  test('sign out returns to landing page', async ({ page }) => {
    await page.getByTestId('sign-out-btn').click()

    // Should redirect to home and show landing page
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 10_000 })
  })

  test('org page loads with org-specific data', async ({ page }) => {
    // Navigate to StackOne org page
    await page.goto('/org/stackone')
    await page.waitForLoadState('networkidle')

    // Should show the dashboard with org context
    await expect(page.locator('.map-container')).toBeVisible()
    await expect(page.getByTestId('stats-row')).toBeVisible()
  })
})
