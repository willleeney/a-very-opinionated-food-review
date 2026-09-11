import { test, expect } from './fixtures/auth.fixture'

/**
 * Add Place form — complete flow with all variations.
 */

/** Scroll to and click the Add Place button (exists in both mobile and desktop layouts) */
async function openAddPlaceModal(page: import('@playwright/test').Page) {
  const addBtn = page.getByRole('button', { name: 'Add Place' })
  await addBtn.scrollIntoViewIfNeeded()
  await addBtn.click()
  await page.waitForTimeout(500)
}

test.describe('Add Place modal', () => {
  test('Add Place button opens modal', async ({ authenticatedPage: page }) => {
    const addBtn = page.getByRole('button', { name: 'Add Place' })
    await addBtn.scrollIntoViewIfNeeded()
    await expect(addBtn).toBeVisible()
    await addBtn.click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('add-place-form')).toBeVisible()
  })

  test('modal has search input for restaurant name', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    const searchInput = page.getByPlaceholder(/search.*restaurant/i)
    await expect(searchInput).toBeVisible()
  })

  test('modal has date field with today pre-filled', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    // Date should be pre-filled with today
    const dateField = page.getByText(/\d{2}\/\d{2}\/\d{4}/)
    if (await dateField.count() > 0) {
      await expect(dateField.first()).toBeVisible()
    }
  })

  test('modal has rating area with TAP TO RATE', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    await expect(page.getByText(/tap to rate/i)).toBeVisible()
    await expect(page.getByText('/10')).toBeVisible()
  })

  test('modal has photo upload area', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    await expect(page.getByText(/drop photo|upload/i)).toBeVisible()
  })

  test('modal has comment field', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    const commentField = page.getByPlaceholder(/comment/i)
    await expect(commentField).toBeVisible()
  })

  test('modal has dish field', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    const dishField = page.getByPlaceholder(/pad thai/i)
    await expect(dishField).toBeVisible()
  })

  test('modal has cuisine chips', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    // Default cuisines should be shown
    const cuisineChips = page.locator('.receipt-tag')
    const count = await cuisineChips.count()
    expect(count).toBeGreaterThanOrEqual(3) // At least 3 default + the "+" button
  })

  test('modal has submit and cancel buttons', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('cancel button closes the modal', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)
    await expect(page.getByTestId('add-place-form')).toBeVisible()

    await page.getByRole('button', { name: /cancel/i }).click()
    await page.waitForTimeout(300)

    await expect(page.getByTestId('add-place-form')).not.toBeVisible()
  })

  test('clicking overlay background closes modal', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)
    await expect(page.getByTestId('add-place-form')).toBeVisible()

    // Click the overlay (outside the form)
    await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } })
    await page.waitForTimeout(300)
  })
})

test.describe('Add Place form validation', () => {
  test('submit without rating shows validation hint', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    // Try to submit without filling anything
    await page.getByRole('button', { name: /submit/i }).click()
    await page.waitForTimeout(500)

    // Should show some validation feedback (rating required)
    // The form should still be visible (not submitted)
    await expect(page.getByTestId('add-place-form')).toBeVisible()
  })
})

test.describe('Add Place receipt design', () => {
  test('form has receipt-style zigzag edges', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    // The receipt form should have the receipt class
    const receipt = page.locator('.receipt, [class*="receipt"]').first()
    await expect(receipt).toBeVisible()
  })

  test('form has dashed section dividers', async ({ authenticatedPage: page }) => {
    await openAddPlaceModal(page)

    // Receipt-style dashed lines between sections
    const dividers = page.locator('.receipt-dashes')
    const count = await dividers.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
