import { test, expect, loginAs } from './fixtures/auth.fixture'
import { TEST_USERS } from './helpers/auth'

test.describe('Network page', () => {
  test('network page loads with heading and tabs', async ({ authenticatedPage: page }) => {
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Should show the network heading
    await expect(page.getByRole('heading', { name: 'Your Network' })).toBeVisible()

    // Should show tab buttons
    await expect(page.getByRole('button', { name: /Following/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Followers/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Find/i })).toBeVisible()
  })

  test('Following tab shows followed users', async ({ authenticatedPage: page }) => {
    // James follows Sarah and Private User per seed data
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Following tab should be active by default
    await expect(page.getByRole('button', { name: /Following/i })).toBeVisible()

    // Should show Sarah Kim (james follows sarah)
    await expect(page.getByText('Sarah Kim')).toBeVisible({ timeout: 10_000 })

    // Each followed user should have an Unfollow button
    await expect(page.getByRole('button', { name: 'Unfollow' }).first()).toBeVisible()
  })

  test('can switch between tabs', async ({ authenticatedPage: page }) => {
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Click Followers tab
    await page.getByRole('button', { name: /Followers/i }).click()

    // James has followers: Sarah and Maya per seed data
    // Should show at least one follower
    await expect(page.getByText('Sarah Kim').or(page.getByText('Maya Roberts')).first()).toBeVisible({ timeout: 10_000 })

    // Click Find tab
    await page.getByRole('button', { name: /Find/i }).click()

    // Find tab should show users not yet followed
    await expect(page.getByText('Alex Lee').or(page.getByText('Maya Roberts')).first()).toBeVisible({ timeout: 10_000 })
  })

  test('Find tab shows Follow button for unfollowed users', async ({ authenticatedPage: page }) => {
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Switch to Find tab
    await page.getByRole('button', { name: /Find/i }).click()

    // Should show a Follow button for users not yet followed
    await expect(page.getByRole('button', { name: /Follow/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('user names and review stats are displayed', async ({ authenticatedPage: page }) => {
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Table should have headers for Person, Reviews, Avg
    await expect(page.getByText('Person')).toBeVisible()
    await expect(page.getByText('Avg')).toBeVisible()

    // User avatars (initials) should be present - they render as 2-letter divs
    // Sarah Kim's initials would be "SA"
    await expect(page.getByText('Sarah Kim')).toBeVisible({ timeout: 10_000 })
  })

  test('search filters users in current tab', async ({ authenticatedPage: page }) => {
    await page.goto('/network')
    await page.waitForLoadState('networkidle')

    // Wait for Following tab to load
    await expect(page.getByText('Sarah Kim')).toBeVisible({ timeout: 10_000 })

    // Search for a user
    const searchInput = page.getByPlaceholder('Search following...')
    await searchInput.fill('Sarah')

    // Should still show Sarah
    await expect(page.getByText('Sarah Kim')).toBeVisible()
  })
})
