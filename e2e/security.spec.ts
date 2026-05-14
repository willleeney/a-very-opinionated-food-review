import { test, expect } from './fixtures'

test.describe('Security headers and privacy', () => {
  test('responses include security headers', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    const headers = response!.headers()
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy']).toContain('camera=()')
  })

  test('CSP header is present', async ({ page }) => {
    const response = await page.goto('/')
    const csp = response!.headers()['content-security-policy']
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  test('landing page does not expose real review comments', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('landing-view')).toBeVisible()

    // Should show generic "Team member" text, not real user names
    const content = await page.textContent('body')
    expect(content).not.toContain('james@stackone.com')
    expect(content).not.toContain('James Mitchell')
  })

  test('landing page shows teaser comments instead of real ones', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('landing-view')).toBeVisible()

    // Teaser comments should be visible (from the TEASER_COMMENTS array)
    const teaserPhrases = [
      'A solid lunch spot',
      'Worth the walk',
      'Good value for the area',
    ]

    // At least one teaser comment should appear on the page
    let found = false
    for (const phrase of teaserPhrases) {
      const count = await page.getByText(phrase).count()
      if (count > 0) {
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })
})
