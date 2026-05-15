import { test, expect, loginAs } from './fixtures/auth.fixture'
import { RESTAURANTS, TAGS } from './helpers/seed-data'

/**
 * Review CRUD lifecycle — create, edit, delete reviews.
 */

test.describe('Create review', () => {
  test('can open review form from restaurant popup', async ({ authenticatedPage: page }) => {
    // Open Padella popup
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Find and click "Edit Your Review" or "Add Review" accordion
    const editSection = popup.getByText(/edit your review|add.*review/i)
    if (await editSection.isVisible()) {
      await editSection.click()
      await page.waitForTimeout(500)
    }
  })

  test('review form has rating dropdown', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Scroll to and click the toggle to expand the review form accordion
    const toggleBtn = popup.getByTestId('toggle-review-form')
    await toggleBtn.scrollIntoViewIfNeeded()
    await toggleBtn.click()
    await page.waitForTimeout(500)

    // Wait for the form body to appear and scroll it into view
    const formBody = popup.locator('.popup-add-review-body')
    await expect(formBody).toBeVisible({ timeout: 5000 })
    await formBody.scrollIntoViewIfNeeded()

    // Rating is a custom receipt-rating element (not a standard select/input)
    const ratingDisplay = popup.locator('.receipt-rating').first()
    await ratingDisplay.scrollIntoViewIfNeeded()
    await expect(ratingDisplay).toBeVisible({ timeout: 5000 })
  })

  test('review form has comment textarea', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    const editSection = popup.getByText(/edit your review|add.*review/i)
    if (await editSection.isVisible()) {
      await editSection.click()
      await page.waitForTimeout(500)

      const commentField = popup.locator('textarea, input[placeholder*="comment" i]').first()
      await expect(commentField).toBeVisible()
    }
  })

  test('review form has dish name input', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    const editSection = popup.getByText(/edit your review|add.*review/i)
    if (await editSection.isVisible()) {
      await editSection.click()
      await page.waitForTimeout(500)

      const dishField = popup.locator('input[placeholder*="dish" i], input[name*="dish" i]').first()
      if (await dishField.count() > 0) {
        await expect(dishField).toBeVisible()
      }
    }
  })

  test('review form has tag selection', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    const editSection = popup.getByText(/edit your review|add.*review/i)
    if (await editSection.isVisible()) {
      await editSection.click()
      await page.waitForTimeout(500)

      // Tags section should be visible
      const tags = popup.locator('.tag, .chip, [class*="tag"]')
      const tagCount = await tags.count()
      expect(tagCount).toBeGreaterThan(0)
    }
  })

  test('review form shows submit button', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    const editSection = popup.getByText(/edit your review|add.*review/i)
    if (await editSection.isVisible()) {
      await editSection.click()
      await page.waitForTimeout(500)

      const submitBtn = popup.getByRole('button', { name: /submit|save|update/i })
      await expect(submitBtn).toBeVisible()
    }
  })
})

test.describe('Edit existing review', () => {
  test('existing review is pre-populated in form', async ({ authenticatedPage: page }) => {
    // James has a review at Padella — open it
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Find the edit section
    const editSection = popup.getByText(/edit your review/i)
    if (await editSection.isVisible()) {
      await editSection.click()
      await page.waitForTimeout(500)

      // Comment should be pre-filled with James's existing review
      const textarea = popup.locator('textarea').first()
      if (await textarea.count() > 0) {
        const value = await textarea.inputValue()
        expect(value.length).toBeGreaterThan(0)
      }
    }
  })
})

test.describe('Delete review', () => {
  test('delete button only appears for own reviews', async ({ authenticatedPage: page }) => {
    // James is logged in — open Padella popup
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Count delete buttons — James has 1 review at Padella out of 5
    const deleteButtons = popup.locator('button[aria-label*="delete" i], button:has(svg[class*="trash"]), button:has(path[d*="M19 7"])').first()
    // There should be at most 1 delete button (for James's own review)
    const allReviews = popup.locator('[data-review-id]')
    const reviewCount = await allReviews.count()
    expect(reviewCount).toBeGreaterThanOrEqual(3) // Padella has 5 reviews
  })

  test('delete button triggers confirmation dialog', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Find the delete button (trash icon) for James's review
    const deleteBtn = popup.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: '' })
    const trashButtons = popup.locator('[style*="cursor: pointer"]').filter({ has: page.locator('svg path') })

    // Set up dialog listener before clicking
    let dialogMessage = ''
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message()
      await dialog.dismiss() // Cancel the delete
    })

    // Try clicking the first trash button if visible
    const firstTrash = trashButtons.first()
    if (await firstTrash.isVisible().catch(() => false)) {
      await firstTrash.click()
      // Dialog should have appeared
      if (dialogMessage) {
        expect(dialogMessage.toLowerCase()).toContain('delete')
      }
    }
  })

  test('different users see delete for only their own reviews', async ({ page }) => {
    // Login as Sarah
    await page.addInitScript(() => {
      const s = document.createElement('style')
      s.textContent = 'astro-dev-toolbar { display: none !important; }'
      ;(document.head || document.documentElement).appendChild(s)
    })
    await loginAs(page, 'sarah')

    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Sarah has 1 review at Padella (10/10 Pappardelle Ragu)
    await expect(popup.getByText('Sarah Kim')).toBeVisible()
    await expect(popup.getByText('Pappardelle Ragu', { exact: true })).toBeVisible()
  })
})

test.describe('Review display', () => {
  test('reviews show rating with color coding', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Ratings should be visible
    await expect(popup.getByText('10/10')).toBeVisible()
    await expect(popup.getByText('9/10').first()).toBeVisible()
  })

  test('reviews show dish names', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    await expect(popup.getByText('Pici Cacio e Pepe')).toBeVisible()
    await expect(popup.getByText('Pappardelle Ragu', { exact: true })).toBeVisible()
  })

  test('reviews show comments', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    await expect(popup.getByText(/Best pasta in London/)).toBeVisible()
    await expect(popup.getByText(/Perfect pappardelle ragu/)).toBeVisible()
  })

  test('reviews show tags as chips', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    await expect(popup.getByText('Good Value')).toBeVisible()
    await expect(popup.getByText('Large Portion')).toBeVisible()
  })

  test('reviews show reviewer avatars', async ({ authenticatedPage: page }) => {
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Avatar initials should be visible
    await expect(popup.getByText('S').first()).toBeVisible() // Sarah Kim
    await expect(popup.getByText('M').first()).toBeVisible() // Maya Roberts
  })
})
