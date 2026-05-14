import { test, expect, loginAs } from './fixtures/auth.fixture'
import { ORGS } from './helpers/seed-data'

test.describe('Organisations', () => {
  test('org page loads with correct data', async ({ authenticatedPage: page }) => {
    // Navigate to StackOne org page (james is admin)
    await page.goto(`/org/${ORGS.stackone.slug}`)
    await page.waitForLoadState('networkidle')

    // Should show dashboard with org-specific content
    await expect(page.getByTestId('stats-row')).toBeVisible()

    // Should show the restaurant list
    await expect(page.getByTestId('restaurant-list')).toBeVisible()
  })

  test('org admin link visible for admin users', async ({ authenticatedPage: page }) => {
    // james is admin of StackOne
    await page.goto(`/org/${ORGS.stackone.slug}`)
    await page.waitForLoadState('networkidle')

    // Admin link should be accessible
    const adminLink = page.getByRole('link', { name: /admin|manage/i })
    await expect(adminLink).toBeVisible()
  })

  test('non-admin cannot see admin link', async ({ page }) => {
    // sarah is a member (not admin) of StackOne
    await loginAs(page, 'sarah')
    await page.goto(`/org/${ORGS.stackone.slug}`)
    await page.waitForLoadState('networkidle')

    // Admin link should not be visible
    const adminLink = page.getByRole('link', { name: /admin|manage/i })
    await expect(adminLink).not.toBeVisible()
  })
})
