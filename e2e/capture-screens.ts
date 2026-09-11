/**
 * Comprehensive screenshot capture for visual inspection.
 *
 * Captures 57 screenshots covering every screen state at mobile (390x844)
 * and desktop (1280x800) viewports, with multiple user roles.
 *
 * Prerequisites: Astro dev server on localhost:4321 (talks to Neon + Better Auth)
 *
 * Usage:
 *   npx tsx e2e/capture-screens.ts
 *   npx tsx e2e/capture-screens.ts --out /tmp/my-screens
 */
import { chromium, type Page, type BrowserContext } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VIEWPORT = { width: 390, height: 844 }
const BASE = process.env.BASE_URL || 'http://localhost:4321'

const outFlag = process.argv.indexOf('--out')
const OUT = outFlag !== -1 ? process.argv[outFlag + 1] : path.resolve(__dirname, 'screenshots')

let shotIndex = 0

async function shot(page: Page, name: string) {
  shotIndex++
  const num = String(shotIndex).padStart(2, '0')
  const p = `${OUT}/${num}-${name}.png`
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  ${num}-${name}`)
  return p
}

async function loginViaAPI(page: Page, email: string) {
  // page.request shares cookies with the browser context, so Better Auth's
  // Set-Cookie from the sign-in endpoint becomes the page's session cookie.
  const response = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email, password: 'password123' },
  })
  if (!response.ok()) throw new Error(`Login failed for ${email}: ${response.status()}`)
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
}

function closePopup(page: Page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('.modal-overlay')
    if (overlay) overlay.remove()
  })
}

function scrollTo(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (el) el.scrollIntoView({ block: 'start' })
  }, selector)
}

async function main() {
  const { mkdirSync } = await import('fs')
  mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: VIEWPORT })
  await ctx.addInitScript(() => {
    const s = document.createElement('style')
    s.textContent = 'astro-dev-toolbar { display: none !important; }'
    ;(document.head || document.documentElement).appendChild(s)
  })

  // ── UNAUTHENTICATED ──
  console.log('\nUnauthenticated screens')
  let page = await ctx.newPage()
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  await shot(page, 'landing-hero')
  await page.evaluate(() => window.scrollBy(0, 600))
  await page.waitForTimeout(400)
  await shot(page, 'landing-top-rated')
  await page.evaluate(() => window.scrollBy(0, 600))
  await page.waitForTimeout(400)
  await shot(page, 'landing-map')
  await page.evaluate(() => window.scrollBy(0, 700))
  await page.waitForTimeout(400)
  await shot(page, 'landing-stats-bento')
  await page.evaluate(() => window.scrollBy(0, 700))
  await page.waitForTimeout(400)
  await shot(page, 'landing-reviews-visible')
  await page.evaluate(() => window.scrollBy(0, 700))
  await page.waitForTimeout(400)
  await shot(page, 'landing-reviews-blurred')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(400)
  await shot(page, 'landing-cta-footer')

  // Map popup
  await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(500)
  try {
    await page.locator('.leaflet-marker-icon').first().click({ force: true, timeout: 5000 })
    await page.waitForTimeout(800)
    await shot(page, 'landing-map-popup')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  } catch { /* map marker click can fail */ }

  // Login
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  await shot(page, 'login-empty')
  await page.fill('[data-testid="auth-email"]', 'james@stackone.com')
  await page.fill('[data-testid="auth-password"]', 'password123')
  await shot(page, 'login-filled')
  await page.fill('[data-testid="auth-password"]', 'wrongpassword')
  await page.click('[data-testid="auth-submit"]')
  await page.waitForTimeout(2000)
  await shot(page, 'login-error')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  await shot(page, 'login-oauth-signup')
  await page.close()

  // ── JAMES (admin) ──
  console.log('\nAuthenticated (james) — Dashboard')
  page = await ctx.newPage()
  await loginViaAPI(page, 'james@stackone.com')
  await page.waitForTimeout(2000)

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  await shot(page, 'dash-hero')
  await scrollTo(page, '[data-testid="stats-row"]')
  await page.waitForTimeout(400)
  await shot(page, 'dash-stats')
  await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  await shot(page, 'dash-map')

  try {
    await page.locator('.leaflet-marker-icon').first().click({ force: true, timeout: 5000 })
    await page.waitForTimeout(800)
    await shot(page, 'dash-map-popup')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  } catch { /* skip */ }

  await page.evaluate(() => document.querySelector('[data-testid="rating-histogram"]')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  await shot(page, 'dash-histogram')

  await scrollTo(page, '[data-testid="filter-bar"]')
  await page.waitForTimeout(400)
  await shot(page, 'dash-filters-rating')
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(300)
  await shot(page, 'dash-filters-type-cuisine')
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(300)
  await shot(page, 'dash-filters-view-tags')

  await scrollTo(page, '[data-testid="restaurant-list"]')
  await page.waitForTimeout(400)
  await shot(page, 'dash-table-top')
  await page.evaluate(() => window.scrollBy(0, 500))
  await page.waitForTimeout(300)
  await shot(page, 'dash-table-bottom-footer')

  // Filter active
  console.log('\nFilter states')
  const lunchChip = page.locator('.chip', { hasText: 'Lunch' }).first()
  if (await lunchChip.count() > 0) {
    await lunchChip.scrollIntoViewIfNeeded()
    await lunchChip.click()
    await page.waitForTimeout(500)
    await scrollTo(page, '[data-testid="restaurant-list"]')
    await page.waitForTimeout(300)
    await shot(page, 'dash-filter-lunch-active')
    await lunchChip.click()
    await page.waitForTimeout(300)
  }

  // Popups
  console.log('\nRestaurant popups')
  for (const [testid, name] of [['padella', 'padella'], ['monmouth-coffee', 'monmouth'], ['pho', 'pho']] as const) {
    const row = page.locator(`[data-testid="restaurant-row-${testid}"]`)
    if (await row.count() > 0) {
      await row.scrollIntoViewIfNeeded()
      await row.click()
      await page.waitForTimeout(1000)
      await shot(page, `popup-${name}-top`)
      if (name === 'padella') {
        await page.evaluate(() => { const p = document.querySelector('.restaurant-popup'); if (p) p.scrollTop = 300 })
        await page.waitForTimeout(400)
        await shot(page, 'popup-padella-reviews')
        await page.evaluate(() => { const p = document.querySelector('.restaurant-popup'); if (p) p.scrollTop = p.scrollHeight })
        await page.waitForTimeout(400)
        await shot(page, 'popup-padella-bottom')
      }
      await closePopup(page)
      await page.waitForTimeout(300)
    }
  }

  // Add Place
  console.log('\nAdd Place modal')
  const addBtn = page.locator('[data-testid="add-place-btn"]').first()
  if (await addBtn.count() > 0) {
    await addBtn.scrollIntoViewIfNeeded()
    await addBtn.click({ force: true })
    await page.waitForTimeout(1000)
    await shot(page, 'addplace-top')
    const searchInput = page.locator('.receipt-place input, .receipt input[type="text"]').first()
    if (await searchInput.count() > 0) {
      await searchInput.fill('Nando')
      await page.waitForTimeout(1500)
      await shot(page, 'addplace-search-results')
      await searchInput.clear()
    }
    await page.evaluate(() => { const m = document.querySelector('.receipt'); if (m) m.scrollTop = 300 })
    await page.waitForTimeout(400)
    await shot(page, 'addplace-photo-comment')
    await page.evaluate(() => { const m = document.querySelector('.receipt'); if (m) m.scrollTop = m.scrollHeight })
    await page.waitForTimeout(400)
    await shot(page, 'addplace-tags-submit')
    await closePopup(page)
    await page.waitForTimeout(300)
  }

  // Settings
  console.log('\nSettings')
  await page.goto(`${BASE}/settings`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await shot(page, 'settings-profile-picture')
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(300)
  await shot(page, 'settings-account')
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(300)
  await shot(page, 'settings-privacy-org-search')
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(300)
  await shot(page, 'settings-create-org')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  await shot(page, 'settings-delete-account')

  // Network
  console.log('\nNetwork')
  await page.goto(`${BASE}/network`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await shot(page, 'network-following')
  const followersTab = page.locator('.network-tab', { hasText: 'Followers' }).first()
  if (await followersTab.count() > 0) { await followersTab.click(); await page.waitForTimeout(500); await shot(page, 'network-followers') }
  const findTab = page.locator('.network-tab', { hasText: 'Find' }).first()
  if (await findTab.count() > 0) { await findTab.click(); await page.waitForTimeout(500); await shot(page, 'network-find') }

  // Org page
  console.log('\nOrg page (StackOne)')
  await page.goto(`${BASE}/org/stackone`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  await shot(page, 'org-hero')
  await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  await shot(page, 'org-map')
  await page.evaluate(() => document.querySelector('[data-testid="rating-histogram"]')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  await shot(page, 'org-histogram')
  await scrollTo(page, '[data-testid="restaurant-list"]')
  await page.waitForTimeout(400)
  await shot(page, 'org-table')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  await shot(page, 'org-footer')
  await page.close()

  // ── ALEX (different org) ──
  console.log('\nAuthenticated (alex) — cross-org')
  page = await ctx.newPage()
  await loginViaAPI(page, 'alex@acme.com')
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  await shot(page, 'alex-dash-hero')
  await scrollTo(page, '[data-testid="restaurant-list"]')
  await page.waitForTimeout(400)
  await shot(page, 'alex-dash-table')
  const padella2 = page.locator('[data-testid="restaurant-row-padella"]')
  if (await padella2.count() > 0) {
    await padella2.scrollIntoViewIfNeeded()
    await padella2.click()
    await page.waitForTimeout(1000)
    await shot(page, 'alex-popup-padella')
    await closePopup(page)
    await page.waitForTimeout(300)
  }
  await page.goto(`${BASE}/network`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await shot(page, 'alex-network')
  await page.goto(`${BASE}/settings`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await shot(page, 'alex-settings')
  await page.close()

  // ── DESKTOP (1280x800) ──
  console.log('\nDesktop viewport (1280x800)')
  const dCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await dCtx.addInitScript(() => {
    const s = document.createElement('style')
    s.textContent = 'astro-dev-toolbar { display: none !important; }'
    ;(document.head || document.documentElement).appendChild(s)
  })
  const dp = await dCtx.newPage()
  await dp.goto(BASE)
  await dp.waitForLoadState('networkidle')
  await dp.waitForTimeout(1500)
  await shot(dp, 'desktop-landing')
  await dp.goto(`${BASE}/login`)
  await dp.waitForLoadState('networkidle')
  await dp.waitForTimeout(500)
  await shot(dp, 'desktop-login')
  await loginViaAPI(dp, 'james@stackone.com')
  await dp.waitForTimeout(2000)
  await dp.evaluate(() => window.scrollTo(0, 0))
  await dp.waitForTimeout(500)
  await shot(dp, 'desktop-dash-hero')
  await scrollTo(dp, '[data-testid="restaurant-list"]')
  await dp.waitForTimeout(400)
  await shot(dp, 'desktop-dash-table')
  const dRow = dp.locator('[data-testid="restaurant-row-padella"]')
  if (await dRow.count() > 0) {
    await dRow.click()
    await dp.waitForTimeout(1000)
    await shot(dp, 'desktop-popup-padella')
    await closePopup(dp)
  }
  await dp.goto(`${BASE}/settings`)
  await dp.waitForLoadState('networkidle')
  await dp.waitForTimeout(1000)
  await shot(dp, 'desktop-settings')
  await dp.goto(`${BASE}/network`)
  await dp.waitForLoadState('networkidle')
  await dp.waitForTimeout(1000)
  await shot(dp, 'desktop-network')
  await dp.close()
  await dCtx.close()

  await browser.close()
  console.log(`\nDone! ${shotIndex} screenshots saved to ${OUT}`)
}

main().catch(console.error)
