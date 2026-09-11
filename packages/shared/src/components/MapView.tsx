import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, AttributionControl } from 'react-leaflet'
import L from 'leaflet'
import type { RestaurantWithReviews } from '../lib/database.types'
import { useFilterStore } from '../lib/store'
import { getMapView, setMapView } from '../lib/cache'

interface MapViewProps {
  restaurants: RestaurantWithReviews[]
  officeLocation?: { lat: number; lng: number } | null
  showOfficeMarker?: boolean
  orgName?: string | null
  onRestaurantClick?: (restaurant: RestaurantWithReviews) => void
  /** Whose remembered map position to restore. Omit to always open at the default. */
  userId?: string | null
}

// Default center (London Bridge area) when no office location
const DEFAULT_CENTER = { lat: 51.5047, lng: -0.0886 }

// Custom marker icons
const createIcon = (color: string, size: number = 10) => {
  const totalSize = size + 4
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    "></div>`,
    iconSize: [totalSize, totalSize],
    iconAnchor: [totalSize/2, totalSize/2],
  })
}

// A teardrop pin, so the homebase reads as a place rather than as another
// rating dot. Anchored at the tip so the point sits on the coordinate.
const officeIcon = L.divIcon({
  className: 'custom-marker',
  html: `<svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"
              style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
    <path d="M12 0.75C5.92 0.75 1 5.67 1 11.75c0 7.9 9.65 18.3 10.06 18.74a1.3 1.3 0 0 0 1.88 0C13.35 30.05 23 19.65 23 11.75 23 5.67 18.08 0.75 12 0.75z"
          fill="#c45d3e" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="11.5" r="4" fill="white"/>
  </svg>`,
  iconSize: [24, 32],
  iconAnchor: [12, 32],
  popupAnchor: [0, -30],
})

function getRatingColor(rating: number | null): string {
  if (rating === null) return '#999'
  if (rating >= 8) return '#2d7a4f'
  if (rating >= 6) return '#b8860b'
  return '#c4723a'
}

function getRatingClass(rating: number): string {
  if (rating >= 8) return 'rating-great'
  if (rating >= 6) return 'rating-good'
  return 'rating-poor'
}

function getRatingLabel(rating: number): string {
  const labels: Record<number, string> = {
    1: 'Avoid', 2: 'Poor', 3: 'Bad', 4: 'Meh', 5: 'Ok',
    6: 'Decent', 7: 'Good', 8: 'Great', 9: 'Excellent', 10: 'Perfect'
  }
  return labels[Math.round(rating)] || ''
}

function MapController({ highlightedId, restaurants }: { highlightedId: string | null, restaurants: RestaurantWithReviews[] }) {
  const map = useMap()
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  useEffect(() => {
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        const latLng = layer.getLatLng()
        const restaurant = restaurants.find(r =>
          r.latitude === latLng.lat && r.longitude === latLng.lng
        )
        if (restaurant) {
          markersRef.current.set(restaurant.id, layer)
        }
      }
    })
  }, [map, restaurants])

  useEffect(() => {
    if (highlightedId) {
      const restaurant = restaurants.find(r => r.id === highlightedId)
      if (restaurant?.latitude && restaurant?.longitude) {
        // Re-scan markers to get fresh references
        map.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            const latLng = layer.getLatLng()
            const r = restaurants.find(r =>
              r.latitude === latLng.lat && r.longitude === latLng.lng
            )
            if (r) {
              markersRef.current.set(r.id, layer)
            }
          }
        })

        map.panTo([restaurant.latitude, restaurant.longitude], {
          animate: true,
          duration: 0.3,
          easeLinearity: 0.5
        })

        // Small delay to let pan complete before opening popup
        setTimeout(() => {
          const marker = markersRef.current.get(highlightedId)
          if (marker) {
            marker.openPopup()
          }
        }, 350)
      }
    }
  }, [highlightedId, restaurants, map])

  return null
}

// Office marker component
function OfficeMarker({ name, address, lat, lng }: { name: string; address?: string | null; lat: number; lng: number }) {
  return (
    <Marker position={[lat, lng]} icon={officeIcon}>
      <Popup>
        <div style={{ fontFamily: 'Inter, sans-serif', padding: '4px 0', minWidth: '200px' }}>
          <strong style={{ fontSize: '14px' }}>{name}</strong>
          {address && (
            <div style={{ fontSize: '12px', color: '#6d6560', marginTop: '2px' }}>{address}</div>
          )}
        </div>
      </Popup>
    </Marker>
  )
}

