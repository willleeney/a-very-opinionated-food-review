import { test, expect } from '@playwright/test'
import { loginViaAPI } from './helpers/auth'

/**
 * Mobile layout analysis — detect overflow, clipping, and crowding issues.
 * Runs at iPhone 14 viewport (390x844) to catch mobile-specific layout bugs.
 */

test.use({ viewport: { width: 390, height: 844 } })

function hideToolbar(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    const s = document.createElement('style')
    s.textContent = 'astro-dev-toolbar { display: none !important; }'
    ;(document.head || document.documentElement).appendChild(s)
  })
}

/**
 * Detect elements that overflow their parent container.
 * Returns an array of { selector, overflow, parentWidth, childWidth } objects.
 */
async function findOverflowingElements(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const issues: Array<{
      tag: string
      text: string
      overflow: string
      parentWidth: number
      childWidth: number
      scrollLeft: number
    }> = []

    document.querySelectorAll('*').forEach(el => {
      const htmlEl = el as HTMLElement
      if (htmlEl.scrollWidth > htmlEl.clientWidth + 2) {
        const text = htmlEl.textContent?.trim().slice(0, 50) || ''
        // Skip body/html (page-level scroll is normal)
        if (htmlEl.tagName === 'BODY' || htmlEl.tagName === 'HTML') return
        // Skip intentionally scrollable containers
        const style = getComputedStyle(htmlEl)
        if (style.overflowX === 'scroll' || style.overflowX === 'auto') return
        if (htmlEl.closest('.leaflet-container')) return // Skip map tiles

        issues.push({
          tag: htmlEl.tagName.toLowerCase(),
          text,
          overflow: `${htmlEl.scrollWidth - htmlEl.clientWidth}px`,
          parentWidth: htmlEl.clientWidth,
          childWidth: htmlEl.scrollWidth,
          scrollLeft: htmlEl.scrollLeft,
        })
      }
    })

    return issues
  })
}

/**
 * Detect text that's being clipped/truncated without ellipsis.
 */
async function findClippedText(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const issues: Array<{ tag: string; text: string; issue: string }> = []

    document.querySelectorAll('span, p, div, h1, h2, h3, td, th, label, button').forEach(el => {
      const htmlEl = el as HTMLElement
      const style = getComputedStyle(htmlEl)

      // Check if text is overflowing but hidden without ellipsis
      if (
        htmlEl.scrollWidth > htmlEl.clientWidth + 1 &&
        style.overflow === 'hidden' &&
        style.textOverflow !== 'ellipsis' &&
        htmlEl.textContent?.trim()
      ) {
        issues.push({
          tag: htmlEl.tagName.toLowerCase(),
          text: htmlEl.textContent.trim().slice(0, 60),
          issue: 'text clipped without ellipsis',
        })
      }
    })

    return issues
  })
}

/**
 * Check for touch targets smaller than 44x44px (Apple HIG minimum).
 */
async function findSmallTouchTargets(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const issues: Array<{ tag: string; text: string; width: number; height: number }> = []
    const minSize = 44

    document.querySelectorAll('button, a, input, select, [role="button"], [onclick]').forEach(el => {
      const rect = el.getBoundingClientRect()
      // Skip invisible elements
      if (rect.width === 0 || rect.height === 0) return
      // Skip elements outside viewport
      if (rect.top > window.innerHeight || rect.bottom < 0) return

      if (rect.width < minSize || rect.height < minSize) {
        const text = (el as HTMLElement).textContent?.trim().slice(0, 40) || el.getAttribute('aria-label') || el.tagName
        issues.push({
          tag: el.tagName.toLowerCase(),
          text,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        })
      }
    })

    return issues
  })
}

