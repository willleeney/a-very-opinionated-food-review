import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { RestaurantWithReviews } from '../lib/database.types'
import { distanceFrom, formatDistance } from '../lib/distance'
import { MapView } from './MapView'
import { RatingHistogram } from './RatingHistogram'
import { AddReview } from './AddReview'
import { useFilterStore } from '../lib/store'
import type { User } from '@supabase/supabase-js'

interface ReviewUser {
  id: string
  email: string
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

// Default office location (fallback if not set in database)
const DEFAULT_OFFICE = { lat: 51.5047, lng: -0.0886 }

// Inline review form component
function InlineReviewForm({
  restaurantId,
  userId,
  existingReview,
  onSaved
}: {
  restaurantId: string
  userId: string
  existingReview?: { id: string; rating: number | null; comment: string | null }
  onSaved: () => void
}) {
  const [rating, setRating] = useState(existingReview?.rating?.toString() || '')
  const [comment, setComment] = useState(existingReview?.comment || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return

    setSaving(true)
    setError(null)

    try {
      if (existingReview) {
        // Update existing review
        const { error } = await supabase
          .from('reviews')
          .update({ rating: parseInt(rating), comment: comment || null })
          .eq('id', existingReview.id)
        if (error) throw error
      } else {
        // Insert new review
        const { error } = await supabase
          .from('reviews')
          .insert({
            restaurant_id: restaurantId,
            user_id: userId,
            rating: parseInt(rating),
            comment: comment || null,
          })
        if (error) throw error
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {existingReview ? 'Your review' : 'Add review'}
      </span>
      <select
        value={rating}
        onChange={(e) => setRating(e.target.value)}
        required
        style={{ width: '80px' }}
      >
        <option value="">—</option>
        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
          <option key={r} value={r}>{r}/10</option>
        ))}
      </select>
      <input
        type="text"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment (optional)"
        style={{ flex: 1, maxWidth: '300px' }}
      />
      <button type="submit" disabled={saving || !rating} className="btn btn-accent" style={{ padding: '8px 16px' }}>
        {saving ? '...' : existingReview ? 'Update' : 'Save'}
      </button>
      {error && <span style={{ color: 'var(--poor)', fontSize: '12px' }}>{error}</span>}
    </form>
  )
}

