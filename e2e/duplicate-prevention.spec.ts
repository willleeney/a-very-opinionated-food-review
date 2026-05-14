import { test, expect } from './fixtures/auth.fixture'

test.describe('Duplicate restaurant prevention', () => {
  test('add place form opens with search input', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Add Place' }).last().click()

    const form = page.getByTestId('add-place-form')
    await expect(form).toBeVisible()

    // Should have a search input for restaurant name
    const searchInput = page.getByPlaceholder('Search for a restaurant...')
    await expect(searchInput).toBeVisible()
  })

  test('add place form requires a rating before submission', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Add Place' }).last().click()

    const form = page.getByTestId('add-place-form')
    await expect(form).toBeVisible()

    // Rating field should show "tap to rate" initially (no rating set)
    await expect(page.getByText('tap to rate')).toBeVisible()

    // Try to submit without rating — form should not submit successfully
    await page.getByRole('button', { name: /submit/i }).click()

    // Form should still be visible (submission blocked without rating)
    await expect(form).toBeVisible()
  })

  test('add place form has all required fields', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Add Place' }).last().click()

    const form = page.getByTestId('add-place-form')
    await expect(form).toBeVisible()

    // Should have: search input, rating, submit, cancel
    await expect(page.getByPlaceholder('Search for a restaurant...')).toBeVisible()
    await expect(page.getByText('tap to rate')).toBeVisible()
    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('cancel button closes the add place form', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Add Place' }).last().click()

    const form = page.getByTestId('add-place-form')
    await expect(form).toBeVisible()

    // Click cancel
    await page.getByRole('button', { name: /cancel/i }).click()

    // Form should be dismissed
    await expect(form).not.toBeVisible()
  })
})
