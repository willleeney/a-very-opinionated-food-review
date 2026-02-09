import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, AttributionControl } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import type { RestaurantCategory } from '../lib/database.types'

const ALL_CATEGORIES: { value: RestaurantCategory; label: string }[] = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'brunch', label: 'Brunch' },
  { value: 'pub', label: 'Pub' },
]

interface AddReviewProps {
  userId: string
  organisationId?: string
  onAdded: () => void
}

interface PlaceResult {
  placeId: string
  name: string
  address: string
  lat?: number
  lng?: number
}

// Marker icon for selected location
const selectedIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 14px;
    height: 14px;
    background: #c45d3e;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// Component to handle map clicks
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Component to pan map to location
function MapPanner({ lat, lng }: { lat: number | null, lng: number | null }) {
  const map = useMap()

  useEffect(() => {
    if (lat && lng) {
      map.panTo([lat, lng], { animate: true })
    }
  }, [lat, lng, map])

  return null
}

export function AddReview({ userId, organisationId, onAdded }: AddReviewProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [nameQuery, setNameQuery] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [cuisine, setCuisine] = useState('')
  const [categories, setCategories] = useState<RestaurantCategory[]>([])
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [overallRating, setOverallRating] = useState('')
  const [valueRating, setValueRating] = useState('')
  const [tasteRating, setTasteRating] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResults, setLookupResults] = useState<PlaceResult[]>([])
  const [showMap, setShowMap] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCategory = (cat: RestaurantCategory) => {
    setCategories(prev =>
      prev.includes(cat)
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    )
  }

  // Debounced search as user types
  useEffect(() => {
    if (!nameQuery.trim() || nameQuery.length < 2 || selectedPlace) {
      setLookupResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setLookupLoading(true)
      setError(null)

      const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        setLookupLoading(false)
        return
      }

      try {
        const response = await fetch(
          'https://places.googleapis.com/v1/places:autocomplete',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
            },
            body: JSON.stringify({
              input: nameQuery,
              includedPrimaryTypes: ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway'],
            })
          }
        )

        if (!response.ok) {
          setLookupResults([])
          return
        }

        const data = await response.json()
        const suggestions = data.suggestions || []

        const results: PlaceResult[] = suggestions.map((s: { placePrediction: { placeId: string; structuredFormat: { mainText: { text: string }; secondaryText: { text: string } } } }) => ({
          placeId: s.placePrediction.placeId,
          name: s.placePrediction.structuredFormat.mainText.text,
          address: s.placePrediction.structuredFormat.secondaryText.text
        }))
        setLookupResults(results)
      } catch (err) {
        console.error('Places API error:', err)
        setLookupResults([])
      } finally {
        setLookupLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [nameQuery, selectedPlace])

  const selectResult = async (result: PlaceResult) => {
    const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${result.placeId}?fields=location`,
        {
          headers: {
            'X-Goog-Api-Key': apiKey,
          }
        }
      )

      if (!response.ok) throw new Error('Failed to get place details')

      const data = await response.json()
      if (data.location) {
        setLatitude(data.location.latitude)
        setLongitude(data.location.longitude)
        setSelectedPlace(result)
        setNameQuery(result.name)
        setShowMap(true)
      }
    } catch (err) {
      console.error('Place details error:', err)
      setError('Failed to get location. Try placing on map manually.')
    }

    setLookupResults([])
  }

  const clearSelectedPlace = () => {
    setSelectedPlace(null)
    setLatitude(null)
    setLongitude(null)
    setShowMap(false)
    setNameQuery('')
  }

  const handleMapClick = (lat: number, lng: number) => {
    setLatitude(lat)
    setLongitude(lng)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const name = selectedPlace?.name || nameQuery

    try {
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name,
          cuisine,
          categories,
          latitude: latitude,
          longitude: longitude,
        })
        .select()
        .single()

      if (restaurantError) throw restaurantError

      // Only add review if overall rating is provided (required)
      if (overallRating) {
        const { error: reviewError } = await supabase.from('reviews').insert({
          restaurant_id: restaurant.id,
          user_id: userId,
          rating: parseInt(overallRating),
          value_rating: valueRating ? parseInt(valueRating) : undefined,
          taste_rating: tasteRating ? parseInt(tasteRating) : undefined,
          comment: comment || null,
          organisation_id: organisationId || null,
        })

        if (reviewError) throw reviewError
      }

      // Reset form
      setNameQuery('')
      setSelectedPlace(null)
      setCuisine('')
      setCategories([])
      setLatitude(null)
      setLongitude(null)
      setOverallRating('')
      setValueRating('')
      setTasteRating('')
      setComment('')
      setLookupResults([])
      setShowMap(false)
      setIsOpen(false)
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add restaurant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn btn-accent">
        Add Place
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ marginBottom: '8px' }}>Add a Place</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Discovered somewhere new?
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: 'var(--text-muted)', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '20px' }}>
                {/* Place search - combines name and location */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Place *
                  </label>
                  {selectedPlace ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-warm)'
                    }}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{selectedPlace.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px' }}>
                          {selectedPlace.address}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedPlace}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={nameQuery}
                      onChange={(e) => setNameQuery(e.target.value)}
                      required={!selectedPlace}
                      placeholder="Search for a restaurant..."
                      style={{ width: '100%' }}
                      autoComplete="off"
                    />
                  )}

                  {/* Search results dropdown */}
                  {lookupResults.length > 0 && !selectedPlace && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      border: '1px solid var(--border)',
                      background: 'white',
                      maxHeight: '250px',
                      overflowY: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      {lookupResults.map((result, i) => (
                        <button
                          key={result.placeId}
                          type="button"
                          onClick={() => selectResult(result)}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px 12px',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            borderBottom: i < lookupResults.length - 1 ? '1px solid var(--border)' : 'none',
                            cursor: 'pointer',
                            lineHeight: 1.4
                          }}
                        >
                          <span style={{ display: 'block', fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
                            {result.name}
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {result.address}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {lookupLoading && (
                    <span style={{ position: 'absolute', right: '12px', top: '32px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      ...
                    </span>
                  )}

                  {/* Map for confirming/adjusting location - directly below place field */}
                  {(showMap || latitude !== null) && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ height: '180px', border: '1px solid var(--border)', marginBottom: '8px' }}>
                        <MapContainer
                          center={[latitude || 51.5047, longitude || -0.0886]}
                          zoom={16}
                          scrollWheelZoom={true}
                          style={{ height: '100%', width: '100%' }}
                          attributionControl={false}
                        >
                          <AttributionControl position="bottomright" prefix={false} />
                          <TileLayer
                            attribution='© OpenStreetMap'
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                          />
                          <MapClickHandler onLocationSelect={handleMapClick} />
                          <MapPanner lat={latitude} lng={longitude} />
                          {latitude !== null && longitude !== null && (
                            <Marker position={[latitude, longitude]} icon={selectedIcon} />
                          )}
                        </MapContainer>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                        Click on the map to adjust location if needed
                      </p>
                    </div>
                  )}

                  {/* Manual placement option - directly below place field */}
                  {!showMap && !selectedPlace && (
                    <button
                      type="button"
                      onClick={() => setShowMap(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)', padding: 0, textAlign: 'left', marginTop: '8px' }}
                    >
                      Can't find it? Place on map manually
                    </button>
                  )}
                </div>

                {/* Cuisine */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Cuisine *
                  </label>
                  <input
                    type="text"
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                    required
                    placeholder="Thai, Sandwich, etc."
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Categories */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Categories
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {ALL_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => toggleCategory(cat.value)}
                        className={`default-chip accent ${categories.includes(cat.value) ? 'active' : ''}`}
                        style={{ fontSize: '12px', padding: '4px 12px' }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Review section */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                  <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Your Review (optional)
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Overall *
                      </label>
                      <select
                        value={overallRating}
                        onChange={(e) => setOverallRating(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="">—</option>
                        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r}/10
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Value
                      </label>
                      <select
                        value={valueRating}
                        onChange={(e) => setValueRating(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="">—</option>
                        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r}/10
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Taste
                      </label>
                      <select
                        value={tasteRating}
                        onChange={(e) => setTasteRating(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="">—</option>
                        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r}/10
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Comment
                    </label>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Brief comment..."
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {error && (
                  <p style={{ color: 'var(--poor)', fontSize: '14px', margin: 0 }}>
                    {error}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-accent"
                  >
                    {loading ? 'Adding...' : 'Add Place'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
