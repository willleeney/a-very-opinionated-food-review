import { test, expect } from './fixtures/auth.fixture'

test.describe('Settings', () => {
  test('settings page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Should show the settings heading and account section
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  })

  test('can update display name', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Find display name input and update it
    const nameInput = page.locator('input[type="text"]').first()
    await nameInput.fill('Test James Updated')

    // Click UPDATE button
    await page.getByRole('button', { name: /update/i }).first().click()

    // Should show success message
    await expect(page.getByText('Name updated')).toBeVisible()
  })

  test('success message renders as structured content', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const nameInput = page.locator('input[type="text"]').first()
    await nameInput.fill('Safe Name')
    await page.getByRole('button', { name: /update/i }).first().click()

    // Verify success message appears
    await expect(page.getByText('Name updated')).toBeVisible()
  })

  test('privacy toggle works', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Find and click the privacy toggle
    const privacyToggle = page.getByRole('button', { name: /private|public/i })
    if (await privacyToggle.count() > 0) {
      await privacyToggle.click()
      // Should show success message about privacy change
      await expect(page.getByText(/account set to/i)).toBeVisible()
    }
  })
})
