import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface AddReviewProps {
  userId: string
  onAdded: () => void
}

interface GeoResult {
  lat: string
  lon: string
  display_name: string
}

export function AddReview({ userId, onAdded }: AddReviewProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [notes, setNotes] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [rating, setRating] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResults, setLookupResults] = useState<GeoResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleLookup = async () => {
    if (!address.trim()) return

    setLookupLoading(true)
    setLookupResults([])

    try {
      // Search near London Bridge for better local results
      const query = encodeURIComponent(address + ', London Bridge, London, UK')
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&addressdetails=1`,
        { headers: { 'User-Agent': 'FoodReviewApp/1.0' } }
      )

      if (!response.ok) throw new Error('Lookup failed')

      const results: GeoResult[] = await response.json()

      if (results.length === 0) {
        setError('No results found. Try a different search.')
      } else if (results.length === 1) {
        // Auto-select if only one result
        setLatitude(results[0].lat)
        setLongitude(results[0].lon)
        setLookupResults([])
      } else {
        setLookupResults(results)
      }
    } catch (err) {
      setError('Failed to lookup address')
    } finally {
      setLookupLoading(false)
    }
  }

  const selectResult = (result: GeoResult) => {
    setLatitude(result.lat)
    setLongitude(result.lon)
    setLookupResults([])
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
          type,
          notes: notes || null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
        })
        .select()
        .single()

      if (restaurantError) throw restaurantError

      if (rating) {
        const { error: reviewError } = await supabase.from('reviews').insert({
          restaurant_id: restaurant.id,
          user_id: userId,
          rating: parseInt(rating),
          comment: comment || null,
        })

        if (reviewError) throw reviewError
      }

      setName('')
      setType('')
      setNotes('')
      setAddress('')
      setLatitude('')
      setLongitude('')
      setRating('')
      setComment('')
      setLookupResults([])
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
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
              <div style={{ display: 'grid', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
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
                      Type *
                    </label>
                    <input
                      type="text"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      required
                      placeholder="Thai, Sandwich, etc."
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Any notes about this place..."
                    style={{ width: '100%', resize: 'none' }}
                  />
                </div>

                {/* Location lookup */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Location
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Search address or place name..."
                      style={{ flex: 1 }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookup())}
                    />
                    <button
                      type="button"
                      onClick={handleLookup}
                      disabled={lookupLoading || !address.trim()}
                      className="btn"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {lookupLoading ? 'Looking up...' : 'Lookup'}
                    </button>
                  </div>

                  {/* Lookup results */}
                  {lookupResults.length > 0 && (
                    <div style={{ marginTop: '12px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                      {lookupResults.map((result, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectResult(result)}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '12px',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            borderBottom: i < lookupResults.length - 1 ? '1px solid var(--border)' : 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {result.display_name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Show selected coordinates */}
                  {latitude && longitude && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setLatitude(''); setLongitude('') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)' }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '8px' }}>
                  <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Your Review (optional)
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Rating
                      </label>
                      <select
                        value={rating}
                        onChange={(e) => setRating(e.target.value)}
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
                </div>

                {error && (
                  <p style={{ color: 'var(--poor)', fontSize: '14px' }}>
                    {error}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '8px' }}>
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
