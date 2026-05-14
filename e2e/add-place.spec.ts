import { test, expect } from './fixtures/auth.fixture'

test.describe('Add Place', () => {
  test('add place button opens modal form', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Add Place' }).last().click()
    await expect(page.getByTestId('add-place-form')).toBeVisible()
  })

  test('add place form has required fields', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Add Place' }).last().click()
    const form = page.getByTestId('add-place-form')
    await expect(form).toBeVisible()

    // Should have search input and rating field
    await expect(page.getByPlaceholder('Search for a restaurant...')).toBeVisible()
    await expect(page.getByText('tap to rate')).toBeVisible()
  })

  test('add place form validates required fields', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Add Place' }).last().click()
    const form = page.getByTestId('add-place-form')
    await expect(form).toBeVisible()

    // Try to submit without filling anything — should show validation
    await form.getByRole('button', { name: /save|submit|add/i }).click()

    // Should show validation error (red border on required fields)
    await expect(page.locator('.validation-error, [style*="red"], .error')).toBeVisible()
  })
})
