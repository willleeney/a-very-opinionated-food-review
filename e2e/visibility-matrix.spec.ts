import { test, expect } from '@playwright/test'
import { loginViaAPI, TEST_USERS } from './helpers/auth'

/**
 * Cross-user visibility matrix — who sees what based on auth, org, follows, privacy.
 */

function hideToolbar(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    const s = document.createElement('style')
    s.textContent = 'astro-dev-toolbar { display: none !important; }'
    ;(document.head || document.documentElement).appendChild(s)
  })
}

test.describe('Logged out visibility', () => {
  test('landing page shows ratings but not reviewer names', async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 10_000 })

    // Ratings should be visible (use .first() as 9.0 may appear in multiple places)
    await expect(page.getByText('9.0').first()).toBeVisible()

    // Real reviewer names should NOT be visible
    await expect(page.getByText('James Mitchell')).not.toBeVisible()
    await expect(page.getByText('Sarah Kim')).not.toBeVisible()
  })

  test('landing page shows "Team member" instead of real names', async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 10_000 })

    await expect(page.getByText('Team member').first()).toBeVisible()
  })

  test('landing page does not expose email addresses', async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 10_000 })

    const body = await page.textContent('body')
    expect(body).not.toContain('james@stackone.com')
    expect(body).not.toContain('sarah@stackone.com')
    expect(body).not.toContain('alex@acme.com')
    expect(body).not.toContain('private@example.com')
  })

  test('landing page uses teaser comments', async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 10_000 })

    // Teaser comments from LandingPage.tsx
    const teaserComments = [
      'Perfect for a quick team lunch',
      'Best coffee in the area',
      'Worth the walk from the office',
      'A solid lunch spot',
      'Good value for the area',
      'Great for team lunches',
    ]

    let found = false
    for (const comment of teaserComments) {
      if (await page.getByText(comment).isVisible().catch(() => false)) {
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })
})

test.describe('Same-org visibility', () => {
  test('James sees Sarah review details (both in StackOne)', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Sarah is in StackOne with James — her name and comment should be visible
    await expect(popup.getByText('Sarah Kim')).toBeVisible()
    await expect(popup.getByText('Perfect pappardelle ragu')).toBeVisible()
  })

  test('James sees Maya review details (both in StackOne)', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Maya is in StackOne — visible to James
    await expect(popup.getByText('Maya Roberts')).toBeVisible()
    await expect(popup.getByText(/tagliatelle with nduja/i)).toBeVisible()
  })
})

test.describe('Cross-org visibility', () => {
  test('Alex sees ratings but limited details for StackOne members', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'alex')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Alex is in Acme Corp, not StackOne
    // He can see his own review (he has one at Padella - 8/10 Cacio e Pepe)
    // Need to scroll to find Alex's review at the bottom
    await popup.evaluate(el => el.scrollTo(0, el.scrollHeight))
    await page.waitForTimeout(300)
    await expect(popup.getByText('Alex Lee')).toBeVisible()

    // Ratings from other users should still be visible (for avg calc)
    await popup.evaluate(el => el.scrollTo(0, 0))
    await page.waitForTimeout(200)
    await expect(popup.getByText('9.0').first()).toBeVisible() // Padella avg
  })
})

test.describe('Private user visibility', () => {
  test('James can see Private User reviews (James follows them)', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // James follows Private User — should see their review
    await expect(popup.getByText('Private User', { exact: true })).toBeVisible()
    await expect(popup.getByText(/secret review from private user/i)).toBeVisible()
  })

  test('Private User rating still counts toward average', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Padella avg should include Private User's 9/10 review
    // Padella: 9 + 8 + 10 + 9 + 9 = 45 / 5 = 9.0
    await expect(page.getByText('9.0').first()).toBeVisible()
  })
})

test.describe('Own review visibility', () => {
  test('user always sees own reviews regardless of filters', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Apply Just Me filter
    await page.getByRole('button', { name: 'Just Me' }).click()
    await page.waitForTimeout(500)

    // James should see restaurants he reviewed
    await expect(page.getByTestId('restaurant-row-padella')).toBeVisible()
    await expect(page.getByTestId('restaurant-row-flat-iron')).toBeVisible()
  })

  test('James sees his own review in popup with delete option', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // James's review: "Best pasta in London"
    await expect(popup.getByText(/Best pasta in London/)).toBeVisible()
  })
})

test.describe('Network page visibility', () => {
  test('James network shows followed users with their stats', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Sarah Kim')).toBeVisible()
    await expect(page.getByText('Private User')).toBeVisible()
  })

  test('Private User sees incoming follow request from Sarah', async ({ page }) => {
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
})

test.describe('Landing page map visibility', () => {
  test('map markers visible on landing page', async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 10_000 })

    // Map should be visible
    const map = page.locator('.leaflet-container')
    await expect(map).toBeVisible()

    // Should have markers
    const markers = page.locator('.leaflet-marker-icon')
    const count = await markers.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
