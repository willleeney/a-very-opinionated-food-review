import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { RestaurantWithReviews, Organisation, OrganisationWithMembership, OfficeLocation } from '../lib/database.types'
import { distanceFrom, formatDistance } from '../lib/distance'
import { MapView } from './MapView'
import { RatingHistogram } from './RatingHistogram'
import { AddReview } from './AddReview'
import { BurgerMenu } from './BurgerMenu'
import { OrganisationSelector } from './OrganisationSelector'
import { useFilterStore } from '../lib/store'
import type { User } from '@supabase/supabase-js'

interface DashboardProps {
  organisationSlug?: string | null
}

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

// Inline review form component
function InlineReviewForm({
  restaurantId,
  userId,
  userOrgs,
  existingReview,
  onSaved
}: {
  restaurantId: string
  userId: string
  userOrgs: OrganisationWithMembership[]
  existingReview?: { id: string; rating: number | null; comment: string | null; visibleToOrgs?: string[] }
  onSaved: () => void
}) {
  const [rating, setRating] = useState(existingReview?.rating?.toString() || '')
  const [comment, setComment] = useState(existingReview?.comment || '')
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set(existingReview?.visibleToOrgs || (userOrgs.length > 0 ? [userOrgs[0].id] : [])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleOrg = (orgId: string) => {
    const newSet = new Set(selectedOrgs)
    if (newSet.has(orgId)) {
      newSet.delete(orgId)
    } else {
      newSet.add(orgId)
    }
    setSelectedOrgs(newSet)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return

    setSaving(true)
    setError(null)

    try {
      let reviewId: string

      if (existingReview) {
        // Update existing review
        const { error } = await supabase
          .from('reviews')
          .update({ rating: parseInt(rating), comment: comment || null })
          .eq('id', existingReview.id)
        if (error) throw error
        reviewId = existingReview.id

        // Delete existing visibility entries
        await supabase
          .from('review_visibility')
          .delete()
          .eq('review_id', reviewId)
      } else {
        // Insert new review
        const { data, error } = await supabase
          .from('reviews')
          .insert({
            restaurant_id: restaurantId,
            user_id: userId,
            rating: parseInt(rating),
            comment: comment || null,
          })
          .select('id')
          .single()
        if (error) throw error
        reviewId = data.id
      }

      // Insert visibility entries for selected orgs
      if (selectedOrgs.size > 0) {
        const visibilityEntries = Array.from(selectedOrgs).map(orgId => ({
          review_id: reviewId,
          organisation_id: orgId,
        }))
        const { error: visError } = await supabase
          .from('review_visibility')
          .insert(visibilityEntries)
        if (visError) throw visError
      }

      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
      </div>
      {userOrgs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Visible to
          </span>
          {userOrgs.map((org) => (
            <label key={org.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={selectedOrgs.has(org.id)}
                onChange={() => toggleOrg(org.id)}
                style={{ cursor: 'pointer' }}
              />
              {org.name}
            </label>
          ))}
        </div>
      )}
    </form>
  )
}

export function Dashboard({ organisationSlug }: DashboardProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [restaurants, setRestaurants] = useState<RestaurantWithReviews[]>([])
  const [users, setUsers] = useState<ReviewUser[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Organisation state
  const [currentOrg, setCurrentOrg] = useState<Organisation | null>(null)
  const [userOrgs, setUserOrgs] = useState<OrganisationWithMembership[]>([])
  const [userOrgIds, setUserOrgIds] = useState<Set<string>>(new Set())
  const [_isAdmin, setIsAdmin] = useState(false)
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null)

  const {
    selectedUserId,
    setSelectedUserId,
    highlightedRestaurantId: _highlightedRestaurantId,
    setHighlightedRestaurantId,
    clearFilters
  } = useFilterStore()

  // Fetch user's organisations
  const fetchUserOrgs = useCallback(async (userId: string) => {
    // First get memberships
    const { data: memberships, error: memberError } = await supabase
      .from('organisation_members')
      .select('organisation_id, role')
      .eq('user_id', userId)

    if (memberError || !memberships || memberships.length === 0) {
      setUserOrgs([])
      setUserOrgIds(new Set())
      setIsAdmin(false)
      return
    }

    // Then fetch the organisations
    const orgIds = memberships.map(m => m.organisation_id)
    const { data: orgsData } = await supabase
      .from('organisations')
      .select('*')
      .in('id', orgIds)

    if (orgsData) {
      const orgs: OrganisationWithMembership[] = orgsData.map((org) => {
        const membership = memberships.find(m => m.organisation_id === org.id)
        return {
          ...org,
          role: (membership?.role || 'member') as 'admin' | 'member',
        }
      })
      setUserOrgs(orgs)
      setUserOrgIds(new Set(orgs.map(o => o.id)))

      // Check if user is admin of current org
      if (organisationSlug) {
        const currentOrgMembership = orgs.find(o => o.slug === organisationSlug)
        setIsAdmin(currentOrgMembership?.role === 'admin')
      }
    }
  }, [organisationSlug])

  const fetchData = useCallback(async () => {
    // Fetch current organisation if slug is provided
    let office: OfficeLocation | null = null

    if (organisationSlug) {
      const { data: orgData } = await supabase
        .from('organisations')
        .select('*')
        .eq('slug', organisationSlug)
        .single()

      if (orgData) {
        setCurrentOrg(orgData)
        office = orgData.office_location as OfficeLocation | null
        setOfficeLocation(office)
      }
    } else {
      // Global view - no office location
      setCurrentOrg(null)
      setOfficeLocation(null)
    }

    // Fetch all restaurants (global)
    const { data: restaurantsData } = await supabase
      .from('restaurants')
      .select('*, reviews(*)')
      .order('name')

    if (restaurantsData) {
      // Collect all review IDs to fetch visibility data
      const reviewIds: string[] = []
      for (const r of restaurantsData) {
        for (const rev of r.reviews || []) {
          reviewIds.push(rev.id)
        }
      }

      // Fetch visibility data for all reviews
      let visibilityMap: Record<string, string[]> = {}
      if (reviewIds.length > 0) {
        const { data: visibilityData } = await supabase
          .from('review_visibility')
          .select('review_id, organisation_id')
          .in('review_id', reviewIds)

        if (visibilityData) {
          for (const v of visibilityData) {
            if (!visibilityMap[v.review_id]) {
              visibilityMap[v.review_id] = []
            }
            visibilityMap[v.review_id].push(v.organisation_id)
          }
        }
      }

      const withCalculations = restaurantsData.map((r) => {
        const reviews = (r.reviews || []).map(rev => ({
          ...rev,
          visibleToOrgs: visibilityMap[rev.id] || []
        }))
        const ratings = reviews
          .filter((rev) => rev.rating !== null)
          .map((rev) => rev.rating as number)
        const avgRating = ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null

        // Only calculate distance if we have an office location
        const distance = office
          ? distanceFrom(office.lat, office.lng, r.latitude, r.longitude)
          : null

        return {
          ...r,
          reviews,
          avgRating,
          distance,
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
  }, [organisationSlug])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        fetchUserOrgs(data.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserOrgs(session.user.id)
      } else {
        setUserOrgs([])
        setUserOrgIds(new Set())
        setIsAdmin(false)
      }
    })

    fetchData()

    return () => subscription.unsubscribe()
  }, [fetchData, fetchUserOrgs])

  // Filter restaurants
  const filteredRestaurants = restaurants.filter(r => {
    if (!selectedUserId) return true
    return r.reviews.some(rev => rev.user_id === selectedUserId)
  }).sort((a, b) => {
    if (a.avgRating === null && b.avgRating === null) return 0
    if (a.avgRating === null) return 1
    if (b.avgRating === null) return -1
    return b.avgRating - a.avgRating
  })

  const restaurantsWithRatings = restaurants.filter(r => r.avgRating !== null)
  const stats = {
    total: restaurants.length,
    reviewed: restaurantsWithRatings.length,
    avgRating: restaurantsWithRatings.length > 0
      ? restaurantsWithRatings.reduce((sum, r) => sum + (r.avgRating || 0), 0) / restaurantsWithRatings.length
      : 0,
    topRated: restaurantsWithRatings.filter(r => r.avgRating! >= 8).length,
  }

  const handleRowClick = (restaurant: RestaurantWithReviews) => {
    if (!user) return
    setExpandedId(expandedId === restaurant.id ? null : restaurant.id)
  }

  const handleMapClick = (e: React.MouseEvent, restaurant: RestaurantWithReviews) => {
    e.stopPropagation()
    setHighlightedRestaurantId(restaurant.id)
    document.querySelector('.map-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Check if a review's comment should be visible
  const isCommentVisible = (visibleToOrgs: string[] | undefined): boolean => {
    // Comments are only visible if the review is shared with an org the user is a member of
    if (!visibleToOrgs || visibleToOrgs.length === 0) return false
    return visibleToOrgs.some(orgId => userOrgIds.has(orgId))
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  // Determine hero text based on view mode
  const heroSubtitle = currentOrg
    ? `${currentOrg.name} · ${(currentOrg.tagline || '').replace(/, /g, ' · ')}`
    : null

  const heroDescription = 'opinionated takes. taste encouraged but not necessarily welcome.'

  return (
    <div>
      {/* Navigation */}
      <nav>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              {userOrgs.length > 0 ? (
                <OrganisationSelector currentOrgSlug={organisationSlug} userOrgs={userOrgs} />
              ) : (
                <div style={{ width: '80px' }} />
              )}
            </div>
            <a href="/" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', fontWeight: 500, letterSpacing: '0.02em' }}>
              Tastefull
            </a>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
              {user ? (
                <>
                  <span className="mono hide-mobile" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {user.email}
                  </span>
                  <BurgerMenu
                    user={user}
                    currentOrgSlug={organisationSlug}
                    userOrgs={userOrgs}
                  />
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
          {heroSubtitle && (
            <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {heroSubtitle}
            </p>
          )}
          <h1>
            Curate<br />Taste.
          </h1>
          <p style={{ maxWidth: '400px', color: 'var(--text-secondary)', marginTop: '24px', fontSize: '17px', lineHeight: 1.7 }}>
            {heroDescription}
          </p>
        </div>
      </section>

      {/* Stats - compact inline */}
      <div className="container" style={{ paddingTop: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        <div className="stats-row" style={{ display: 'flex', gap: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>
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
          <MapView
            restaurants={filteredRestaurants}
            onLocationUpdated={fetchData}
            officeLocation={officeLocation}
            showOfficeMarker={!!currentOrg}
          />
        </div>
      </section>

      {/* Histogram - below map */}
      <section style={{ paddingBottom: '40px' }}>
        <div className="container">
          <RatingHistogram restaurants={filteredRestaurants} />
        </div>
      </section>

      {/* Filters - only show on org pages */}
      {currentOrg && (
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
            {user && currentOrg && (
              <AddReview
                userId={user.id}
                organisationId={currentOrg.id}
                onAdded={fetchData}
              />
            )}
          </div>
          </div>
        </div>
      )}

      {/* Restaurant List */}
      <section style={{ padding: '40px 0 80px' }}>
        <div className="container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th className="hide-mobile">Type</th>
                {officeLocation && <th className="hide-mobile">Distance</th>}
                <th>Rating</th>
                <th></th>
                <th className="hide-mobile"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRestaurants.map((restaurant) => (
                <>
                  <tr
                    key={restaurant.id}
                    onClick={() => handleRowClick(restaurant)}
                    style={{
                      cursor: user ? 'pointer' : 'default',
                      background: expandedId === restaurant.id ? 'var(--bg-warm)' : undefined
                    }}
                  >
                    <td>
                      <strong style={{ fontWeight: 500 }}>{restaurant.name}</strong>
                    </td>
                    <td className="hide-mobile" style={{ color: 'var(--text-secondary)' }}>
                      {restaurant.type}
                    </td>
                    {officeLocation && (
                      <td className="mono hide-mobile" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        {formatDistance(restaurant.distance)}
                      </td>
                    )}
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
                    <td className="hide-mobile" style={{ textAlign: 'right' }}>
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
                      <td colSpan={officeLocation ? 6 : 5} style={{ background: 'var(--bg-warm)', padding: '24px' }}>
                        {restaurant.notes && (
                          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '16px' }}>
                            "{restaurant.notes}"
                          </p>
                        )}
                        {restaurant.reviews.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {restaurant.reviews.map((review) => {
                              const reviewer = users.find(u => u.id === review.user_id)
                              const showComment = isCommentVisible(review.visibleToOrgs)
                              return (
                                <div key={review.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <span className={`mono ${getRatingClass(review.rating || 0)}`} style={{ fontSize: '14px' }}>
                                    {review.rating}/10
                                  </span>
                                  {showComment && (
                                    <>
                                      <span style={{ color: 'var(--text-muted)', fontSize: '13px', minWidth: '60px' }}>
                                        {reviewer?.email || 'Anonymous'}
                                      </span>
                                      {review.comment && (
                                        <span style={{ color: 'var(--text-secondary)' }}>{review.comment}</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p style={{ color: 'var(--text-muted)' }}>No reviews yet</p>
                        )}
                        {user && (
                          <InlineReviewForm
                            restaurantId={restaurant.id}
                            userId={user.id}
                            userOrgs={userOrgs}
                            existingReview={restaurant.reviews.find(r => r.user_id === user.id) as { id: string; rating: number | null; comment: string | null; visibleToOrgs?: string[] } | undefined}
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
