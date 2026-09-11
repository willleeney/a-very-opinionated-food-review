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

  test('org page shows Organisation link in nav for admin', async ({ authenticatedPage: page }) => {
    // james is admin of StackOne — nav should show Organisation link
    const nav = page.getByTestId('top-nav')
    await expect(nav.getByText('Organisation')).toBeVisible()
  })

  test('non-admin does not see Organisation admin link', async ({ page }) => {
    // sarah is a member (not admin) of StackOne
    await page.addInitScript(() => {
      const hideToolbar = () => {
        const style = document.createElement('style')
        style.textContent = 'astro-dev-toolbar { display: none !important; }'
        ;(document.head || document.documentElement).appendChild(style)
      }
      if (document.head) hideToolbar()
      else document.addEventListener('DOMContentLoaded', hideToolbar)
    })
    await loginAs(page, 'sarah')

    // sarah is a member, not admin — Organisation link should not appear
    const nav = page.getByTestId('top-nav')
    await expect(nav.getByText('Organisation')).not.toBeVisible()
  })
})
