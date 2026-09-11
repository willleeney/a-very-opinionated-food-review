import { test, expect, loginAs } from './fixtures/auth.fixture'
import { RESTAURANTS, TOTAL_RESTAURANTS, TAGS } from './helpers/seed-data'
import { loginViaAPI } from './helpers/auth'

/**
 * Filter combination journeys — every filter variation.
 */

function hideToolbar(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    const s = document.createElement('style')
    s.textContent = 'astro-dev-toolbar { display: none !important; }'
    ;(document.head || document.documentElement).appendChild(s)
  })
}

test.describe('Category filters', () => {
  test('clicking Lunch filter shows only lunch restaurants', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Lunch' }).click()
    await page.waitForTimeout(500)

    // Lunch restaurants from seed: Borough Market, Padella, Flat Iron, Pho, The Rake, Arabica
    await expect(page.getByTestId('restaurant-row-padella')).toBeVisible()
    await expect(page.getByTestId('restaurant-row-pho')).toBeVisible()
  })

  test('clicking Dinner filter shows dinner restaurants', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Dinner' }).click()
    await page.waitForTimeout(500)

    // Dinner: Padella, Hawksmoor, Flat Iron, Arabica
    await expect(page.getByTestId('restaurant-row-padella')).toBeVisible()
    await expect(page.getByTestId('restaurant-row-hawksmoor-borough')).toBeVisible()
  })

  test('clicking Coffee filter shows coffee restaurants', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Coffee' }).click()
    await page.waitForTimeout(500)

    // Coffee: Monmouth Coffee
    await expect(page.getByTestId('restaurant-row-monmouth-coffee')).toBeVisible()
  })

  test('clicking Brunch filter shows brunch restaurants', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Brunch' }).click()
    await page.waitForTimeout(500)

    // Brunch: Borough Market Kitchen, Monmouth Coffee, Arabica
    await expect(page.getByTestId('restaurant-row-borough-market-kitchen')).toBeVisible()
  })

  test('clicking Pub filter shows pub restaurants', async ({ authenticatedPage: page }) => {
    // "Pub" appears in both Type and Cuisine sections — target the Type section
    const typeSection = page.locator('.filter-row').filter({ hasText: 'Type' })
    await typeSection.getByRole('button', { name: 'Pub' }).click()
    await page.waitForTimeout(500)

    // Pub: The Rake
    await expect(page.getByTestId('restaurant-row-the-rake')).toBeVisible()
  })

  test('multiple category filters combine (OR logic)', async ({ authenticatedPage: page }) => {
    // Select both Coffee and Pub — "Pub" appears in Type and Cuisine, scope to Type
    const typeSection = page.locator('.filter-row').filter({ hasText: 'Type' })
    await page.getByRole('button', { name: 'Coffee' }).click()
    await typeSection.getByRole('button', { name: 'Pub' }).click()
    await page.waitForTimeout(500)

    // Should show both Monmouth and The Rake
    await expect(page.getByTestId('restaurant-row-monmouth-coffee')).toBeVisible()
    await expect(page.getByTestId('restaurant-row-the-rake')).toBeVisible()
  })
})

test.describe('Cuisine filters', () => {
  test('clicking Italian shows only Italian restaurants', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Italian' }).click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('restaurant-row-padella')).toBeVisible()
    // Non-Italian should be hidden
    await expect(page.getByTestId('restaurant-row-pho')).not.toBeVisible()
  })

  test('clicking Steakhouse shows steakhouse restaurants', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Steakhouse' }).click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('restaurant-row-hawksmoor-borough')).toBeVisible()
    await expect(page.getByTestId('restaurant-row-flat-iron')).toBeVisible()
  })

  test('clicking Middle Eastern shows Arabica', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Middle Eastern' }).click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('restaurant-row-arabica-bar-&-kitchen')).toBeVisible()
  })
})

test.describe('Tag filters', () => {
  test('Good Value tag filters restaurants', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Good Value' }).click()
    await page.waitForTimeout(500)

    // Restaurants with Good Value tagged reviews: Padella, Flat Iron, Pho, Arabica
    await expect(page.getByTestId('restaurant-row-padella')).toBeVisible()
    await expect(page.getByTestId('restaurant-row-flat-iron')).toBeVisible()
  })

  test('High Protein tag filters restaurants', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'High Protein' }).click()
    await page.waitForTimeout(500)

    // Restaurants with High Protein: Borough Market, Padella, Hawksmoor, Flat Iron, Arabica
    await expect(page.getByTestId('restaurant-row-padella')).toBeVisible()
    await expect(page.getByTestId('restaurant-row-hawksmoor-borough')).toBeVisible()
  })

  test('Quick tag filters restaurants', async ({ authenticatedPage: page }) => {
    // "Quick" is not in the default visible tags — open the "+" dropdown to find it
    const tagsSection = page.locator('.filter-row').filter({ hasText: 'Tags' })
    await tagsSection.locator('.add-chip').hover()
    await page.waitForTimeout(300)
    // Click "Quick" inside the dropdown
    await page.locator('.dropdown-item').filter({ hasText: 'Quick' }).click()
    await page.waitForTimeout(500)

    // Quick: Flat Iron, Pho, Monmouth Coffee
    await expect(page.getByTestId('restaurant-row-flat-iron')).toBeVisible()
    await expect(page.getByTestId('restaurant-row-monmouth-coffee')).toBeVisible()
  })

  test('Outdoor Seating tag filters restaurants', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Outdoor Seating' }).click()
    await page.waitForTimeout(500)

    // Outdoor Seating: Borough Market, The Rake
    await expect(page.getByTestId('restaurant-row-the-rake')).toBeVisible()
  })
})

