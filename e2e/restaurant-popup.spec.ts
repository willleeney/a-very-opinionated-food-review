import { test, expect } from './fixtures/auth.fixture'
import { RESTAURANTS } from './helpers/seed-data'

test.describe('Restaurant popup interactions', () => {
  test('popup shows correct restaurant name and rating', async ({ authenticatedPage: page }) => {
    // Click Padella row (has 5 reviews in seed, avg around 9)
    await page.getByTestId('restaurant-row-padella').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Should show restaurant name as heading
    await expect(popup.getByRole('heading', { name: 'Padella' })).toBeVisible()

    // Should show rating as "X.X — Label" format
    await expect(popup.locator('.mono').first()).toBeVisible()

    // Should show review count
    await expect(popup.getByText(/\d+ reviews?/).first()).toBeVisible()
  })

  test('popup shows multiple reviews with rating and reviewer info', async ({ authenticatedPage: page }) => {
    // Padella has 5 reviews in seed data
    await page.getByTestId('restaurant-row-padella').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Should show multiple review rows
    const reviewRows = popup.locator('.popup-review-row')
    const count = await reviewRows.count()
    expect(count).toBeGreaterThanOrEqual(2)

    // Each review row should have a rating in X/10 format
    const firstReview = reviewRows.first()
    await expect(firstReview.locator('.mono')).toBeVisible()
    const ratingText = await firstReview.locator('.mono').first().textContent()
    expect(ratingText).toMatch(/\d+\/10/)
  })

  test('popup shows reviewer names for same-org members', async ({ authenticatedPage: page }) => {
    // James is in StackOne, should see Sarah Kim's and Maya Roberts' names
    await page.getByTestId('restaurant-row-padella').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // James, Sarah, and Maya are all in StackOne — their names should be visible
    // At least one non-Anonymous reviewer name should appear
    const popupText = await popup.textContent()
    const hasVisibleName = popupText?.includes('James Mitchell') ||
      popupText?.includes('Sarah Kim') ||
      popupText?.includes('Maya Roberts')
    expect(hasVisibleName).toBe(true)
  })

  test('close button dismisses popup', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Click close button
    await popup.getByRole('button', { name: '×' }).first().click()

    // Popup should be dismissed
    await expect(popup).not.toBeVisible()
  })

  test('clicking overlay background closes popup', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Click the overlay (modal-overlay is the parent)
    const overlay = page.locator('.modal-overlay')
    // Click at the edge of the overlay (outside the popup)
    await overlay.click({ position: { x: 10, y: 10 } })

    // Popup should be dismissed
    await expect(popup).not.toBeVisible()
  })

  test('popup shows photo gallery for restaurants with photos', async ({ authenticatedPage: page }) => {
    // Padella has 4 reviews with photos in seed data
    await page.getByTestId('restaurant-row-padella').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Should show the split panel layout with gallery
    const gallery = popup.locator('.split-gallery')
    await expect(gallery).toBeVisible()

    // Should show gallery items (photo thumbnails)
    const galleryItems = popup.locator('.split-gallery-item')
    const photoCount = await galleryItems.count()
    expect(photoCount).toBeGreaterThanOrEqual(1)
  })
})
