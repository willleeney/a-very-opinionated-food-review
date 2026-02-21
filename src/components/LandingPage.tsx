import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { MapView } from './MapView'
import { RatingHistogram } from './RatingHistogram'
import { getRatingClass } from '../lib/ratings'
import { useFilterStore } from '../lib/store'
import type { RestaurantWithReviews, Tag, Profile } from '../lib/database.types'

interface ReviewFlat {
  id: string
  rating: number
  comment: string | null
  created_at: string
  user_id: string
  restaurantName: string
  restaurantCuisine: string
  restaurantAvgRating: number | null
  restaurantId: string
  reviewerName: string
  reviewerInitials: string
  tags: Tag[]
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

export function LandingPage(): JSX.Element {
  const [restaurants, setRestaurants] = useState<RestaurantWithReviews[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [reviewTags, setReviewTags] = useState<Record<string, Tag[]>>({})
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchData() {
      const [restResult, profileResult, tagsResult, reviewTagsResult] = await Promise.all([
        supabase.from('restaurants').select('*, reviews(*)'),
        supabase.from('profiles').select('*'),
        supabase.from('tags').select('*'),
        supabase.from('review_tags').select('*, tags(*)')
      ])

      const rawRestaurants = (restResult.data || []) as any[]
      const allProfiles = (profileResult.data || []) as Profile[]
      const allTags = (tagsResult.data || []) as Tag[]
      const allReviewTags = (reviewTagsResult.data || []) as any[]

      const tagMap: Record<string, Tag[]> = {}
      for (const rt of allReviewTags) {
        if (!tagMap[rt.review_id]) tagMap[rt.review_id] = []
        if (rt.tags) tagMap[rt.review_id].push(rt.tags)
      }

      const processed: RestaurantWithReviews[] = rawRestaurants.map(r => {
        const reviews = (r.reviews || []).filter((rev: any) => rev.rating !== null)
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum: number, rev: any) => sum + rev.rating, 0) / reviews.length
          : null
        return { ...r, avgRating, reviews: r.reviews || [] }
      })

      setRestaurants(processed)
      setProfiles(allProfiles)
      setTags(allTags)
      setReviewTags(tagMap)
      setLoading(false)
    }
    fetchData()
  }, [])

  const topRated = useMemo(() => {
    return [...restaurants]
      .filter(r => r.avgRating !== null)
      .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
      .slice(0, 3)
  }, [restaurants])

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {}
    for (const p of profiles) m[p.id] = p
    return m
  }, [profiles])

  const allReviews = useMemo((): ReviewFlat[] => {
    const flat: ReviewFlat[] = []
    for (const r of restaurants) {
      for (const rev of r.reviews) {
        if (rev.rating === null || !rev.comment) continue
        const profile = rev.user_id ? profileMap[rev.user_id] : null
        const name = profile?.display_name || 'Anonymous'
        flat.push({
          id: rev.id,
          rating: rev.rating,
          comment: rev.comment,
          created_at: rev.created_at || '',
          user_id: rev.user_id || '',
          restaurantName: r.name,
          restaurantCuisine: r.cuisine,
          restaurantAvgRating: r.avgRating,
          restaurantId: r.id,
          reviewerName: name,
          reviewerInitials: getInitials(name),
          tags: reviewTags[rev.id] || []
        })
      }
    }
    return flat.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [restaurants, profileMap, reviewTags])

  const reviewsByRestaurant = useMemo(() => {
    const map: Record<string, ReviewFlat[]> = {}
    for (const rev of allReviews) {
      if (!map[rev.restaurantName]) map[rev.restaurantName] = []
      map[rev.restaurantName].push(rev)
    }
    const seen = new Set<string>()
    const result: { name: string; cuisine: string; avgRating: number | null; restaurantId: string; reviews: ReviewFlat[] }[] = []
    for (const rev of allReviews) {
      if (seen.has(rev.restaurantName)) continue
      seen.add(rev.restaurantName)
      result.push({
        name: rev.restaurantName,
        cuisine: rev.restaurantCuisine,
        avgRating: rev.restaurantAvgRating,
        restaurantId: rev.restaurantId,
        reviews: map[rev.restaurantName]
      })
    }
    return result
  }, [allReviews])

  const stats = useMemo(() => {
    const totalPlaces = restaurants.length
    const totalReviews = restaurants.reduce((sum, r) => sum + r.reviews.length, 0)
    const rated = restaurants.filter(r => r.avgRating !== null)
    const avgOfAvgs = rated.length > 0
      ? rated.reduce((sum, r) => sum + (r.avgRating || 0), 0) / rated.length
      : 0
    const topRatedCount = rated.filter(r => (r.avgRating || 0) >= 8).length
    return { totalPlaces, totalReviews, avgOfAvgs, topRatedCount }
  }, [restaurants])

  const uniqueReviewers = useMemo(() => {
    const ids = new Set<string>()
    for (const r of restaurants) {
      for (const rev of r.reviews) {
        if (rev.user_id) ids.add(rev.user_id)
      }
    }
    return ids.size
  }, [restaurants])

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const reviewId in reviewTags) {
      for (const tag of reviewTags[reviewId]) {
        counts[tag.id] = (counts[tag.id] || 0) + 1
      }
    }
    return tags
      .map(t => ({ tag: t, count: counts[t.id] || 0 }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [tags, reviewTags])

  const avatarInitials = useMemo(() => {
    const seen = new Set<string>()
    const initials: string[] = []
    for (const rev of allReviews) {
      if (seen.has(rev.user_id) || rev.reviewerName === 'Anonymous') continue
      seen.add(rev.user_id)
      initials.push(rev.reviewerInitials)
      if (initials.length >= 4) break
    }
    return initials
  }, [allReviews])

  const topRatedQuotes = useMemo(() => {
    const map: Record<string, ReviewFlat> = {}
    for (const r of topRated) {
      const revs = allReviews.filter(rv => rv.restaurantName === r.name)
      const best = revs.sort((a, b) => b.rating - a.rating)[0]
      if (best) map[r.id] = best
    }
    return map
  }, [topRated, allReviews])

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const visibleRestaurantReviews = reviewsByRestaurant.slice(0, 2)
  const blurredRestaurantReviews = reviewsByRestaurant.slice(2, 5)

  // Click a review → scroll to map and highlight the restaurant marker
  const handleReviewClick = (restaurantId: string) => {
    const { setHighlightedRestaurantId } = useFilterStore.getState()
    setHighlightedRestaurantId(restaurantId)
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      {/* Nav */}
      <nav className="top-nav">
        <div className="container">
          <div className="top-nav-inner">
            <a href="/" className="top-nav-logo">Tastefull</a>
            <a href="/login" className="top-nav-link">
              <svg className="top-nav-icon" viewBox="0 0 24 24">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span className="top-nav-label">Sign in</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div style={{ height: '60px' }} />

      {/* 1. Split Hero */}
      <section className="landing-hero">
        <div>
          <h1>Your team's lunch guide to London Bridge</h1>
          <p className="landing-tagline">
            Honest, opinionated reviews from the people you eat with. No ads, no algorithms &mdash; just real takes on the neighbourhood.
          </p>
          <div className="landing-social-proof">
            <div className="avatar-stack">
              {avatarInitials.map((init, i) => (
                <div key={i} className="avatar-circle">{init}</div>
              ))}
              {uniqueReviewers > 4 && (
                <div className="avatar-circle avatar-count">+{uniqueReviewers - 4}</div>
              )}
            </div>
            <span className="landing-social-text">
              <strong>{uniqueReviewers} reviewers</strong> have reviewed <strong>{stats.totalPlaces} places</strong>
            </span>
          </div>
          <div className="landing-ctas">
            <a href="/login" className="btn btn-accent">Sign up to explore</a>
          </div>
        </div>

        <div className="landing-hero-cards">
          <span className="landing-top-label">Top Rated &mdash; {currentMonth}</span>
          {topRated.map((r, i) => {
            const quote = topRatedQuotes[r.id]
            return (
              <div key={r.id} className="landing-preview-card" onClick={() => handleReviewClick(r.id)}>
                <span className="rank">{String(i + 1).padStart(2, '0')}</span>
                <div className="card-info">
                  <div className="card-name">{r.name}</div>
                  <div className="card-cuisine">{r.cuisine}</div>
                  {quote && (
                    <>
                      <div className="card-quote">"{quote.comment}"</div>
                      <div className="card-meta">{quote.reviewerName}</div>
                    </>
                  )}
                  {quote && quote.tags.length > 0 && (
                    <div className="card-tags">
                      {quote.tags.slice(0, 2).map(tag => (
                        <span key={tag.id} className="tag-mini">
                          <span className="tag-mini-name">{tag.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`card-score ${getRatingClass(r.avgRating || 0)}`}>
                  {(r.avgRating || 0).toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 2. Map — same container as Dashboard */}
      <section style={{ padding: '60px 0 40px' }} ref={mapRef}>
        <div className="container">
          <div style={{ marginBottom: '24px' }}>
            <h2>The Neighbourhood</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              Click a marker for details
            </p>
          </div>

          <MapView
            restaurants={restaurants}
            officeLocation={null}
            isSignedIn={false}
          />
        </div>
      </section>

      {/* 3. Bento Stats */}
      <section className="landing-bento">
        <div className="landing-bento-grid">
          <div className="landing-bento-card">
            <div className="bento-label">Places</div>
            <div className="bento-value">{stats.totalPlaces}</div>
            <div className="bento-detail">restaurants, cafes &amp; pubs</div>
          </div>
          <div className="landing-bento-card">
            <div className="bento-label">Reviews</div>
            <div className="bento-value">{stats.totalReviews}</div>
            <div className="bento-detail">honest opinions</div>
          </div>
          <div className="landing-bento-card">
            <div className="bento-label">Avg Rating</div>
            <div className="bento-value" style={{ color: stats.avgOfAvgs >= 8 ? 'var(--great)' : stats.avgOfAvgs >= 6 ? 'var(--good)' : 'var(--poor)' }}>
              {stats.avgOfAvgs.toFixed(1)}
            </div>
            <div className="bento-detail">across all places</div>
          </div>
          <div className="landing-bento-card">
            <div className="bento-label">Top Rated</div>
            <div className="bento-value" style={{ color: 'var(--great)' }}>
              {stats.topRatedCount}
            </div>
            <div className="bento-detail">scored 8 or above</div>
          </div>

          {/* Histogram */}
          <div className="landing-bento-card landing-bento-wide">
            <RatingHistogram restaurants={restaurants} />
          </div>

          {/* Popular Tags — uses same tag-mini style as the table */}
          <div className="landing-bento-card landing-bento-wide">
            <div className="bento-label">Most Popular Tags</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
              {tagCounts.map(({ tag, count }) => (
                <span key={tag.id} className="tag-mini" style={{ padding: '6px 12px', fontSize: '12px' }}>
                  <span className="tag-mini-name">{tag.name}</span>
                  <span className="tag-mini-count">{count}</span>
                </span>
              ))}
              {tagCounts.length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No tags yet</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Latest Reviews (visible) — clickable to scroll to map */}
      {visibleRestaurantReviews.length > 0 && (
        <section className="landing-reviews" style={{ padding: '0 48px' }}>
          <div className="landing-reviews-header">
            <h2>Latest Reviews</h2>
            <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {stats.totalReviews} reviews across {stats.totalPlaces} places
            </span>
          </div>
          <div className="landing-review-list">
            {visibleRestaurantReviews.map(group => (
              <div
                key={group.name}
                className="landing-review-item"
                style={{ cursor: 'pointer' }}
                onClick={() => handleReviewClick(group.restaurantId)}
              >
                <div className="landing-review-place">
                  <div className="place-name">{group.name}</div>
                  <div className="place-cuisine">{group.cuisine}</div>
                  <div className={`place-score ${getRatingClass(group.avgRating || 0)}`}>
                    {(group.avgRating || 0).toFixed(1)}
                  </div>
                </div>
                <div className="landing-review-content">
                  {group.reviews.slice(0, 2).map(rev => (
                    <div key={rev.id} className="landing-single-review">
                      <span className={`reviewer-score ${getRatingClass(rev.rating)}`}>
                        {rev.rating}
                      </span>
                      <div className="review-body">
                        <div className="review-comment">"{rev.comment}"</div>
                        <div className="review-meta">
                          <span>{rev.reviewerName}</span>
                          <span>&middot;</span>
                          <span>{timeAgo(rev.created_at)}</span>
                          {rev.tags.length > 0 && (
                            <div className="review-tags">
                              {rev.tags.slice(0, 2).map(tag => (
                                <span key={tag.id} className="tag-small">{tag.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Blurred Reviews + Gate */}
      {blurredRestaurantReviews.length > 0 && (
        <div className="landing-gated-wrapper">
          <div className="landing-gated-blur">
            <section className="landing-reviews" style={{ padding: '0 48px' }}>
              <div className="landing-review-list">
                {blurredRestaurantReviews.map((group, gi) => (
                  <div key={group.name} className="landing-review-item" style={gi === 0 ? { borderTop: 'none' } : undefined}>
                    <div className="landing-review-place">
                      <div className="place-name">{group.name}</div>
                      <div className="place-cuisine">{group.cuisine}</div>
                      <div className={`place-score ${getRatingClass(group.avgRating || 0)}`}>
                        {(group.avgRating || 0).toFixed(1)}
                      </div>
                    </div>
                    <div className="landing-review-content">
                      {group.reviews.slice(0, 2).map(rev => (
                        <div key={rev.id} className="landing-single-review">
                          <span className={`reviewer-score ${getRatingClass(rev.rating)}`}>
                            {rev.rating}
                          </span>
                          <div className="review-body">
                            <div className="review-comment">"{rev.comment}"</div>
                            <div className="review-meta">
                              <span>{rev.reviewerName}</span>
                              <span>&middot;</span>
                              <span>{timeAgo(rev.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="landing-gate-cta">
            <div className="landing-gate-box">
              <h3>See all {stats.totalReviews} reviews</h3>
              <p>Sign up to read every review, see who's writing, and add your own takes on the neighbourhood.</p>
              <div className="social-proof-row">
                <div className="avatar-stack">
                  {avatarInitials.map((init, i) => (
                    <div key={i} className="avatar-circle">{init}</div>
                  ))}
                  {uniqueReviewers > 4 && (
                    <div className="avatar-circle avatar-count">+{uniqueReviewers - 4}</div>
                  )}
                </div>
                <span className="landing-social-proof-text">
                  <strong>{uniqueReviewers} reviewers</strong> already reviewing
                </span>
              </div>
              <a href="/login" className="btn btn-accent" style={{ marginTop: '8px', padding: '14px 36px', fontSize: '13px' }}>
                Sign up with your team
              </a>
              <span className="fine-print">Free forever &middot; No spam &middot; Takes 10 seconds</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="landing-footer">
        <span>Built with questionable taste</span>
        <span className="mono" style={{ fontSize: '11px' }}>1 &mdash; never again &middot; 10 &mdash; perfect</span>
      </footer>
    </>
  )
}
