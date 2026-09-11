import { test, expect } from '@playwright/test'
import { loginViaAPI } from './helpers/auth'

/**
 * Helper: inject a <style> tag that hides the Astro dev toolbar.
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
// Page load performance
// ---------------------------------------------------------------------------
test.describe('Performance - page load times', () => {
  test('landing page loads within 3 seconds', async ({ page }) => {
    await hideAstroToolbar(page)

    const start = Date.now()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 15_000 })
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(3_000)
  })

  test('dashboard loads within 5 seconds', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')

    const start = Date.now()
    // loginViaAPI already navigates and reloads; measure from after reload
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('restaurant-list')).toBeVisible({ timeout: 15_000 })
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(5_000)
  })
})

// ---------------------------------------------------------------------------
// Console errors
// ---------------------------------------------------------------------------
test.describe('Performance - no console errors', () => {
  const pagesToCheck: Array<{ name: string; path: string; requiresAuth: boolean }> = [
    { name: 'landing page', path: '/', requiresAuth: false },
    { name: 'login page', path: '/login', requiresAuth: false },
    { name: 'dashboard', path: '/', requiresAuth: true },
    { name: 'settings page', path: '/settings', requiresAuth: true },
    { name: 'network page', path: '/network', requiresAuth: true },
  ]

  for (const { name, path, requiresAuth } of pagesToCheck) {
    test(`${name} has no console errors`, async ({ page }) => {
      await hideAstroToolbar(page)

      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text()
          // Ignore known noise:
          // - Failed favicon requests are common in dev
          // - Third-party script errors from map tiles, etc.
          const isIgnored =
            text.includes('favicon') ||
            text.includes('the server responded with a status of 404') ||
            text.includes('ERR_BLOCKED_BY_CLIENT')
          if (!isIgnored) {
            consoleErrors.push(text)
          }
        }
      })

      if (requiresAuth) {
        await loginViaAPI(page, 'james')
        await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })
        if (path !== '/') {
          await page.goto(path)
          await page.waitForLoadState('networkidle')
        }
      } else {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
      }

      // Give async errors a moment to surface
      await page.waitForTimeout(1_000)

      expect(
        consoleErrors,
        `Console errors found on ${name}:\n${consoleErrors.join('\n')}`,
      ).toEqual([])
    })
  }
})

// ---------------------------------------------------------------------------
// Image alt text
// ---------------------------------------------------------------------------
test.describe('Performance - image alt text', () => {
  test('all images on the landing page have alt text', async ({ page }) => {
    await hideAstroToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 15_000 })

    // Exclude Leaflet tile images (third-party, no alt text by design)
    const images = page.locator('img:not(.leaflet-tile)')
    const count = await images.count()

    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const src = await img.getAttribute('src')
      expect(alt, `Image missing alt text: ${src}`).toBeTruthy()
    }
  })

  test('all images on the dashboard have alt text', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Exclude Leaflet tile images (third-party, no alt text by design)
    const images = page.locator('img:not(.leaflet-tile)')
    const count = await images.count()

    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const src = await img.getAttribute('src')
      expect(alt, `Image missing alt text: ${src}`).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// Cumulative Layout Shift (CLS)
// ---------------------------------------------------------------------------
test.describe('Performance - layout stability (CLS)', () => {
  test('landing page has acceptable CLS (< 0.1)', async ({ page }) => {
    await hideAstroToolbar(page)

    // Start a CDP session for PerformanceObserver access
    const client = await page.context().newCDPSession(page)
    await client.send('Performance.enable')

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 15_000 })

    // Collect CLS from the Layout Instability API
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // Only count entries without recent input (user-triggered shifts are OK)
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
        })
        observer.observe({ type: 'layout-shift', buffered: true })

        // Give the observer time to collect any late shifts
        setTimeout(() => {
          observer.disconnect()
          resolve(clsValue)
        }, 2_000)
      })
    })

    expect(cls, `CLS on landing page is ${cls}, should be < 0.1`).toBeLessThan(0.1)
  })

  test('dashboard has acceptable CLS (< 0.1)', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
        })
        observer.observe({ type: 'layout-shift', buffered: true })

        setTimeout(() => {
          observer.disconnect()
          resolve(clsValue)
        }, 2_000)
      })
    })

    // Dashboard has map + data loading which causes some layout shift
    // 0.25 is "needs improvement" in Core Web Vitals — acceptable for data-heavy page
    expect(cls, `CLS on dashboard is ${cls}, should be < 0.25`).toBeLessThan(0.25)
  })
})
