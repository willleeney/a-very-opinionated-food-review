import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { RestaurantWithReviews, Organisation, OrganisationWithMembership, OfficeLocation, RestaurantCategory } from '../lib/database.types'
import { distanceFrom, formatDistance } from '../lib/distance'
import { MapView } from './MapView'
import { RatingHistogram } from './RatingHistogram'
import { AddReview } from './AddReview'
import { BurgerMenu } from './BurgerMenu'
import { FilterBar } from './FilterBar'
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

// Inline review form component - simplified, visibility is derived from org membership
function InlineReviewForm({
  restaurantId,
  userId,
  existingReview,
  onSaved
}: {
  restaurantId: string
  userId: string
  existingReview?: { id: string; rating: number | null; value_rating: number | null; taste_rating: number | null; comment: string | null }
  onSaved: () => void
}) {
  const [overallRating, setOverallRating] = useState(existingReview?.rating?.toString() || '')
  const [valueRating, setValueRating] = useState(existingReview?.value_rating?.toString() || '')
  const [tasteRating, setTasteRating] = useState(existingReview?.taste_rating?.toString() || '')
  const [comment, setComment] = useState(existingReview?.comment || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!overallRating) return

    setSaving(true)
    setError(null)

    try {
      const reviewData = {
        rating: parseInt(overallRating),
        value_rating: valueRating ? parseInt(valueRating) : null,
        taste_rating: tasteRating ? parseInt(tasteRating) : null,
        comment: comment || null,
      }

      if (existingReview) {
        // Update existing review
        const { error } = await supabase
          .from('reviews')
          .update(reviewData)
          .eq('id', existingReview.id)
        if (error) throw error
      } else {
        // Insert new review
        const { error } = await supabase
          .from('reviews')
          .insert({
            restaurant_id: restaurantId,
            user_id: userId,
            ...reviewData,
          })
        if (error) throw error
      }

      onSaved()
    } catch (err) {
      console.error('Review save error:', err)
      const message = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to save review'
      setError(message)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Overall*</span>
          <select
            value={overallRating}
            onChange={(e) => setOverallRating(e.target.value)}
            required
            style={{ width: '70px' }}
          >
            <option value="">—</option>
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Value</span>
          <select
            value={valueRating}
            onChange={(e) => setValueRating(e.target.value)}
            style={{ width: '70px' }}
          >
            <option value="">—</option>
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Taste</span>
          <select
            value={tasteRating}
            onChange={(e) => setTasteRating(e.target.value)}
            style={{ width: '70px' }}
          >
            <option value="">—</option>
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comment (optional)"
          style={{ flex: 1, maxWidth: '300px' }}
        />
        <button type="submit" disabled={saving || !overallRating} className="btn btn-accent" style={{ padding: '8px 16px' }}>
          {saving ? '...' : existingReview ? 'Update' : 'Save'}
        </button>
        {error && <span style={{ color: 'var(--poor)', fontSize: '12px' }}>{error}</span>}
      </div>
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
  const [currentOrgMemberIds, setCurrentOrgMemberIds] = useState<Set<string>>(new Set())
  const [userOrgs, setUserOrgs] = useState<OrganisationWithMembership[]>([])
  const [_userOrgIds, setUserOrgIds] = useState<Set<string>>(new Set())
  const [_isAdmin, setIsAdmin] = useState(false)
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null)

  const {
    selectedCategories,
    minOverallRating,
    minValueRating,
    minTasteRating,
    socialFilter,
    selectedUserId,
    highlightedRestaurantId: _highlightedRestaurantId,
    setHighlightedRestaurantId,
  } = useFilterStore()

  // Following state
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [followingUsers, setFollowingUsers] = useState<{ id: string; name: string }[]>([])
  const [orgMembers, setOrgMembers] = useState<{ id: string; name: string }[]>([])
  const [orgMembersByOrgId, setOrgMembersByOrgId] = useState<Map<string, Set<string>>>(new Map())

  // Fetch user's following list with names
  const fetchFollowing = useCallback(async (userId: string) => {
    const { data: follows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)

    if (follows && follows.length > 0) {
      setFollowingIds(new Set(follows.map(f => f.following_id)))

      // Fetch profile names for followed users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', follows.map(f => f.following_id))

      if (profiles) {
        setFollowingUsers(profiles.map(p => ({
          id: p.id,
          name: p.display_name || p.id.slice(0, 8)
        })))
      }
    } else {
      setFollowingIds(new Set())
      setFollowingUsers([])
    }
  }, [])

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
      setOrgMembers([])
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

      // Fetch all members of user's orgs with their names and org mapping
      const { data: allMembers } = await supabase
        .from('organisation_members')
        .select('user_id, organisation_id')
        .in('organisation_id', orgIds)

      if (allMembers && allMembers.length > 0) {
        // Build org -> members map
        const membersByOrg = new Map<string, Set<string>>()
        for (const m of allMembers) {
          if (!membersByOrg.has(m.organisation_id)) {
            membersByOrg.set(m.organisation_id, new Set())
          }
          membersByOrg.get(m.organisation_id)!.add(m.user_id)
        }
        setOrgMembersByOrgId(membersByOrg)

        // Get unique member IDs (excluding self) for the search dropdown
        const memberIds = [...new Set(allMembers.filter(m => m.user_id !== userId).map(m => m.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', memberIds)

        if (profiles) {
          setOrgMembers(profiles.map(p => ({
            id: p.id,
            name: p.display_name || p.id.slice(0, 8)
          })))
        }
      } else {
        setOrgMembers([])
      }
    }
  }, [organisationSlug])

  const fetchData = useCallback(async (currentUserId?: string | null) => {
    // Fetch current organisation if slug is provided
    let office: OfficeLocation | null = null
    let visibleReviewerIds = new Set<string>()

    if (organisationSlug) {
      // Org view: show reviews from members of this specific org
      const { data: orgData } = await supabase
        .from('organisations')
        .select('*')
        .eq('slug', organisationSlug)
        .single()

      if (orgData) {
        setCurrentOrg(orgData)
        office = orgData.office_location as OfficeLocation | null
        setOfficeLocation(office)

        // Fetch members of this org - their reviews will be visible
        const { data: members } = await supabase
          .from('organisation_members')
          .select('user_id')
          .eq('organisation_id', orgData.id)

        if (members) {
          visibleReviewerIds = new Set(members.map(m => m.user_id))
        }
      }
    } else {
      // Global view - show reviews from all orgs the user is a member of
      setCurrentOrg(null)
      setOfficeLocation(null)

      if (currentUserId) {
        // Get all orgs the user is in
        const { data: userMemberships } = await supabase
          .from('organisation_members')
          .select('organisation_id')
          .eq('user_id', currentUserId)

        if (userMemberships && userMemberships.length > 0) {
          const userOrgIdsList = userMemberships.map(m => m.organisation_id)

          // Get all members of those orgs
          const { data: allOrgMembers } = await supabase
            .from('organisation_members')
            .select('user_id')
            .in('organisation_id', userOrgIdsList)

          if (allOrgMembers) {
            visibleReviewerIds = new Set(allOrgMembers.map(m => m.user_id))
          }
        }
      }
    }
    setCurrentOrgMemberIds(visibleReviewerIds)

    // Fetch all restaurants (global)
    const { data: restaurantsData } = await supabase
      .from('restaurants')
      .select('*, reviews(*)')
      .order('name')

    if (restaurantsData) {
      const withCalculations = restaurantsData.map((r) => {
        // Mark each review with whether the reviewer is an org member (for visibility)
        const reviews = (r.reviews || []).map(rev => ({
          ...rev,
          isOrgMember: rev.user_id ? visibleReviewerIds.has(rev.user_id) : false
        }))

        // Calculate legacy average rating
        const ratings = reviews
          .filter((rev) => rev.rating !== null)
          .map((rev) => rev.rating as number)
        const avgRating = ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null

        // Calculate dual ratings
        const valueRatings = reviews
          .filter((rev) => rev.value_rating !== null && rev.value_rating !== undefined)
          .map((rev) => rev.value_rating as number)
        const avgValueRating = valueRatings.length > 0
          ? valueRatings.reduce((a, b) => a + b, 0) / valueRatings.length
          : null

        const tasteRatings = reviews
          .filter((rev) => rev.taste_rating !== null && rev.taste_rating !== undefined)
          .map((rev) => rev.taste_rating as number)
        const avgTasteRating = tasteRatings.length > 0
          ? tasteRatings.reduce((a, b) => a + b, 0) / tasteRatings.length
          : null

        // Only calculate distance if we have an office location
        const distance = office
          ? distanceFrom(office.lat, office.lng, r.latitude, r.longitude)
          : null

        return {
          ...r,
          reviews,
          avgRating,
          avgValueRating,
          avgTasteRating,
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
    let isMounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return
      setUser(data.user)
      if (data.user) {
        fetchUserOrgs(data.user.id)
        fetchFollowing(data.user.id)
      }
      // Fetch data after auth check completes (whether logged in or not)
      fetchData(data.user?.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return
      // Only handle sign in/out events, not initial session
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchUserOrgs(session.user.id)
          fetchFollowing(session.user.id)
          fetchData(session.user.id)
        } else {
          setUserOrgs([])
          setUserOrgIds(new Set())
          setIsAdmin(false)
          setFollowingIds(new Set())
          fetchData(null)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchData, fetchUserOrgs, fetchFollowing])

  // Filter restaurants
  const filteredRestaurants = restaurants.filter(r => {
    // Category filter
    if (selectedCategories.length > 0) {
      const restaurantCategories = (r.categories || []) as RestaurantCategory[]
      const hasMatchingCategory = selectedCategories.some(cat => restaurantCategories.includes(cat))
      if (!hasMatchingCategory) return false
    }

    // Overall rating filter
    if (minOverallRating !== null && r.avgRating !== null) {
      if (r.avgRating < minOverallRating) return false
    }

    // Value rating filter
    if (minValueRating !== null && r.avgValueRating !== null) {
      if (r.avgValueRating < minValueRating) return false
    }

    // Taste rating filter
    if (minTasteRating !== null && r.avgTasteRating !== null) {
      if (r.avgTasteRating < minTasteRating) return false
    }

    // Specific user filter (from search)
    if (selectedUserId) {
      if (!r.reviews.some(rev => rev.user_id === selectedUserId)) return false
    }
    // Social filter (only apply if no specific user selected)
    else if (socialFilter !== 'everyone' && user) {
      if (socialFilter === 'just_me') {
        // Only show restaurants I've reviewed
        if (!r.reviews.some(rev => rev.user_id === user.id)) return false
      } else if (socialFilter === 'following') {
        // Only show restaurants reviewed by people I follow
        if (!r.reviews.some(rev => rev.user_id && followingIds.has(rev.user_id))) return false
      } else {
        // Filter by organisation slug
        const org = userOrgs.find(o => o.slug === socialFilter)
        if (org) {
          // Only show restaurants reviewed by members of this org
          const orgMemberIds = orgMembersByOrgId.get(org.id)
          if (orgMemberIds) {
            if (!r.reviews.some(rev => rev.user_id && orgMemberIds.has(rev.user_id))) return false
          } else {
            return false // No members found for this org
          }
        }
      }
    }

    return true
  }).sort((a, b) => {
    // Sort by average taste rating (primary) then value rating
    const aRating = a.avgTasteRating ?? a.avgRating ?? 0
    const bRating = b.avgTasteRating ?? b.avgRating ?? 0
    if (aRating === 0 && bRating === 0) return 0
    if (aRating === 0) return 1
    if (bRating === 0) return -1
    return bRating - aRating
  })

  // Determine active office location (from current org OR from social filter org)
  const activeOrg = socialFilter !== 'everyone' && socialFilter !== 'following' && socialFilter !== 'just_me'
    ? userOrgs.find(o => o.slug === socialFilter)
    : null
  const activeOfficeLocation = currentOrg?.office_location as OfficeLocation | null
    || (activeOrg?.office_location as OfficeLocation | null)
    || officeLocation
  const activeOrgName = currentOrg?.name || activeOrg?.name || null
  const showOffice = !!currentOrg || !!activeOrg

  const restaurantsWithRatings = restaurants.filter(r => r.avgRating !== null)
  const totalReviews = restaurants.reduce((sum, r) => sum + r.reviews.length, 0)
  const stats = {
    total: restaurants.length,
    reviews: totalReviews,
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
  // Visibility is derived from org membership:
  // - Org view: reviewer must be a member of the current org
  // - Global view: reviewer must be in any org the viewer is also in
  const isCommentVisible = (isOrgMember: boolean): boolean => {
    // The isOrgMember flag is computed during data fetch
    // It's true if the reviewer is in the visible set (current org or any shared org)
    return isOrgMember
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
            <div style={{ flex: 1 }} />
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
          <span><strong style={{ color: 'var(--text)', fontWeight: 500 }}>{stats.reviews}</strong> reviews</span>
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
            officeLocation={activeOfficeLocation}
            showOfficeMarker={showOffice}
            orgName={activeOrgName}
            isSignedIn={!!user}
          />
        </div>
      </section>

      {/* Filters and Add Place */}
      <div className="container">
        <FilterBar
          userOrgs={userOrgs}
          isSignedIn={!!user}
          searchableUsers={[
            ...followingUsers.map(u => ({ id: u.id, name: u.name, source: 'following' as const })),
            ...orgMembers.filter(m => !followingUsers.some(f => f.id === m.id)).map(u => ({ id: u.id, name: u.name, source: 'org_member' as const }))
          ]}
          rightActions={
            user && (
              <AddReview
                userId={user.id}
                organisationId={currentOrg?.id}
                onAdded={fetchData}
              />
            )
          }
        />
      </div>

      {/* Histogram - below filters */}
      <section style={{ paddingBottom: '40px' }}>
        <div className="container">
          <RatingHistogram restaurants={filteredRestaurants} />
        </div>
      </section>

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
                      {restaurant.cuisine}
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
                            color: 'var(--accent)',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="View on map"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === restaurant.id && (
                    <tr key={`${restaurant.id}-expanded`}>
                      <td colSpan={officeLocation ? 6 : 5} style={{ background: 'var(--bg-warm)', padding: '24px' }}>
                        {restaurant.reviews.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {restaurant.reviews.map((review) => {
                              const reviewer = users.find(u => u.id === review.user_id)
                              const showComment = isCommentVisible(review.isOrgMember ?? false)
                              return (
                                <div key={review.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                  <span className={`mono ${getRatingClass(review.rating || 0)}`} style={{ fontSize: '14px', minWidth: '50px' }}>
                                    {review.rating}/10
                                  </span>
                                  {(review.value_rating || review.taste_rating) && (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                      {review.value_rating && `Value: ${review.value_rating}/10`}
                                      {review.value_rating && review.taste_rating && ' · '}
                                      {review.taste_rating && `Taste: ${review.taste_rating}/10`}
                                    </span>
                                  )}
                                  {showComment && (
                                    <>
                                      <span style={{ color: 'var(--text-muted)', fontSize: '13px', minWidth: '80px' }}>
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
                            existingReview={restaurant.reviews.find(r => r.user_id === user.id) as { id: string; rating: number | null; value_rating: number | null; taste_rating: number | null; comment: string | null } | undefined}
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
