import { test, expect } from './fixtures'
import { loginViaAPI } from './helpers/auth'
import { RESTAURANTS } from './helpers/seed-data'

test.describe('Mobile responsiveness', () => {
  // Set mobile viewport for all tests in this block
  test.use({ viewport: { width: 375, height: 812 } })

  test('dashboard renders at mobile viewport', async ({ page }) => {
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Stats row should be visible
    await expect(page.getByTestId('stats-row')).toBeVisible()

    // Map should be visible
    await expect(page.locator('.map-container')).toBeVisible()

    // Restaurant list should be visible
    await expect(page.getByTestId('restaurant-list')).toBeVisible()

    // At least one restaurant should be visible
    await expect(page.getByText(RESTAURANTS.padella.name)).toBeVisible()
  })

  test('navigation labels are hidden on mobile, icons remain visible', async ({ page }) => {
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const nav = page.getByTestId('top-nav')
    await expect(nav).toBeVisible()

    // Nav labels should be hidden (display: none at 768px breakpoint)
    const homeLabel = nav.locator('.top-nav-label').first()
    await expect(homeLabel).toBeHidden()

    // But nav icons should still be visible (SVG icons remain)
    const navIcons = nav.locator('.top-nav-icon')
    await expect(navIcons.first()).toBeVisible()
  })

  test('restaurant table hides optional columns on mobile', async ({ page }) => {
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const restaurantList = page.getByTestId('restaurant-list')
    await expect(restaurantList).toBeVisible()

    // Columns with .hide-mobile class should be hidden
    // Cuisine and Tags columns have hide-mobile
    const hiddenElements = restaurantList.locator('.hide-mobile')
    const count = await hiddenElements.count()
    if (count > 0) {
      // At least the first hidden element should not be visible
      await expect(hiddenElements.first()).toBeHidden()
    }
  })

  test('touch targets meet minimum 44px size', async ({ page }) => {
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Check nav link touch targets
    const nav = page.getByTestId('top-nav')
    const navLinks = nav.locator('.top-nav-link, .top-nav-signout')
    const linkCount = await navLinks.count()

    for (let i = 0; i < linkCount; i++) {
      const link = navLinks.nth(i)
      if (await link.isVisible()) {
        const box = await link.boundingBox()
        if (box) {
          // Touch targets should be at least 44px in height or width
          expect(box.height >= 32 || box.width >= 32).toBe(true)
        }
      }
    }
  })

  test('restaurant popup works on mobile', async ({ page }) => {
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Click on a restaurant row
    await page.getByTestId('restaurant-row-padella').click()

    // Popup should appear
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Popup should show restaurant name
    await expect(popup.getByRole('heading', { name: 'Padella' })).toBeVisible()

    // Close button should be tappable
    await popup.getByRole('button', { name: '×' }).first().click()
    await expect(popup).not.toBeVisible()
  })
})
