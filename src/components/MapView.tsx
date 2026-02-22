import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, AttributionControl } from 'react-leaflet'
import L from 'leaflet'
import type { RestaurantWithReviews } from '../lib/database.types'
import { useFilterStore } from '../lib/store'

interface MapViewProps {
  restaurants: RestaurantWithReviews[]
  officeLocation?: { lat: number; lng: number } | null
  showOfficeMarker?: boolean
  orgName?: string | null
  onRestaurantClick?: (restaurant: RestaurantWithReviews) => void
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

const officeIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 14px;
    height: 14px;
    background: #c45d3e;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function getRatingColor(rating: number | null): string {
  if (rating === null) return '#999'
  if (rating >= 8) return '#2d7a4f'
  if (rating >= 6) return '#b8860b'
  return '#a64d4d'
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
function OfficeMarker({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  return (
    <Marker position={[lat, lng]} icon={officeIcon}>
      <Popup>
        <div style={{ fontFamily: 'Inter, sans-serif', padding: '4px 0', minWidth: '200px' }}>
          <strong style={{ fontSize: '14px' }}>{name}</strong>
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

export function MapView({ restaurants, officeLocation, showOfficeMarker = false, orgName, onRestaurantClick }: MapViewProps): JSX.Element {
  const { highlightedRestaurantId, setHighlightedRestaurantId } = useFilterStore()

  const mapCenter = officeLocation || DEFAULT_CENTER

  const validRestaurants = useMemo(() =>
    restaurants.filter(r => r.latitude !== null && r.longitude !== null),
    [restaurants]
  )

  return (
    <div className="map-container">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={15}
        scrollWheelZoom={true}
        wheelPxPerZoomLevel={150}
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          attribution='© OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <MapController highlightedId={highlightedRestaurantId} restaurants={restaurants} />

        {/* Office marker - only show when in org context */}
        {showOfficeMarker && officeLocation && (
          <OfficeMarker
            name={orgName || 'Office'}
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
