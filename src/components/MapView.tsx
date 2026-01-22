import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { RestaurantWithReviews } from '../lib/database.types'
import { useFilterStore } from '../lib/store'
import { formatDistance } from '../lib/distance'

interface MapViewProps {
  restaurants: RestaurantWithReviews[]
}

// Runway East Borough Market - 20 St Thomas St, SE1 9RS
const OFFICE_LAT = 51.5047
const OFFICE_LNG = -0.0886

// Custom marker icons
const createIcon = (color: string, size: number = 10) => {
  const totalSize = size + 4 // account for 2px border on each side
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
  iconSize: [18, 18], // 14 + 4 for border
  iconAnchor: [9, 9],
})

function getRatingColor(rating: number | null): string {
  if (rating === null) return '#999'
  if (rating >= 8) return '#2d7a4f'
  if (rating >= 6) return '#b8860b'
  return '#a64d4d'
}

function getRatingLabel(rating: number): string {
  const labels: Record<number, string> = {
    1: 'Avoid', 2: 'Poor', 3: 'Bad', 4: 'Meh', 5: 'Ok',
    6: 'Decent', 7: 'Good', 8: 'Great', 9: 'Excellent', 10: 'Perfect'
  }
  return labels[Math.round(rating)] || ''
}

// Component to handle map interactions - smoother, no shake
function MapController({ highlightedId, restaurants }: { highlightedId: string | null, restaurants: RestaurantWithReviews[] }) {
  const map = useMap()
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  // Store marker refs
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

  // Open popup when highlighted changes (from table click)
  useEffect(() => {
    if (highlightedId) {
      const restaurant = restaurants.find(r => r.id === highlightedId)
      if (restaurant?.latitude && restaurant?.longitude) {
        // Smooth pan without zoom change - no shaking
        map.panTo([restaurant.latitude, restaurant.longitude], {
          animate: true,
          duration: 0.3,
          easeLinearity: 0.5
        })

        // Open the popup
        const marker = markersRef.current.get(highlightedId)
        if (marker) {
          marker.openPopup()
        }
      }
    }
  }, [highlightedId, restaurants, map])

  return null
}

export function MapView({ restaurants }: MapViewProps): JSX.Element {
  const { highlightedRestaurantId, setHighlightedRestaurantId } = useFilterStore()

  const validRestaurants = useMemo(() =>
    restaurants.filter(r => r.latitude !== null && r.longitude !== null),
    [restaurants]
  )

  return (
    <div className="map-container">
      <MapContainer
        center={[OFFICE_LAT, OFFICE_LNG]}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <MapController highlightedId={highlightedRestaurantId} restaurants={restaurants} />

        {/* Office marker */}
        <Marker position={[OFFICE_LAT, OFFICE_LNG]} icon={officeIcon}>
          <Popup>
            <div style={{ fontFamily: 'Inter, sans-serif', padding: '4px 0' }}>
              <strong style={{ fontSize: '14px' }}>Runway East</strong>
              <p style={{ margin: '4px 0 0', color: '#666', fontSize: '12px' }}>London Bridge — HQ</p>
            </div>
          </Popup>
        </Marker>

        {/* Restaurant markers */}
        {validRestaurants.map(restaurant => (
          <Marker
            key={restaurant.id}
            position={[restaurant.latitude!, restaurant.longitude!]}
            icon={createIcon(
              getRatingColor(restaurant.avgRating),
              highlightedRestaurantId === restaurant.id ? 14 : 10
            )}
            eventHandlers={{
              click: () => setHighlightedRestaurantId(restaurant.id),
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', padding: '4px 0', minWidth: '200px' }}>
                <strong style={{ fontSize: '15px', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                  {restaurant.name}
                </strong>
                <p style={{ margin: '0 0 10px', color: '#666', fontSize: '13px' }}>
                  {restaurant.type} · {formatDistance(restaurant.distance)}
                </p>
                {restaurant.avgRating !== null && (
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: getRatingColor(restaurant.avgRating),
                    marginBottom: '8px'
                  }}>
                    {restaurant.avgRating.toFixed(1)}/10 — {getRatingLabel(restaurant.avgRating)}
                  </div>
                )}
                {restaurant.notes && (
                  <p style={{ margin: '0', color: '#666', fontSize: '12px', fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                    "{restaurant.notes}"
                  </p>
                )}
                {restaurant.reviews.length > 0 && (
                  <div style={{ borderTop: '1px solid #eee', paddingTop: '8px', marginTop: '8px' }}>
                    <p style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      Reviews ({restaurant.reviews.length})
                    </p>
                    {restaurant.reviews.slice(0, 3).map(review => (
                      <div key={review.id} style={{ fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          color: review.rating && review.rating >= 8 ? '#2d7a4f' : review.rating && review.rating >= 6 ? '#b8860b' : '#a64d4d'
                        }}>
                          {review.rating}/10
                        </span>
                        {review.comment && <span style={{ color: '#666', marginLeft: '8px' }}>{review.comment}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
