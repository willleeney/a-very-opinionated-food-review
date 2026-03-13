import { test, expect } from './fixtures'
import { loginViaUI } from './helpers/auth'
import { RESTAURANTS, TOTAL_RESTAURANTS } from './helpers/seed-data'

test.describe('Dashboard (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, 'james')
  })

  test('dashboard loads with stats, map, and restaurant table', async ({ page }) => {
    // Stats row should be visible with correct data
    await expect(page.getByTestId('stats-row')).toBeVisible()
    await expect(page.getByTestId('stat-places')).toContainText(`${TOTAL_RESTAURANTS}`)

    // Map should be visible
    await expect(page.locator('.map-container')).toBeVisible()

    // Restaurant list should be visible
    await expect(page.getByTestId('restaurant-list')).toBeVisible()

    // Should show restaurant names from seed data
    await expect(page.getByText(RESTAURANTS.padella.name)).toBeVisible()
    await expect(page.getByText(RESTAURANTS.arabica.name)).toBeVisible()
  })

  test('nav shows authenticated links', async ({ page }) => {
    const nav = page.getByTestId('top-nav')
    await expect(nav).toBeVisible()

    // Should show nav links for authenticated user
    await expect(nav.getByText('Home')).toBeVisible()
    await expect(nav.getByText('Network')).toBeVisible()
    await expect(nav.getByText('Settings')).toBeVisible()

    // Should show sign out
    await expect(page.getByTestId('sign-out-btn')).toBeVisible()
  })

  test('restaurant table shows all seeded restaurants', async ({ page }) => {
    const table = page.getByTestId('restaurant-list')
    await expect(table).toBeVisible()

    // Each restaurant should appear
    for (const restaurant of Object.values(RESTAURANTS)) {
      await expect(table.getByText(restaurant.name)).toBeVisible()
    }
  })

  test('clicking restaurant row opens detail popup', async ({ page }) => {
    // Click on Padella row
    await page.getByTestId('restaurant-row-padella').click()

    // Popup should appear
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Should show restaurant name and details
    await expect(popup.getByRole('heading', { name: 'Padella' })).toBeVisible()

    // Should show reviews (at least one rating badge)
    await expect(popup.locator('.mono').first()).toBeVisible()

    // Should show "Add your review" or "Edit your review" toggle
    await expect(popup.getByTestId('toggle-review-form').first()).toBeVisible()
  })

  test('clicking restaurant popup close button dismisses it', async ({ page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Click close button (×)
    await popup.getByRole('button', { name: '×' }).first().click()

    // Popup should be gone
    await expect(popup).not.toBeVisible()
  })

  test('add place button is visible for authenticated users', async ({ page }) => {
    // Two buttons exist (mobile + desktop) — use the visible one
    await expect(page.getByRole('button', { name: 'Add Place' }).last()).toBeVisible()
  })

  test('add place opens modal form', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Place' }).last().click()

    // Form should be visible
    await expect(page.getByTestId('add-place-form')).toBeVisible()

    // Should have key form elements
    await expect(page.getByPlaceholder('Search for a restaurant...')).toBeVisible()
    await expect(page.getByText('tap to rate')).toBeVisible()
  })

  test('review form opens in restaurant popup', async ({ page }) => {
    // Open a restaurant popup
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Click "Edit your review" to expand the form (james has a Padella review)
    await popup.getByTestId('toggle-review-form').first().click()

    // The inline review form should appear with a submit button
    await expect(popup.locator('.popup-receipt-form')).toBeVisible()
  })
})
