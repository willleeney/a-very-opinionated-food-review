import { test as base } from '@playwright/test'

/**
 * Extended test fixture that automatically hides the Astro dev toolbar
 * on every page load, preventing it from intercepting pointer events.
 *
 * addInitScript runs before page scripts on every navigation — this ensures
 * the toolbar is hidden before it can render and block clicks.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      // Create a style element as soon as the DOM is ready
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

    await use(page)
  },
})

export { expect } from '@playwright/test'
