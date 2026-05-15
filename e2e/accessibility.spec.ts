import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
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

/**
 * Run axe-core and return the violations array.
 * Excludes the Astro dev toolbar (shadow DOM, not our responsibility)
 * and enforces WCAG 2.0 Level A + AA.
 */
async function analyzeA11y(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .exclude('astro-dev-toolbar')
    .analyze()
}

/**
 * Pretty-print violations so failures are easy to diagnose in CI logs.
 */
function formatViolations(violations: Awaited<ReturnType<typeof analyzeA11y>>['violations']) {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `    - ${n.html}\n      ${n.failureSummary}`)
        .join('\n')
      return `[${v.impact}] ${v.id}: ${v.description}\n${nodes}`
    })
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// Accessibility tests  (WCAG 2.0 A + AA)
// ---------------------------------------------------------------------------
test.describe('Accessibility', () => {
  test('landing page has no a11y violations', async ({ page }) => {
    await hideAstroToolbar(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('landing-view')).toBeVisible({ timeout: 15_000 })

    const results = await analyzeA11y(page)
    expect(results.violations, formatViolations(results.violations)).toEqual([])
  })

  test('login page has no a11y violations', async ({ page }) => {
    await hideAstroToolbar(page)
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Welcome back')).toBeVisible()

    const results = await analyzeA11y(page)
    expect(results.violations, formatViolations(results.violations)).toEqual([])
  })

  test('dashboard has no a11y violations', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    const results = await analyzeA11y(page)
    expect(results.violations, formatViolations(results.violations)).toEqual([])
  })

  test('settings page has no a11y violations', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    const results = await analyzeA11y(page)
    expect(results.violations, formatViolations(results.violations)).toEqual([])
  })

  test('network page has no a11y violations', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await page.goto('/network')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Your Network' })).toBeVisible()

    const results = await analyzeA11y(page)
    expect(results.violations, formatViolations(results.violations)).toEqual([])
  })

  test('restaurant popup has no a11y violations', async ({ page }) => {
    await hideAstroToolbar(page)
    await loginViaAPI(page, 'james')
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    // Open Padella popup
    await page.getByTestId('restaurant-row-padella').click()
    const popup = page.getByTestId('restaurant-popup')
    await expect(popup).toBeVisible()

    // Scope the analysis to the popup itself so we only flag popup-specific issues
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .include('[data-testid="restaurant-popup"]')
      .analyze()

    expect(results.violations, formatViolations(results.violations)).toEqual([])
  })
})
