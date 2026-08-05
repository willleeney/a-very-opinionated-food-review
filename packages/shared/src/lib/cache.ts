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
