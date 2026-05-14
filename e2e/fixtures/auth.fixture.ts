import { test as base, expect } from '@playwright/test'
import { loginViaAPI, type TestUser } from '../helpers/auth'

/**
 * Extended test with `authenticatedPage` fixture.
 * Signs in via Supabase API (fast, no UI interaction) and suppresses Astro dev toolbar.
 */
export const test = base.extend<{ authenticatedPage: ReturnType<typeof base.extend> extends infer T ? T : never } & { authenticatedPage: import('@playwright/test').Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Hide Astro dev toolbar to prevent click interception
    await page.addInitScript(() => {
      const hideToolbar = () => {
        const style = document.createElement('style')
        style.textContent = 'astro-dev-toolbar { display: none !important; }'
        ;(document.head || document.documentElement).appendChild(style)
      }
      if (document.head) {
        hideToolbar()
      } else {
        document.addEventListener('DOMContentLoaded', hideToolbar)
      }
    })

    // Sign in via API (fast path)
    await loginViaAPI(page, 'james')

    // Wait for the dashboard to render
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })

    await use(page)
  },
})

/**
 * Authenticated page fixture for a specific user.
 * Usage: `const page = await loginAs(page, 'alex')`
 */
export async function loginAs(page: import('@playwright/test').Page, user: TestUser) {
  await loginViaAPI(page, user)
  await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 15_000 })
  return page
}

export { expect } from '@playwright/test'
