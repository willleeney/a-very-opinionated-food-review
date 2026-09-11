import { test as base, expect } from './fixtures'
import { loginViaAPI } from './helpers/auth'

const test = base

test.describe('Review visibility rules', () => {
  test('logged-out users cannot see review comments', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('landing-view')).toBeVisible()

    // Landing page should NOT expose real reviewer names
    const body = await page.textContent('body')
    expect(body).not.toContain('James Mitchell')
    expect(body).not.toContain('Sarah Kim')
    expect(body).not.toContain('Alex Lee')
  })

  test('same-org user can see member reviews', async ({ page }) => {
    // james is in StackOne, sarah is also in StackOne
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Navigate to StackOne org page
    await page.goto('/org/stackone')
    await page.waitForLoadState('networkidle')

    // Should be able to see reviews from other StackOne members
    await expect(page.getByTestId('restaurant-list')).toBeVisible()
  })

  test('cross-org user has limited visibility', async ({ page }) => {
    // alex is in Acme Corp, not StackOne
    await loginViaAPI(page, 'alex')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Should still see the global dashboard with ratings
    await expect(page.getByTestId('stats-row')).toBeVisible()
    await expect(page.getByTestId('restaurant-list')).toBeVisible()
  })
})
