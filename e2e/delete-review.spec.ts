import { test, expect, loginAs } from './fixtures/auth.fixture'

test.describe('Delete review flow', () => {
  test('delete button visible for own reviews in popup', async ({ authenticatedPage: page }) => {
    // James has a review for Padella in seed data
    await page.getByTestId('restaurant-row-padella').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Find the delete button (trash icon SVG button with title "Delete review")
    const deleteButton = popup.getByTitle('Delete review')
    await expect(deleteButton.first()).toBeVisible()
  })

  test('delete button NOT visible for other users reviews', async ({ authenticatedPage: page }) => {
    // James is logged in. Open Padella which has reviews from multiple users.
    // Sarah's review should NOT have a delete button from James' perspective.
    await page.getByTestId('restaurant-row-padella').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Count review rows and delete buttons
    const reviewRows = popup.locator('.popup-review-row')
    const deleteButtons = popup.getByTitle('Delete review')
    const reviewCount = await reviewRows.count()
    const deleteCount = await deleteButtons.count()

    // James has exactly 1 review at Padella, so only 1 delete button should show
    // out of multiple reviews (Padella has 5 reviews in seed data)
    expect(reviewCount).toBeGreaterThan(1)
    expect(deleteCount).toBe(1)
  })

  test('clicking delete shows browser confirmation dialog', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Set up dialog handler BEFORE clicking delete - dismiss it to prevent actual deletion
    let dialogMessage = ''
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message()
      await dialog.dismiss()
    })

    // Click the delete button
    const deleteButton = popup.getByTitle('Delete review')
    await deleteButton.first().click()

    // Verify the confirmation dialog was shown with expected message
    expect(dialogMessage).toBe('Delete this review?')
  })

  test('dismissing delete confirmation keeps the review', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Count reviews before attempting delete
    const reviewsBefore = await popup.locator('.popup-review-row').count()

    // Dismiss the confirmation dialog
    page.on('dialog', async (dialog) => {
      await dialog.dismiss()
    })

    // Click delete
    const deleteButton = popup.getByTitle('Delete review')
    await deleteButton.first().click()

    // Review count should remain the same
    const reviewsAfter = await popup.locator('.popup-review-row').count()
    expect(reviewsAfter).toBe(reviewsBefore)
  })

  test('different user sees delete only for their own reviews', async ({ page }) => {
    // Login as sarah instead
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

    // Open Borough Market Kitchen (sarah has a review here)
    await page.getByTestId('restaurant-row-borough-market-kitchen').click()

    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Sarah should see exactly 1 delete button (for her own review)
    const deleteButtons = popup.getByTitle('Delete review')
    const deleteCount = await deleteButtons.count()
    expect(deleteCount).toBe(1)
  })
})
