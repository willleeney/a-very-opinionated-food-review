// Default office location (used as fallback)
const DEFAULT_OFFICE_LAT = 51.5047
const DEFAULT_OFFICE_LNG = -0.0886

// Haversine formula to calculate distance between two points
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Calculate distance from a reference point in km
export function distanceFrom(
  refLat: number,
  refLng: number,
  lat: number | null,
  lng: number | null
): number | null {
  if (lat === null || lng === null) return null
  return haversineDistance(refLat, refLng, lat, lng)
}

// Calculate distance from default office (for backwards compatibility)
export function distanceFromOffice(lat: number | null, lng: number | null): number | null {
  return distanceFrom(DEFAULT_OFFICE_LAT, DEFAULT_OFFICE_LNG, lat, lng)
}

// Convert km to walking time (assume 5 km/h walking speed)
export function kmToWalkingMinutes(km: number | null): number | null {
  if (km === null) return null
  return Math.round((km / 5) * 60)
}

// Format distance for display
export function formatDistance(km: number | null): string {
  if (km === null) return '?'
  const minutes = kmToWalkingMinutes(km)
  return `${minutes} min`
}
