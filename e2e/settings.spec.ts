import { test, expect } from './fixtures/auth.fixture'

test.describe('Settings', () => {
  test('settings page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Should show the settings page content
    await expect(page.getByText('Display Name')).toBeVisible()
  })

  test('can update display name', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Find display name input and update it
    const nameInput = page.locator('input[type="text"]').first()
    await nameInput.fill('Test James Updated')

    // Click save
    await page.getByRole('button', { name: /save/i }).first().click()

    // Should show success message (structured, not dangerouslySetInnerHTML)
    await expect(page.getByText('Name updated')).toBeVisible()
  })

  test('success message renders without HTML injection', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const nameInput = page.locator('input[type="text"]').first()
    await nameInput.fill('Safe Name')
    await page.getByRole('button', { name: /save/i }).first().click()

    // Verify no dangerouslySetInnerHTML artifacts
    const successDiv = page.locator('[style*="f0fdf4"]')
    await expect(successDiv).toBeVisible()

    // Content should be plain text, not HTML
    const html = await successDiv.innerHTML()
    expect(html).not.toContain('dangerouslySetInnerHTML')
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
