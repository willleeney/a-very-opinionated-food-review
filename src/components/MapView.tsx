import { useEffect, useRef, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { RestaurantWithReviews } from '../lib/database.types'
import { useFilterStore } from '../lib/store'
import { formatDistance } from '../lib/distance'
import { supabase } from '../lib/supabase'

interface MapViewProps {
  restaurants: RestaurantWithReviews[]
  onLocationUpdated?: () => void
}

// Runway East Borough Market - 20 St Thomas St, SE1 9RS
const OFFICE_LAT = 51.5047
const OFFICE_LNG = -0.0886

// Custom marker icons
const createIcon = (color: string, size: number = 10, editing: boolean = false) => {
  const totalSize = size + 4
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 2px solid ${editing ? '#c45d3e' : 'white'};
      border-radius: 50%;
      box-shadow: 0 ${editing ? '2px 8px' : '1px 4px'} rgba(0,0,0,${editing ? '0.4' : '0.2'});
      ${editing ? 'cursor: grab;' : ''}
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
        map.panTo([restaurant.latitude, restaurant.longitude], {
          animate: true,
          duration: 0.3,
          easeLinearity: 0.5
        })

        const marker = markersRef.current.get(highlightedId)
        if (marker) {
          marker.openPopup()
        }
      }
    }
  }, [highlightedId, restaurants, map])

  return null
}

// Individual marker component to handle editing state
function RestaurantMarker({
  restaurant,
  isHighlighted,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSaveLocation,
  onClick
}: {
  restaurant: RestaurantWithReviews
  isHighlighted: boolean
  editingId: string | null
  onStartEdit: (id: string) => void
  onCancelEdit: () => void
  onSaveLocation: (id: string, lat: number, lng: number) => void
  onClick: (id: string) => void
}) {
  const isEditing = editingId === restaurant.id
  const markerRef = useRef<L.Marker>(null)
  const [tempPosition, setTempPosition] = useState<[number, number] | null>(null)

  const position: [number, number] = tempPosition || [restaurant.latitude!, restaurant.longitude!]

  const handleDragEnd = () => {
    if (markerRef.current) {
      const newPos = markerRef.current.getLatLng()
      setTempPosition([newPos.lat, newPos.lng])
    }
  }

  const handleSave = () => {
    const pos = tempPosition || [restaurant.latitude!, restaurant.longitude!]
    onSaveLocation(restaurant.id, pos[0], pos[1])
    setTempPosition(null)
  }

  const handleCancel = () => {
    setTempPosition(null)
    onCancelEdit()
  }

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={createIcon(
        getRatingColor(restaurant.avgRating),
        isHighlighted || isEditing ? 14 : 10,
        isEditing
      )}
      draggable={isEditing}
      eventHandlers={{
        click: () => !isEditing && onClick(restaurant.id),
        dragend: handleDragEnd,
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

          {isEditing ? (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '10px', marginTop: '8px' }}>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                {tempPosition ? 'New position set. Save to confirm.' : 'Drag the pin to move it.'}
              </p>
              <p style={{ fontSize: '11px', color: '#999', fontFamily: 'JetBrains Mono', marginBottom: '10px' }}>
                {tempPosition
                  ? `${tempPosition[0].toFixed(6)}, ${tempPosition[1].toFixed(6)}`
                  : `${restaurant.latitude!.toFixed(6)}, ${restaurant.longitude!.toFixed(6)}`
                }
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSave}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: '#c45d3e',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tempPosition ? 'Save' : 'Done'}
                </button>
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: 'none',
                    border: '1px solid #ddd',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
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
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStartEdit(restaurant.id)
                }}
                style={{
                  marginTop: '10px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  background: 'none',
                  border: '1px solid #ddd',
                  cursor: 'pointer',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Edit location
              </button>
            </>
          )}
        </div>
      </Popup>
    </Marker>
  )
}

export function MapView({ restaurants, onLocationUpdated }: MapViewProps): JSX.Element {
  const { highlightedRestaurantId, setHighlightedRestaurantId } = useFilterStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const validRestaurants = useMemo(() =>
    restaurants.filter(r => r.latitude !== null && r.longitude !== null),
    [restaurants]
  )

  const handleSaveLocation = async (id: string, lat: number, lng: number) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ latitude: lat, longitude: lng })
        .eq('id', id)

      if (error) throw error

      setEditingId(null)
      if (onLocationUpdated) {
        onLocationUpdated()
      }
    } catch (err) {
      console.error('Failed to update location:', err)
      alert('Failed to save location')
    } finally {
      setSaving(false)
    }
  }

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
          <RestaurantMarker
            key={restaurant.id}
            restaurant={restaurant}
            isHighlighted={highlightedRestaurantId === restaurant.id}
            editingId={editingId}
            onStartEdit={setEditingId}
            onCancelEdit={() => setEditingId(null)}
            onSaveLocation={handleSaveLocation}
            onClick={setHighlightedRestaurantId}
          />
        ))}
      </MapContainer>
    </div>
  )
}