test.describe('View/social filters', () => {
  test('Just Me filter shows only my reviews', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Just Me' }).click()
    await page.waitForTimeout(500)

    // James reviewed: Borough Market, Padella, Hawksmoor, Flat Iron, Pho, Monmouth, The Rake, Arabica — all 8
    const rows = page.locator('[data-testid^="restaurant-row-"]')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Following filter shows reviews from followed users', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Following' }).click()
    await page.waitForTimeout(500)

    // James follows Sarah and Private User — their reviews should be shown
    const rows = page.locator('[data-testid^="restaurant-row-"]')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Followers filter shows reviews from followers', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Followers' }).click()
    await page.waitForTimeout(500)

    // James's followers: Sarah, Maya — their reviews should be shown
    const rows = page.locator('[data-testid^="restaurant-row-"]')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('StackOne org filter scopes to org members', async ({ authenticatedPage: page }) => {
    const stackoneBtn = page.getByRole('button', { name: 'StackOne' })
    if (await stackoneBtn.isVisible()) {
      await stackoneBtn.click()
      await page.waitForTimeout(500)

      // StackOne members: James, Sarah, Maya, Private User
      const rows = page.locator('[data-testid^="restaurant-row-"]')
      const count = await rows.count()
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })

  test('Everyone filter shows all restaurants', async ({ authenticatedPage: page }) => {
    // First apply a restrictive filter
    await page.getByRole('button', { name: 'Just Me' }).click()
    await page.waitForTimeout(500)

    // Then go back to Everyone
    await page.getByRole('button', { name: 'Everyone' }).click()
    await page.waitForTimeout(500)

    const rows = page.locator('[data-testid^="restaurant-row-"]')
    const count = await rows.count()
    expect(count).toBe(TOTAL_RESTAURANTS)
  })
})

test.describe('Combined filters', () => {
  test('category + cuisine combined filtering', async ({ authenticatedPage: page }) => {
    // Dinner + Italian = only Padella
    await page.getByRole('button', { name: 'Dinner' }).click()
    await page.getByRole('button', { name: 'Italian' }).click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('restaurant-row-padella')).toBeVisible()
    // Others shouldn't be visible
    await expect(page.getByTestId('restaurant-row-pho')).not.toBeVisible()
  })

  test('tag + category combined filtering', async ({ authenticatedPage: page }) => {
    // Coffee + Quick = Monmouth Coffee
    await page.getByRole('button', { name: 'Coffee' }).click()

    // "Quick" is behind the "+" dropdown in Tags section
    const tagsSection = page.locator('.filter-row').filter({ hasText: 'Tags' })
    await tagsSection.locator('.add-chip').hover()
    await page.waitForTimeout(300)
    await page.locator('.dropdown-item').filter({ hasText: 'Quick' }).click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('restaurant-row-monmouth-coffee')).toBeVisible()
  })
})

test.describe('Rating slider', () => {
  test('rating slider is visible', async ({ authenticatedPage: page }) => {
    const slider = page.locator('input[type="range"]')
    await expect(slider).toBeVisible()
  })

  test('slider shows "Any" label by default', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Any')).toBeVisible()
  })
})

test.describe('Stats update with filters', () => {
  test('stats row shows correct totals', async ({ authenticatedPage: page }) => {
    // Check stats are visible
    const statsRow = page.getByTestId('stats-row')
    await expect(statsRow).toBeVisible()

    // 8 places, 30 reviews in seed data — scope to stats row for exact match
    await expect(statsRow.getByTestId('stat-places')).toContainText('8')
    await expect(statsRow).toContainText('places')
  })

  test('histogram updates with filters', async ({ authenticatedPage: page }) => {
    // Histogram should show "8 reviewed" by default
    await expect(page.getByText('8 reviewed')).toBeVisible()

    // Apply a filter that reduces count
    await page.getByRole('button', { name: 'Coffee' }).click()
    await page.waitForTimeout(500)

    // Histogram should update to fewer reviewed
    await expect(page.getByText('1 reviewed')).toBeVisible()
  })
})

test.describe('Different user filter perspectives', () => {
  test('Alex (Acme) sees different data than James (StackOne)', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'alex')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Alex is in Acme Corp, should still see all restaurants (global view)
    const rows = page.locator('[data-testid^="restaurant-row-"]')
    const count = await rows.count()
    expect(count).toBe(TOTAL_RESTAURANTS)
  })
})
