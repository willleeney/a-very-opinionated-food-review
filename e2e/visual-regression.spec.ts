import { test, expect } from '@playwright/test'
import { loginViaAPI } from './helpers/auth'

/**
 * Helper: inject a <style> tag that hides the Astro dev toolbar.
 * Must be called via addInitScript before navigating so it runs
 * before the toolbar can paint.
 */
async function hideAstroToolbar(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style')
      style.textContent = 'astro-dev-toolbar { display: none !important; }'
      ;(document.head || document.documentElement).appendChild(style)
    }
    if (document.head) {
      hide()
    } else {
      document.addEventListener('DOMContentLoaded', hide)
    }
  })
}

// ---------------------------------------------------------------------------
// Desktop viewport  (1280 x 720)
// ---------------------------------------------------------------------------
test.describe('Visual regression - Desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('landing page', async ({ page }) => {
    await hideAstroToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 15_000 })

    // Mask map tiles (they load from external CDN and can differ between runs)
    await expect(page).toHaveScreenshot('landing-desktop.png', {
      maxDiffPixelRatio: 0.01,
      mask: [page.locator('.leaflet-tile-pane')],
    })
  })

  test('dashboard', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await expect(page).toHaveScreenshot('dashboard-desktop.png', {
      maxDiffPixelRatio: 0.01,
      mask: [
        page.locator('.leaflet-tile-pane'),
        // Mask any timestamps / relative dates that may shift between runs
        page.locator('time'),
      ],
    })
  })

  test('settings page', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot('settings-desktop.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('login page', async ({ page }) => {
    await hideAstroToolbar(page)
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot('login-desktop.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('filter bar area', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const filterBar = page.getByTestId('filter-bar')
    await expect(filterBar).toBeVisible()

    await expect(filterBar).toHaveScreenshot('filter-bar-desktop.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('restaurant popup (Padella)', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    await expect(popup).toHaveScreenshot('restaurant-popup-padella-desktop.png', {
      maxDiffPixelRatio: 0.01,
      mask: [
        // Mask dynamic dates/times inside the popup
        popup.locator('time'),
      ],
    })
  })

  test('rating histogram', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const histogram = page.getByTestId('rating-histogram')
    await expect(histogram).toBeVisible()

    await expect(histogram).toHaveScreenshot('rating-histogram-desktop.png', {
      maxDiffPixelRatio: 0.01,
    })
  })
})

// ---------------------------------------------------------------------------
// Mobile viewport  (390 x 844 — iPhone 14)
// ---------------------------------------------------------------------------
test.describe('Visual regression - Mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('landing page', async ({ page }) => {
    await hideAstroToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 15_000 })

    await expect(page).toHaveScreenshot('landing-mobile.png', {
      maxDiffPixelRatio: 0.01,
      mask: [page.locator('.leaflet-tile-pane')],
    })
  })

  test('dashboard', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      maxDiffPixelRatio: 0.01,
      mask: [
        page.locator('.leaflet-tile-pane'),
        page.locator('time'),
      ],
    })
  })

  test('settings page', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot('settings-mobile.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('login page', async ({ page }) => {
    await hideAstroToolbar(page)
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot('login-mobile.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('filter bar area', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const filterBar = page.getByTestId('filter-bar')
    await expect(filterBar).toBeVisible()

    await expect(filterBar).toHaveScreenshot('filter-bar-mobile.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('restaurant popup (Padella)', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    await expect(popup).toHaveScreenshot('restaurant-popup-padella-mobile.png', {
      maxDiffPixelRatio: 0.01,
      mask: [popup.locator('time')],
    })
  })

  test('rating histogram', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const histogram = page.getByTestId('rating-histogram')
    await expect(histogram).toBeVisible()

    await expect(histogram).toHaveScreenshot('rating-histogram-mobile.png', {
      maxDiffPixelRatio: 0.01,
    })
  })
})
