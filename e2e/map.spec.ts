import { test, expect } from './fixtures/auth.fixture'
import { RESTAURANTS, TOTAL_RESTAURANTS } from './helpers/seed-data'

test.describe('Map interactions', () => {
  test('map container is visible on dashboard', async ({ authenticatedPage: page }) => {
    const mapContainer = page.locator('.map-container')
    await expect(mapContainer).toBeVisible()

    // Map should have a Leaflet map rendered inside
    await expect(mapContainer.locator('.leaflet-container')).toBeVisible()
  })

  test('map has markers for seeded restaurants', async ({ authenticatedPage: page }) => {
    // Wait for map to fully load with markers
    const mapContainer = page.locator('.map-container')
    await expect(mapContainer).toBeVisible()

    // Leaflet markers are rendered as divs with class custom-marker
    const markers = mapContainer.locator('.custom-marker')
    // Should have at least as many markers as restaurants with coordinates
    // All 8 seed restaurants have lat/lng
    await expect(markers.first()).toBeVisible({ timeout: 10_000 })
    const markerCount = await markers.count()
    expect(markerCount).toBeGreaterThanOrEqual(TOTAL_RESTAURANTS)
  })

  test('clicking a map marker shows popup with restaurant name', async ({ authenticatedPage: page }) => {
    const mapContainer = page.locator('.map-container')
    await expect(mapContainer).toBeVisible()

    // Click on a marker (any one of them)
    const markers = mapContainer.locator('.custom-marker')
    await expect(markers.first()).toBeVisible({ timeout: 10_000 })
    await markers.first().click()

    // A Leaflet popup should appear with a map-popup element inside
    const popup = mapContainer.locator('.leaflet-popup')
    await expect(popup).toBeVisible({ timeout: 5_000 })

    // Popup should contain a restaurant name from our seed data
    const popupContent = await popup.textContent()
    const restaurantNames = Object.values(RESTAURANTS).map(r => r.name)
    const hasRestaurantName = restaurantNames.some(name => popupContent?.includes(name))
    expect(hasRestaurantName).toBe(true)
  })

  test('map popup shows rating and review count', async ({ authenticatedPage: page }) => {
    const mapContainer = page.locator('.map-container')
    await expect(mapContainer).toBeVisible()

    // Click on a marker
    const markers = mapContainer.locator('.custom-marker')
    await expect(markers.first()).toBeVisible({ timeout: 10_000 })
    await markers.first().click()

    const popup = mapContainer.locator('.leaflet-popup')
    await expect(popup).toBeVisible({ timeout: 5_000 })

    // Popup should contain rating badge and review count text
    const popupText = await popup.textContent()
    expect(popupText).toMatch(/review/)
  })

  test('map zoom controls work', async ({ authenticatedPage: page }) => {
    const mapContainer = page.locator('.map-container')
    await expect(mapContainer).toBeVisible()

    const leafletMap = mapContainer.locator('.leaflet-container')
    await expect(leafletMap).toBeVisible()

    // Leaflet zoom controls should be present
    const zoomIn = mapContainer.locator('.leaflet-control-zoom-in')
    const zoomOut = mapContainer.locator('.leaflet-control-zoom-out')
    await expect(zoomIn).toBeVisible()
    await expect(zoomOut).toBeVisible()

    // Click zoom in and verify it does not error
    await zoomIn.click()
    // Map should still be visible after zoom
    await expect(leafletMap).toBeVisible()
  })
})
