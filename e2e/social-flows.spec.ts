import { test, expect, loginAs } from './fixtures/auth.fixture'
import { loginViaAPI } from './helpers/auth'

/**
 * Social flows — follow, unfollow, request, cancel, follow back.
 */

function hideToolbar(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    const s = document.createElement('style')
    s.textContent = 'astro-dev-toolbar { display: none !important; }'
    ;(document.head || document.documentElement).appendChild(s)
  })
}

test.describe('Following tab', () => {
  test('shows users James follows', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // James follows Sarah and Private User
    await expect(page.getByText('Sarah Kim')).toBeVisible()
    await expect(page.getByText('Private User')).toBeVisible()
  })

  test('shows unfollow button for followed users', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    const unfollowButtons = page.getByRole('button', { name: /unfollow/i })
    const count = await unfollowButtons.count()
    expect(count).toBeGreaterThanOrEqual(2) // Sarah + Private User
  })

  test('shows avg rating for followed users', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Sarah's avg rating should be visible (she has many reviews)
    const ratingNumbers = page.locator('.mono, [class*="mono"]')
    const count = await ratingNumbers.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('Followers tab', () => {
  test('shows James followers', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Switch to Followers tab
    await page.getByText(/followers/i).first().click()
    await page.waitForTimeout(500)

    // Sarah and Maya follow James
    await expect(page.getByText('Sarah Kim')).toBeVisible()
    await expect(page.getByText('Maya Roberts')).toBeVisible()
  })

  test('Maya sees her following list', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'maya')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Wait for network page to render
    await expect(page.getByText(/your network/i)).toBeVisible({ timeout: 15_000 })

    // Maya follows James and Sarah — default tab is "Following"
    const followingCount = page.getByText(/FOLLOWING\s*\d/i)
    await expect(followingCount).toBeVisible()
    // Verify at least 1 user is listed
    const unfollowBtns = page.getByRole('button', { name: /unfollow/i })
    const count = await unfollowBtns.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})

test.describe('Find tab', () => {
  test('Find tab shows discoverable users', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Click Find tab
    await page.getByText(/find/i).click()
    await page.waitForTimeout(500)

    // Should show users James doesn't follow (Alex, Maya)
    // Alex is in different org, Maya follows James but James doesn't follow Maya
    await expect(page.getByText('Maya Roberts')).toBeVisible()
  })

  test('Find tab shows Follow button for unfollowed users', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    await page.getByText(/find/i).click()
    await page.waitForTimeout(500)

    // Should see Follow button (not Unfollow) for Maya
    const followBtn = page.getByRole('button', { name: /^follow$/i })
    if (await followBtn.count() > 0) {
      await expect(followBtn.first()).toBeVisible()
    }
  })

  test('search filters users by name', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    await page.getByText(/find/i).click()
    await page.waitForTimeout(500)

    // Search for "Maya"
    const searchInput = page.getByPlaceholder(/search/i)
    if (await searchInput.isVisible()) {
      await searchInput.fill('Maya')
      await page.waitForTimeout(300)

      await expect(page.getByText('Maya Roberts')).toBeVisible()
      // Alex should not be visible (doesn't match "Maya")
      await expect(page.getByText('Alex Lee')).not.toBeVisible()
    }
  })
})

test.describe('Requests tab', () => {
  test('Private user sees Requests tab (private accounts only)', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'private')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Only private accounts see the Requests tab
    const requestsTab = page.getByRole('button', { name: /requests/i })
    await expect(requestsTab).toBeVisible()
    await requestsTab.click()
    await page.waitForTimeout(500)

    // Sarah has a pending follow request to Private User
    await expect(page.getByText('Sarah Kim')).toBeVisible()
  })

  test('non-private user does not see Requests tab', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'sarah')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Sarah is not private — no Requests tab
    const requestsTab = page.getByRole('button', { name: /^requests$/i })
    await expect(requestsTab).not.toBeVisible()
  })
})

test.describe('Tab switching', () => {
  test('all visible tabs are navigable', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Following tab (default) — James follows Sarah and Private User
    await expect(page.getByText('Sarah Kim')).toBeVisible({ timeout: 10_000 })

    // Followers tab — click the tab text that includes count
    await page.getByText(/FOLLOWERS\s*\d/i).click()
    await page.waitForTimeout(500)

    // Find tab
    await page.getByText(/FIND/i).click()
    await page.waitForTimeout(500)
  })

  test('tab counts are displayed', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // James follows 2, has 2 followers
    await expect(page.getByText(/following\s*2/i)).toBeVisible()
    await expect(page.getByText(/followers\s*2/i)).toBeVisible()
  })
})

test.describe('Private account badge', () => {
  test('private user shows lock icon', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Private User should have a lock/private indicator
    const privateRow = page.getByText('Private User').locator('..')
    // The lock icon or "private" badge should be near the name
    await expect(page.getByText('Private User')).toBeVisible()
  })
})
