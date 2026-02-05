import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
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

interface GeoResult {
  lat: string
  lon: string
  display_name: string
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
  const [name, setName] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [categories, setCategories] = useState<RestaurantCategory[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [overallRating, setOverallRating] = useState('')
  const [valueRating, setValueRating] = useState('')
  const [tasteRating, setTasteRating] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResults, setLookupResults] = useState<GeoResult[]>([])
  const [showMap, setShowMap] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCategory = (cat: RestaurantCategory) => {
    setCategories(prev =>
      prev.includes(cat)
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    )
  }

  const handleLookup = async () => {
    if (!searchQuery.trim()) return

    setLookupLoading(true)
    setLookupResults([])
    setError(null)

    try {
      const query = encodeURIComponent(searchQuery + ', London, UK')
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&addressdetails=1`,
        { headers: { 'User-Agent': 'FoodReviewApp/1.0' } }
      )

      if (!response.ok) throw new Error('Lookup failed')

      const results: GeoResult[] = await response.json()

      if (results.length === 0) {
        setError('No results found. Try different terms or place on map manually.')
        setShowMap(true)
      } else if (results.length === 1) {
        setLatitude(parseFloat(results[0].lat))
        setLongitude(parseFloat(results[0].lon))
        setLookupResults([])
        setShowMap(true)
      } else {
        setLookupResults(results)
      }
    } catch (_err) {
      setError('Failed to lookup address. Try placing on map manually.')
      setShowMap(true)
    } finally {
      setLookupLoading(false)
    }
  }

  const selectResult = (result: GeoResult) => {
    setLatitude(parseFloat(result.lat))
    setLongitude(parseFloat(result.lon))
    setLookupResults([])
    setShowMap(true)
  }

  const handleMapClick = (lat: number, lng: number) => {
    setLatitude(lat)
    setLongitude(lng)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

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
          value_rating: valueRating ? parseInt(valueRating) : null,
          taste_rating: tasteRating ? parseInt(tasteRating) : null,
          comment: comment || null,
          organisation_id: organisationId || null,
        })

        if (reviewError) throw reviewError
      }

      // Reset form
      setName('')
      setCuisine('')
      setCategories([])
      setSearchQuery('')
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

  const clearLocation = () => {
    setLatitude(null)
    setLongitude(null)
    setShowMap(false)
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
                <div className="modal-form-row">
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Restaurant name"
                      style={{ width: '100%' }}
                    />
                  </div>
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

                {/* Location section */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Location
                  </label>

                  {/* Search bar */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or address..."
                      style={{ flex: 1 }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookup())}
                    />
                    <button
                      type="button"
                      onClick={handleLookup}
                      disabled={lookupLoading || !searchQuery.trim()}
                      className="btn"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {lookupLoading ? '...' : 'Search'}
                    </button>
                  </div>

                  {/* Search results dropdown */}
                  {lookupResults.length > 0 && (
                    <div style={{ marginBottom: '12px', border: '1px solid var(--border)', background: 'var(--bg)', maxHeight: '150px', overflowY: 'auto' }}>
                      {lookupResults.map((result, i) => (
                        <button
                          key={i}
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
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.4
                          }}
                        >
                          {result.display_name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Map for placing/confirming location */}
                  {(showMap || latitude !== null) && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ height: '200px', border: '1px solid var(--border)', marginBottom: '8px' }}>
                        <MapContainer
                          center={[latitude || 51.5047, longitude || -0.0886]}
                          zoom={16}
                          scrollWheelZoom={true}
                          style={{ height: '100%', width: '100%' }}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
                        Click on the map to {latitude ? 'adjust' : 'set'} location
                      </p>
                    </div>
                  )}

                  {/* Show coordinates or prompt */}
                  {latitude !== null && longitude !== null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {latitude.toFixed(6)}, {longitude.toFixed(6)}
                      </span>
                      <button
                        type="button"
                        onClick={clearLocation}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)' }}
                      >
                        Clear
                      </button>
                    </div>
                  ) : !showMap && (
                    <button
                      type="button"
                      onClick={() => setShowMap(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)', padding: 0 }}
                    >
                      Or place on map manually
                    </button>
                  )}
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
