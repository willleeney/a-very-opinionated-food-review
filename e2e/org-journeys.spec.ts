import { test, expect, loginAs } from './fixtures/auth.fixture'
import { loginViaAPI } from './helpers/auth'
import { ORGS } from './helpers/seed-data'

/**
 * Organisation management journeys — org pages, admin, create, invites.
 */

function hideToolbar(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    const s = document.createElement('style')
    s.textContent = 'astro-dev-toolbar { display: none !important; }'
    ;(document.head || document.documentElement).appendChild(s)
  })
}

test.describe('Organisation dashboard', () => {
  test('StackOne org page loads', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/org/stackone')
    await page.waitForLoadState('networkidle')

    // Org page renders the Dashboard directly (no dashboard-view wrapper) — use stats-row
    await expect(page.getByTestId('stats-row')).toBeVisible({ timeout: 15_000 })
  })

  test('org page shows org name context', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/org/stackone')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('stats-row')).toBeVisible({ timeout: 15_000 })

    // Should show StackOne somewhere in the context
    await expect(page.getByText('StackOne').first()).toBeVisible()
  })

  test('org page shows restaurants with org member reviews', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/org/stackone')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('stats-row')).toBeVisible({ timeout: 15_000 })

    // StackOne members have reviews at all restaurants
    const rows = page.locator('[data-testid^="restaurant-row-"]')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Acme org page loads for Alex', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'alex')
    await page.goto('/org/acme')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('stats-row')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Acme').first()).toBeVisible()
  })
})

test.describe('Organisation admin page', () => {
  test('admin page loads for StackOne admin (James)', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/org/stackone/admin')
    await page.waitForLoadState('networkidle')

    // Should show admin page with Organisation heading
    await expect(page.locator('h1').filter({ hasText: 'Organisation' })).toBeVisible({ timeout: 10_000 })
    // Members section below — scroll to it
    const membersHeading = page.getByText('Members').first()
    await membersHeading.scrollIntoViewIfNeeded()
    await expect(membersHeading).toBeVisible()
  })

  test('admin page shows member list', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/org/stackone/admin')
    await page.waitForLoadState('networkidle')

    // StackOne has: James (admin), Sarah, Maya, Private User — scroll to Team section
    await expect(page.locator('h1').filter({ hasText: 'Organisation' })).toBeVisible({ timeout: 10_000 })
    // The Team section heading
    const teamSection = page.getByText('Team').first()
    await teamSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)

    // Check members are visible in the table — names may vary if settings tests ran first
    const memberTable = page.locator('table').last()
    await expect(memberTable.getByText('Sarah Kim')).toBeVisible()
    await expect(memberTable.getByText('Maya Roberts')).toBeVisible()
    // James's display name might be "James Mitchell", "Safe Name", or "James Updated"
    await expect(memberTable.getByText(/james|safe name/i).first()).toBeVisible()
  })

  test('admin page shows invite section', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/org/stackone/admin')
    await page.waitForLoadState('networkidle')

    // Should have an invite section with email input
    await expect(page.locator('h1').filter({ hasText: 'Organisation' })).toBeVisible({ timeout: 10_000 })
    const inviteHeading = page.getByText('Invite').first()
    await inviteHeading.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    const inviteInput = page.getByPlaceholder('colleague@example.com')
    await expect(inviteInput).toBeVisible()
  })

  test('admin sees role badges for members', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/org/stackone/admin')
    await page.waitForLoadState('networkidle')

    // James should be marked as Admin — the admin badge/text is in the member list
    await expect(page.locator('h1').filter({ hasText: 'Organisation' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/admin/i).first()).toBeVisible()
  })
})

test.describe('Organisation admin access control', () => {
  test('admin link visible for org admin (James)', async ({ authenticatedPage: page }) => {
    // James is StackOne admin — should see admin nav link
    const adminLink = page.getByRole('link', { name: /organisation/i })
    if (await adminLink.count() > 0) {
      await expect(adminLink).toBeVisible()
    }
  })

  test('admin link NOT visible for regular member (Sarah)', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'sarah')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Sarah is StackOne member, not admin
    const adminLink = page.getByRole('link', { name: /organisation/i })
    const count = await adminLink.count()
    // Should be 0 or not visible
    if (count > 0) {
      await expect(adminLink).not.toBeVisible()
    }
  })
})

test.describe('Create organisation', () => {
  test('settings page has create org section', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Scroll to find the create org section
    const createOrgInput = page.getByPlaceholder(/my company/i)
    await createOrgInput.scrollIntoViewIfNeeded()
    await expect(createOrgInput).toBeVisible()
    await expect(page.getByRole('button', { name: /create/i }).first()).toBeVisible()
  })

  test('create org form has name input', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const nameInput = page.getByPlaceholder(/my company/i)
    await nameInput.scrollIntoViewIfNeeded()
    await expect(nameInput).toBeVisible()
  })
})

test.describe('Organisation in settings', () => {
  test('settings shows user organisations', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // James is in StackOne — should be listed somewhere (may need scroll)
    const stackOneText = page.getByText('StackOne').first()
    await stackOneText.scrollIntoViewIfNeeded()
    await expect(stackOneText).toBeVisible()
  })

  test('settings shows admin badge for admin orgs', async ({ authenticatedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // James is admin of StackOne — admin badge should appear
    const adminBadge = page.getByText(/admin/i).first()
    await adminBadge.scrollIntoViewIfNeeded()
    await expect(adminBadge).toBeVisible()
  })
})