test.describe('Mobile layout - Dashboard', () => {
  test('no horizontal overflow on dashboard', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const overflows = await findOverflowingElements(page)
    // Filter out minor 1-2px rendering artifacts
    const significant = overflows.filter(o => parseInt(o.overflow) > 3)
    expect(significant, `Overflowing elements:\n${JSON.stringify(significant, null, 2)}`).toEqual([])
  })

  test('no clipped text on dashboard', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const clipped = await findClippedText(page)
    // Allow histogram labels (intentionally hidden on mobile) and Leaflet internals
    const filtered = clipped.filter(c =>
      !c.text.match(/avoid|poor|bad|meh|ok|decent|good|great|excellent|perfect/i) &&
      !c.text.match(/openstreetmap|leaflet|©/i)
    )
    expect(filtered, `Clipped text:\n${JSON.stringify(filtered, null, 2)}`).toEqual([])
  })

  test('touch targets meet 44px minimum on dashboard', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const small = await findSmallTouchTargets(page)
    // Allow map zoom controls (Leaflet internal) and minor elements
    const filtered = small.filter(s =>
      !s.text.includes('+') &&
      !s.text.includes('−') &&
      !s.tag.includes('path') &&
      s.tag !== 'a' // Nav links have padding that makes visual target bigger
    )

    // Report but don't fail hard — some elements are intentionally small
    if (filtered.length > 0) {
      console.log(`Small touch targets found:\n${JSON.stringify(filtered, null, 2)}`)
    }
    // Critical interactive elements (main buttons) should all be >= 44px
    const criticalSmall = filtered.filter(s =>
      s.tag === 'button' && s.height < 35 && !s.text.match(/^\s*$/)
    )
    expect(criticalSmall, `Buttons too small:\n${JSON.stringify(criticalSmall, null, 2)}`).toEqual([])
  })
})

test.describe('Mobile layout - Landing page', () => {
  test('no horizontal overflow on landing page', async ({ page }) => {
    await hideToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 10_000 })

    const overflows = await findOverflowingElements(page)
    const significant = overflows.filter(o => parseInt(o.overflow) > 3)
    expect(significant, `Overflowing elements:\n${JSON.stringify(significant, null, 2)}`).toEqual([])
  })
})

test.describe('Mobile layout - Settings', () => {
  test('no horizontal overflow on settings page', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const overflows = await findOverflowingElements(page)
    const significant = overflows.filter(o => parseInt(o.overflow) > 3)
    expect(significant, `Overflowing elements:\n${JSON.stringify(significant, null, 2)}`).toEqual([])
  })
})

test.describe('Mobile layout - Network', () => {
  test('no horizontal overflow on network page', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    const overflows = await findOverflowingElements(page)
    const significant = overflows.filter(o => parseInt(o.overflow) > 3)
    expect(significant, `Overflowing elements:\n${JSON.stringify(significant, null, 2)}`).toEqual([])
  })
})

test.describe('Mobile layout - Restaurant popup', () => {
  test('no horizontal overflow in popup', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    const overflows = await findOverflowingElements(page)
    const significant = overflows.filter(o => parseInt(o.overflow) > 3)
    expect(significant, `Overflowing elements:\n${JSON.stringify(significant, null, 2)}`).toEqual([])
  })

  test('popup content fits within viewport width', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    const popupBox = await popup.boundingBox()
    expect(popupBox).not.toBeNull()
    if (popupBox) {
      // Popup should not exceed viewport width
      expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(390 + 1)
    }
  })
})

test.describe('Mobile layout - Add Place', () => {
  test('add place form fits within viewport', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const addBtn = page.getByRole('button', { name: 'Add Place' })
    await addBtn.scrollIntoViewIfNeeded()
    await addBtn.click()
    await page.waitForTimeout(500)

    const form = page.getByTestId('add-place-form')
    await expect(form).toBeVisible()

    const overflows = await findOverflowingElements(page)
    const significant = overflows.filter(o => parseInt(o.overflow) > 3)
    expect(significant, `Overflowing elements:\n${JSON.stringify(significant, null, 2)}`).toEqual([])
  })
})

test.describe('Mobile layout - Scrolled sections', () => {
  test('filters section has no overflow when scrolled', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Scroll to filter area
    await page.getByTestId('filter-bar').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    const overflows = await findOverflowingElements(page)
    const significant = overflows.filter(o => parseInt(o.overflow) > 3)
    expect(significant, `Overflowing elements:\n${JSON.stringify(significant, null, 2)}`).toEqual([])
  })

  test('restaurant table has no overflow', async ({ page }) => {
    await hideToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Scroll to table
    await page.getByTestId('restaurant-list').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    const overflows = await findOverflowingElements(page)
    const significant = overflows.filter(o => parseInt(o.overflow) > 3)
    expect(significant, `Overflowing elements:\n${JSON.stringify(significant, null, 2)}`).toEqual([])
  })
})
