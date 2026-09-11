/**
 * Simple localStorage cache for dashboard data.
 * Shows stale data instantly on cold start while fresh data loads in the background.
 */

const CACHE_KEY = 'tastefull_dashboard_cache'
const CACHE_VERSION = 1

interface CachedDashboard {
  version: number
  timestamp: number
  restaurants: unknown[]
  users: unknown[]
  tags: unknown[]
}

export function getDashboardCache(): CachedDashboard | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as CachedDashboard
    if (data.version !== CACHE_VERSION) return null
    return data
  } catch {
    return null
  }
}

export function setDashboardCache(
  restaurants: unknown[],
  users: unknown[],
  tags: unknown[],
) {
  try {
    const data: CachedDashboard = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      restaurants,
      users,
      tags,
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export function clearDashboardCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Remembers where each user left the map, so it opens where they last were
 * rather than snapping back to the office.
 *
 * Keyed by user id because browsers get shared, and stored locally rather than
 * in the database: it is a per-device view preference, not account data worth a
 * round trip on every pan.
 */
const MAP_VIEW_KEY = 'tastefull_map_view'

export interface MapView {
  lat: number
  lng: number
  zoom: number
}

export function getMapView(userId: string | null): MapView | null {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(`${MAP_VIEW_KEY}:${userId}`)
    if (!raw) return null
    const v = JSON.parse(raw) as MapView
    // Guard against a corrupted or half-written entry putting the map in the sea.
    if (
      typeof v?.lat !== 'number' || typeof v?.lng !== 'number' || typeof v?.zoom !== 'number' ||
      Number.isNaN(v.lat) || Number.isNaN(v.lng) || Number.isNaN(v.zoom) ||
      Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180 || v.zoom < 1 || v.zoom > 22
    ) return null
    return v
  } catch {
    return null
  }
}

export function setMapView(userId: string | null, view: MapView) {
  if (!userId) return
  try {
    localStorage.setItem(`${MAP_VIEW_KEY}:${userId}`, JSON.stringify(view))
  } catch {
    // localStorage full or unavailable — ignore
  }
}