export function Dashboard(): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [restaurants, setRestaurants] = useState<RestaurantWithReviews[]>([])
  const [users, setUsers] = useState<ReviewUser[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [officeLocation, setOfficeLocation] = useState(DEFAULT_OFFICE)

  const {
    selectedUserId,
    setSelectedUserId,
    highlightedRestaurantId,
    setHighlightedRestaurantId,
    clearFilters
  } = useFilterStore()

  const fetchData = useCallback(async () => {
    // Fetch office location from settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'office_location')
      .single()

    const office = settingsData?.value as { lat: number; lng: number } | null
    if (office) {
      setOfficeLocation(office)
    }

    const { data: restaurantsData } = await supabase
      .from('restaurants')
      .select('*, reviews(*)')
      .order('name')

    if (restaurantsData) {
      const officeLat = office?.lat ?? DEFAULT_OFFICE.lat
      const officeLng = office?.lng ?? DEFAULT_OFFICE.lng

      const withCalculations = restaurantsData.map((r) => {
        const reviews = r.reviews || []
        const ratings = reviews
          .filter((rev) => rev.rating !== null)
          .map((rev) => rev.rating as number)
        const avgRating = ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null

        return {
          ...r,
          avgRating,
          distance: distanceFrom(officeLat, officeLng, r.latitude, r.longitude),
        }
      })
      setRestaurants(withCalculations)

      // Fetch profiles to get display names
      const userIds = new Set<string>()
      for (const restaurant of withCalculations) {
        for (const review of restaurant.reviews) {
          if (review.user_id) {
            userIds.add(review.user_id)
          }
        }
      }

      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', Array.from(userIds))

        if (profiles) {
          setUsers(profiles.map(p => ({ id: p.id, email: p.display_name || p.id.slice(0, 8) })))
        }
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    fetchData()

    return () => subscription.unsubscribe()
  }, [fetchData])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  // Filter restaurants
  const filteredRestaurants = restaurants.filter(r => {
    if (selectedUserId && !r.reviews.some(rev => rev.user_id === selectedUserId)) {
      return false
    }
    return true
  }).sort((a, b) => {
    if (a.avgRating === null && b.avgRating === null) return 0
    if (a.avgRating === null) return 1
    if (b.avgRating === null) return -1
    return b.avgRating - a.avgRating
  })

  const stats = {
    total: restaurants.length,
    reviewed: restaurants.filter(r => r.avgRating !== null).length,
    avgRating: restaurants.filter(r => r.avgRating).length > 0
      ? (restaurants.filter(r => r.avgRating).reduce((sum, r) => sum + (r.avgRating || 0), 0) / restaurants.filter(r => r.avgRating).length)
      : 0,
    topRated: restaurants.filter(r => r.avgRating && r.avgRating >= 8).length,
  }

  const handleRowClick = (restaurant: RestaurantWithReviews) => {
    // Toggle expand
    setExpandedId(expandedId === restaurant.id ? null : restaurant.id)
  }

  const handleMapClick = (e: React.MouseEvent, restaurant: RestaurantWithReviews) => {
    e.stopPropagation()
    // Pan to location and open popup
    setHighlightedRestaurantId(restaurant.id)
    // Scroll to map
    document.querySelector('.map-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      {/* Navigation */}
      <nav>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <a href="/" style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Lunch 1201
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              {user ? (
                <>
                  <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {user.email}
                  </span>
                  <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Sign out
                  </button>
                </>
              ) : (
                <a href="/login" className="btn" style={{ padding: '8px 16px' }}>
                  Sign in
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero" style={{ paddingTop: '120px' }}>
        <div className="container">
          <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '16px' }}>
            StackOne · Runway East · London Bridge
          </p>
          <h1>
            settle the<br />
            lunch debate.
          </h1>
          <p style={{ maxWidth: '400px', color: 'var(--text-secondary)', marginTop: '24px', fontSize: '17px', lineHeight: 1.7 }}>
            very opinionated takes on lunch. all takes encouraged but not necessarily welcome.
          </p>
        </div>
      </section>

      {/* Stats - compact inline */}
      <div className="container" style={{ paddingTop: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>
          <span><strong style={{ color: 'var(--text)', fontWeight: 500 }}>{stats.total}</strong> places</span>
          <span><strong style={{ color: 'var(--text)', fontWeight: 500 }}>{stats.reviewed}</strong> reviewed</span>
          <span><strong style={{ color: 'var(--text)', fontWeight: 500 }}>{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}</strong> avg rating</span>
          <span><strong style={{ color: 'var(--great)', fontWeight: 500 }}>{stats.topRated}</strong> top rated</span>
        </div>
      </div>

      {/* Map */}
      <section style={{ padding: '60px 0 40px' }}>
        <div className="container">
          <div style={{ marginBottom: '24px' }}>
            <h2>The Neighbourhood</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              Click a marker for details, or find a place in the list below
            </p>
          </div>
          <MapView restaurants={filteredRestaurants} onLocationUpdated={fetchData} />
        </div>
      </section>

      {/* Histogram - below map */}
      <section style={{ paddingBottom: '40px' }}>
        <div className="container">
          <RatingHistogram restaurants={filteredRestaurants} />
        </div>
      </section>

      {/* Filters */}
      <div className="container">
        <div className="filters">
          <div className="filter-group">
            <span className="filter-label">Reviewer</span>
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
              style={{ minWidth: '120px' }}
            >
              <option value="">All</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </div>

          {selectedUserId && (
            <button
              onClick={clearFilters}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Clear
            </button>
          )}

          <div style={{ marginLeft: 'auto' }}>
            {user && <AddReview userId={user.id} onAdded={fetchData} />}
          </div>
        </div>
      </div>

      {/* Restaurant List */}
      <section style={{ padding: '40px 0 80px' }}>
        <div className="container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Name</th>
                <th style={{ width: '15%' }}>Type</th>
                <th style={{ width: '12%' }}>Distance</th>
                <th style={{ width: '18%' }}>Rating</th>
                <th style={{ width: '10%' }}></th>
                <th style={{ width: '15%' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRestaurants.map((restaurant) => (
                <>
                  <tr
                    key={restaurant.id}
                    onClick={() => handleRowClick(restaurant)}
                    style={{
                      cursor: 'pointer',
                      background: expandedId === restaurant.id ? 'var(--bg-warm)' : undefined
                    }}
                  >
                    <td>
                      <strong style={{ fontWeight: 500 }}>{restaurant.name}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {restaurant.type}
                    </td>
                    <td className="mono" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {formatDistance(restaurant.distance)}
                    </td>
                    <td>
                      {restaurant.avgRating !== null ? (
                        <span className={`rating-badge ${getRatingClass(restaurant.avgRating)}`}>
                          {restaurant.avgRating.toFixed(1)} — {getRatingLabel(restaurant.avgRating)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {restaurant.reviews.length} review{restaurant.reviews.length !== 1 ? 's' : ''}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {restaurant.latitude && restaurant.longitude && (
                        <button
                          onClick={(e) => handleMapClick(e, restaurant)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: 'var(--accent)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}
                        >
                          View on map
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === restaurant.id && (
                    <tr key={`${restaurant.id}-expanded`}>
                      <td colSpan={6} style={{ background: 'var(--bg-warm)', padding: '24px' }}>
                        {restaurant.notes && (
                          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '16px' }}>
                            "{restaurant.notes}"
                          </p>
                        )}
                        {restaurant.reviews.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {restaurant.reviews.map((review) => (
                              <div key={review.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span className={`mono ${review.rating && review.rating >= 8 ? 'rating-great' : review.rating && review.rating >= 6 ? 'rating-good' : 'rating-poor'}`} style={{ fontSize: '14px' }}>
                                  {review.rating}/10
                                </span>
                                {review.comment && (
                                  <span style={{ color: 'var(--text-secondary)' }}>{review.comment}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: 'var(--text-muted)' }}>No reviews yet</p>
                        )}
                        {user && (
                          <InlineReviewForm
                            restaurantId={restaurant.id}
                            userId={user.id}
                            existingReview={restaurant.reviews.find(r => r.user_id === user.id) as { id: string; rating: number | null; comment: string | null } | undefined}
                            onSaved={fetchData}
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {filteredRestaurants.length === 0 && (
            <p style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              No restaurants match the current filters
            </p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '40px 0' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Built with questionable taste
            </p>
            <p className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Rating: 1 (never again) → 10 (perfect)
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
