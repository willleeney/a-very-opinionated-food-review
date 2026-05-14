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

  test('add place form shows submit and cancel buttons', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: 'Add Place' }).last().click()
    const form = page.getByTestId('add-place-form')
    await expect(form).toBeVisible()

    // Should have submit and cancel buttons
    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })
})