// Restaurant marker component
function RestaurantMarker({
  restaurant,
  isHighlighted,
  onClick,
  onRestaurantClick,
}: {
  restaurant: RestaurantWithReviews
  isHighlighted: boolean
  onClick: (id: string) => void
  onRestaurantClick?: (restaurant: RestaurantWithReviews) => void
}) {
  return (
    <Marker
      position={[restaurant.latitude!, restaurant.longitude!]}
      icon={createIcon(
        getRatingColor(restaurant.avgRating),
        isHighlighted ? 14 : 10,
      )}
      eventHandlers={{
        click: () => onClick(restaurant.id),
      }}
    >
      <Popup>
        <div className="map-popup" onClick={() => onRestaurantClick?.(restaurant)}>
          <div className="map-popup-name">{restaurant.name}</div>
          <div className="map-popup-meta">
            {restaurant.cuisine && <span>{restaurant.cuisine}</span>}
            {restaurant.cuisine && restaurant.avgRating !== null && <span>·</span>}
            {restaurant.avgRating !== null && (
              <span className={`rating-badge ${getRatingClass(restaurant.avgRating)}`}>
                {restaurant.avgRating.toFixed(1)} — {getRatingLabel(restaurant.avgRating)}
              </span>
            )}
          </div>
          {restaurant.topTags && restaurant.topTags.length > 0 && (
            <div className="map-popup-tags">
              {restaurant.topTags.slice(0, 3).map(({ tag }) => (
                <span key={tag.id} className="tag-mini">
                  <span className="tag-mini-name">{tag.name}</span>
                </span>
              ))}
            </div>
          )}
          <div className="map-popup-footer">
            {restaurant.reviews.length} review{restaurant.reviews.length !== 1 ? 's' : ''}
            {onRestaurantClick && ' · Click for more'}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

/**
 * Recentres once when the homebase arrives.
 *
 * MapContainer only reads `center` on its first render, but the org (and so the
 * homebase) is fetched after mount — so the map would open on the default and
 * stay there. Only runs when the user has no remembered position, and only
 * once, so it can never yank the map out from under someone panning.
 */
function MapAutoCentre({ target, enabled }: { target: { lat: number; lng: number } | null; enabled: boolean }) {
  const map = useMap()
  const done = useRef(false)

  useEffect(() => {
    if (!enabled || done.current || !target) return
    done.current = true
    map.setView([target.lat, target.lng], map.getZoom())
  }, [map, target, enabled])

  return null
}

/** Records the viewport as the user pans and zooms, so it survives a reload. */
function MapViewPersistence({ userId }: { userId: string | null }) {
  const map = useMap()

  useEffect(() => {
    if (!userId) return

    const save = () => {
      const c = map.getCenter()
      setMapView(userId, { lat: c.lat, lng: c.lng, zoom: map.getZoom() })
    }

    map.on('moveend', save)
    map.on('zoomend', save)
    return () => {
      map.off('moveend', save)
      map.off('zoomend', save)
    }
  }, [map, userId])

  return null
}

export function MapView({ restaurants, officeLocation, showOfficeMarker = false, orgName, onRestaurantClick, userId = null }: MapViewProps) {
  const { highlightedRestaurantId, setHighlightedRestaurantId } = useFilterStore()

  // Read once on mount: MapContainer only honours center/zoom on first render,
  // and re-reading would fight the user's own panning.
  const savedView = useRef(getMapView(userId)).current
  const mapCenter = savedView ?? officeLocation ?? DEFAULT_CENTER
  const initialZoom = savedView?.zoom ?? 15

  const validRestaurants = useMemo(() =>
    restaurants.filter(r => r.latitude !== null && r.longitude !== null),
    [restaurants]
  )

  return (
    <div className="map-container">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={initialZoom}
        scrollWheelZoom={true}
        wheelPxPerZoomLevel={150}
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
        />

        <MapController highlightedId={highlightedRestaurantId} restaurants={restaurants} />
        <MapViewPersistence userId={userId} />
        <MapAutoCentre target={officeLocation ?? null} enabled={!savedView} />

        {/* Homebase marker */}
        {showOfficeMarker && officeLocation && (
          <OfficeMarker
            // The saved homebase carries its own label (e.g. "Techspace Goswell
            // Road"), which is more useful than the org name.
            name={officeLocation.name || orgName || 'Homebase'}
            address={officeLocation.address ?? null}
            lat={officeLocation.lat}
            lng={officeLocation.lng}
          />
        )}

        {/* Restaurant markers */}
        {validRestaurants.map(restaurant => (
          <RestaurantMarker
            key={restaurant.id}
            restaurant={restaurant}
            isHighlighted={highlightedRestaurantId === restaurant.id}
            onClick={setHighlightedRestaurantId}
            onRestaurantClick={onRestaurantClick}
          />
        ))}
      </MapContainer>
    </div>
  )
}
