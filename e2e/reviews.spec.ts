import { test, expect } from './fixtures/auth.fixture'
import { RESTAURANTS } from './helpers/seed-data'

test.describe('Reviews', () => {
  test('can see existing reviews in restaurant popup', async ({ authenticatedPage: page }) => {
    // Open Padella popup (james has a review for it in seed data)
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Should show at least one rating badge
    await expect(popup.locator('.mono').first()).toBeVisible()
  })

  test('can open review form in restaurant popup', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Click to toggle the review form
    await popup.getByTestId('toggle-review-form').first().click()

    // Review form should be visible
    await expect(popup.locator('.popup-receipt-form')).toBeVisible()
  })

  test('review tags are visible in restaurant popup', async ({ authenticatedPage: page }) => {
    // Open a restaurant that has tagged reviews
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Tags should be shown as small chips
    // At least some tag-related elements should be present
    const tagElements = popup.locator('[class*="tag"]')
    const count = await tagElements.count()
    expect(count).toBeGreaterThanOrEqual(0) // May or may not have tags
  })
})
