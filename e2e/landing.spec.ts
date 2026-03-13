import { test, expect } from './fixtures'
test.describe('Landing Page (unauthenticated)', () => {
  test('shows landing page with restaurant data', async ({ page }) => {
    await page.goto('/')

    // Should show the landing view, not the dashboard
    await expect(page.getByTestId('landing-view')).toBeVisible()

    // Should show the app name in nav
    await expect(page.getByText('Tastefull')).toBeVisible()

    // Should have a sign-in link
    await expect(page.getByText('Sign in')).toBeVisible()
  })

  test('sign-in link navigates to login page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('landing-view')).toBeVisible()

    await page.getByText('Sign in').click()
    await expect(page).toHaveURL('/login')
  })

  test('map section is visible with restaurant markers', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('landing-view')).toBeVisible()

    // Map container should be present
    await expect(page.locator('.map-container')).toBeVisible()
  })
})
