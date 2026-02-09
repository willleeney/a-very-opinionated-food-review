import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { RestaurantWithReviews, Organisation, OrganisationWithMembership, OfficeLocation, RestaurantCategory, Tag } from '../lib/database.types'
import { MapView } from './MapView'
import { RatingHistogram } from './RatingHistogram'
import { AddReview } from './AddReview'
import { TopNav } from './TopNav'
import { FilterBar } from './FilterBar'
import { useFilterStore } from '../lib/store'
import type { User } from '@supabase/supabase-js'

interface DashboardProps {
  organisationSlug?: string | null
}

interface ReviewUser {
  id: string
  email: string
  isPrivate: boolean
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
  availableTags,
  onSaved,
  onTagCreated
}: {
  restaurantId: string
  userId: string
  existingReview?: { id: string; rating: number | null; comment: string | null; tags?: Tag[] }
  availableTags: Tag[]
  onSaved: () => void
  onTagCreated?: (tag: Tag) => void
}) {
  const [overallRating, setOverallRating] = useState(existingReview?.rating?.toString() || '')
  const [selectedTags, setSelectedTags] = useState<string[]>(existingReview?.tags?.map(t => t.id) || [])
  const [comment, setComment] = useState(existingReview?.comment || '')
  const [saving, setSaving] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [showRatingDropdown, setShowRatingDropdown] = useState(false)
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const ratingDropdownRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea helper
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }
  }, [])

  // Sync state when existingReview changes (e.g., after data refresh)
  useEffect(() => {
    setOverallRating(existingReview?.rating?.toString() || '')
    setSelectedTags(existingReview?.tags?.map(t => t.id) || [])
    setComment(existingReview?.comment || '')
  }, [existingReview?.id])

  // Resize textarea when comment changes or on mount
  useEffect(() => {
    resizeTextarea()
  }, [comment, resizeTextarea])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false)
        setTagSearchQuery('')
      }
      if (ratingDropdownRef.current && !ratingDropdownRef.current.contains(e.target as Node)) {
        setShowRatingDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const createTag = async (name: string) => {
    if (!name.trim()) return
    setCreatingTag(true)
    try {
      const { data: newTag, error: createError } = await supabase
        .from('tags')
        .insert({ name: name.trim() })
        .select()
        .single()

      if (createError) throw createError

      // Add to selected tags and notify parent
      setSelectedTags(prev => [...prev, newTag.id])
      onTagCreated?.(newTag)
      setTagSearchQuery('')
    } catch (err) {
      console.error('Failed to create tag:', err)
    } finally {
      setCreatingTag(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!overallRating) return

    setSaving(true)
    setError(null)

    try {
      const reviewData = {
        rating: parseInt(overallRating),
        comment: comment || null,
      }

      let reviewId: string

      if (existingReview) {
        // Update existing review
        const { error } = await supabase
          .from('reviews')
          .update(reviewData)
          .eq('id', existingReview.id)
        if (error) throw error
        reviewId = existingReview.id

        // Remove old tags
        await supabase.from('review_tags').delete().eq('review_id', reviewId)
      } else {
        // Insert new review
        const { data: newReview, error } = await supabase
          .from('reviews')
          .insert({
            restaurant_id: restaurantId,
            user_id: userId,
            ...reviewData,
          })
          .select()
          .single()
        if (error) throw error
        reviewId = newReview.id
      }

      // Add new tags
      if (selectedTags.length > 0) {
        const tagInserts = selectedTags.map(tagId => ({
          review_id: reviewId,
          tag_id: tagId,
        }))
        const { error: tagError } = await supabase.from('review_tags').insert(tagInserts)
        if (tagError) throw tagError
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

  // Show first 3 tags + any selected tags not in first 3
  const defaultTags = availableTags.slice(0, 3)
  const selectedTagsNotInDefault = availableTags.filter(
    t => selectedTags.includes(t.id) && !defaultTags.some(dt => dt.id === t.id)
  )
  const visibleTags = [...defaultTags, ...selectedTagsNotInDefault]

  // Filter tags for dropdown search
  const filteredTags = availableTags.filter(t =>
    t.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
  )

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Left column: Label + Rating */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '80px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {existingReview ? 'Your review' : 'Add review'}
          </span>
          <div className="category-dropdown-wrapper" ref={ratingDropdownRef}>
            <button
              type="button"
              className={`social-tab ${overallRating ? 'active' : ''}`}
              onClick={() => setShowRatingDropdown(!showRatingDropdown)}
              style={{ minWidth: '50px', textAlign: 'center' }}
            >
              {overallRating || '—'}
            </button>
            {showRatingDropdown && (
              <div className="category-dropdown" style={{ minWidth: '60px' }}>
                <div className="dropdown-list">
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`dropdown-item ${overallRating === r.toString() ? 'selected' : ''}`}
                      onClick={() => {
                        setOverallRating(r.toString())
                        setShowRatingDropdown(false)
                      }}
                    >
                      <span className="item-check">{overallRating === r.toString() ? '✓' : ''}</span>
                      <span className="item-label">{r}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Comment, Tags, Button */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <textarea
            ref={textareaRef}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              resizeTextarea()
            }}
            placeholder="Add a comment..."
            rows={2}
            style={{
              maxWidth: '480px',
              resize: 'none',
              overflow: 'hidden',
              minHeight: '48px',
              lineHeight: '1.4',
              padding: '8px 0',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: '14px'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div className="social-tabs" style={{ flex: 1 }}>
              {visibleTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`social-tab ${selectedTags.includes(tag.id) ? 'active' : ''}`}
                >
                  {tag.name}
                </button>
              ))}
              {/* Search dropdown for more tags */}
              {availableTags.length > 3 && (
                <div className="category-dropdown-wrapper" ref={tagDropdownRef}>
                  <button
                    type="button"
                    className={`add-chip ${showTagDropdown ? 'has-selection' : ''}`}
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    onMouseEnter={() => setShowTagDropdown(true)}
                  >
                    +
                  </button>
                  {showTagDropdown && (
                    <div className="category-dropdown wide">
                      <div className="dropdown-header">
                        <span className="dropdown-title">Search tags</span>
                      </div>
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                        <input
                          type="text"
                          placeholder="Type to search..."
                          value={tagSearchQuery}
                          onChange={(e) => setTagSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            border: 'none',
                            borderBottom: 'none',
                            padding: '4px 0',
                            fontSize: '13px',
                            background: 'transparent',
                            outline: 'none'
                          }}
                          autoFocus
                        />
                      </div>
                      <div className="dropdown-list">
                        {filteredTags.map((tag) => {
                          const isSelected = selectedTags.includes(tag.id)
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleTag(tag.id)}
                            >
                              <span className="item-check">{isSelected ? '✓' : ''}</span>
                              <span className="item-label">{tag.name}</span>
                            </button>
                          )
                        })}
                        {tagSearchQuery.trim() && !availableTags.some(t => t.name.toLowerCase() === tagSearchQuery.trim().toLowerCase()) && (
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => createTag(tagSearchQuery)}
                            disabled={creatingTag}
                            style={{ borderTop: filteredTags.length > 0 ? '1px solid var(--border)' : undefined }}
                          >
                            <span className="item-check">+</span>
                            <span className="item-label">{creatingTag ? 'Creating...' : `Create "${tagSearchQuery.trim()}"`}</span>
                          </button>
                        )}
                        {filteredTags.length === 0 && !tagSearchQuery.trim() && (
                          <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            No tags yet
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {error && <span style={{ color: 'var(--poor)', fontSize: '12px' }}>{error}</span>}
              <button type="submit" disabled={saving || !overallRating} className="btn btn-accent" style={{ padding: '8px 16px' }}>
                {saving ? '...' : existingReview ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}

export function Dashboard({ organisationSlug }: DashboardProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [restaurants, setRestaurants] = useState<RestaurantWithReviews[]>([])
  const [users, setUsers] = useState<ReviewUser[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Organisation state
  const [currentOrg, setCurrentOrg] = useState<Organisation | null>(null)
  const [_currentOrgMemberIds, setCurrentOrgMemberIds] = useState<Set<string>>(new Set())
  const [userOrgs, setUserOrgs] = useState<OrganisationWithMembership[]>([])
  const [_userOrgIds, setUserOrgIds] = useState<Set<string>>(new Set())
  const [_isAdmin, setIsAdmin] = useState(false)
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null)

  const {
    selectedCategories,
    minOverallRating,
    socialFilter,
    selectedUserIds,
    selectedTagIds,
    highlightedRestaurantId: _highlightedRestaurantId,
    setHighlightedRestaurantId,
  } = useFilterStore()

  // Following state
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set())
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

  // Fetch user's followers list
  const fetchFollowers = useCallback(async (userId: string) => {
    const { data: follows } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('following_id', userId)

    if (follows && follows.length > 0) {
      setFollowerIds(new Set(follows.map(f => f.follower_id)))
    } else {
      setFollowerIds(new Set())
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

    // Fetch all tags
    const { data: tagsData } = await supabase.from('tags').select('*').order('name')
    if (tagsData) setAvailableTags(tagsData)

    // Fetch all restaurants with reviews
    const { data: restaurantsData } = await supabase
      .from('restaurants')
      .select('*, reviews(*)')
      .order('name')

    // Fetch all review_tags with tag details
    const { data: reviewTagsData } = await supabase
      .from('review_tags')
      .select('review_id, tag_id, tags(*)')

    // Build a map of review_id -> tags
    const reviewTagsMap = new Map<string, Tag[]>()
    if (reviewTagsData) {
      for (const rt of reviewTagsData) {
        if (!reviewTagsMap.has(rt.review_id)) {
          reviewTagsMap.set(rt.review_id, [])
        }
        if (rt.tags) {
          reviewTagsMap.get(rt.review_id)!.push(rt.tags as Tag)
        }
      }
    }

    if (restaurantsData) {
      const withCalculations = restaurantsData.map((r) => {
        // Mark each review with whether the reviewer is an org member (for visibility)
        // and attach their tags
        const reviews = (r.reviews || []).map(rev => ({
          ...rev,
          isOrgMember: rev.user_id ? visibleReviewerIds.has(rev.user_id) : false,
          tags: reviewTagsMap.get(rev.id) || []
        }))

        // Calculate average rating
        const ratings = reviews
          .filter((rev) => rev.rating !== null)
          .map((rev) => rev.rating as number)
        const avgRating = ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null

        // Calculate top tags (by frequency across all reviews)
        const tagCounts = new Map<string, { tag: Tag; count: number }>()
        for (const rev of reviews) {
          for (const tag of rev.tags || []) {
            const existing = tagCounts.get(tag.id)
            if (existing) {
              existing.count++
            } else {
              tagCounts.set(tag.id, { tag, count: 1 })
            }
          }
        }
        const topTags = Array.from(tagCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 2)

        return {
          ...r,
          reviews,
          avgRating,
          topTags,
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
          .select('id, display_name, is_private')
          .in('id', Array.from(userIds))

        if (profiles) {
          setUsers(profiles.map(p => ({
            id: p.id,
            email: p.display_name || p.id.slice(0, 8),
            isPrivate: p.is_private || false
          })))
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
        fetchFollowers(data.user.id)
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
          fetchFollowers(session.user.id)
          fetchData(session.user.id)
        } else {
          setUserOrgs([])
          setUserOrgIds(new Set())
          setIsAdmin(false)
          setFollowingIds(new Set())
          setFollowerIds(new Set())
          fetchData(null)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchData, fetchUserOrgs, fetchFollowing, fetchFollowers])

  // Determine which reviews are "relevant" based on social filter
  const getRelevantReviews = (reviews: typeof restaurants[0]['reviews']) => {
    if (selectedUserIds.length > 0) {
      return reviews.filter(rev => rev.user_id && selectedUserIds.includes(rev.user_id))
    }
    if (socialFilter === 'everyone' || !user) {
      return reviews
    }
    if (socialFilter === 'just_me') {
      return reviews.filter(rev => rev.user_id === user.id)
    }
    if (socialFilter === 'following') {
      return reviews.filter(rev => rev.user_id && followingIds.has(rev.user_id))
    }
    if (socialFilter === 'followers') {
      return reviews.filter(rev => rev.user_id && followerIds.has(rev.user_id))
    }
    // Organisation filter
    const org = userOrgs.find(o => o.slug === socialFilter)
    if (org) {
      const orgMemberIds = orgMembersByOrgId.get(org.id)
      if (orgMemberIds) {
        return reviews.filter(rev => rev.user_id && orgMemberIds.has(rev.user_id))
      }
    }
    return reviews
  }

  // Filter restaurants and recalculate averages based on social filter
  const filteredRestaurants = restaurants.map(r => {
    const relevantReviews = getRelevantReviews(r.reviews)

    // Recalculate averages from relevant reviews only
    const ratings = relevantReviews
      .filter(rev => rev.rating !== null)
      .map(rev => rev.rating as number)
    const filteredAvgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null

    // Recalculate top tags from relevant reviews
    const tagCounts = new Map<string, { tag: Tag; count: number }>()
    for (const rev of relevantReviews) {
      for (const tag of rev.tags || []) {
        const existing = tagCounts.get(tag.id)
        if (existing) {
          existing.count++
        } else {
          tagCounts.set(tag.id, { tag, count: 1 })
        }
      }
    }
    const filteredTopTags = Array.from(tagCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)

    return {
      ...r,
      filteredAvgRating,
      filteredTopTags,
      relevantReviewCount: relevantReviews.length,
    }
  }).filter(r => {
    // Category filter
    if (selectedCategories.length > 0) {
      const restaurantCategories = (r.categories || []) as RestaurantCategory[]
      const hasMatchingCategory = selectedCategories.some(cat => restaurantCategories.includes(cat))
      if (!hasMatchingCategory) return false
    }

    // Must have relevant reviews when social filter is active
    if (selectedUserIds.length > 0 || (socialFilter !== 'everyone' && user)) {
      if (r.relevantReviewCount === 0) return false
    }

    // Overall rating filter (use filtered average)
    if (minOverallRating !== null && r.filteredAvgRating !== null) {
      if (r.filteredAvgRating < minOverallRating) return false
    }

    // Tag filter - restaurant must have at least one review with ALL selected tags
    if (selectedTagIds.length > 0) {
      const restaurantTagIds = new Set<string>()
      for (const review of r.reviews) {
        for (const tag of review.tags || []) {
          restaurantTagIds.add(tag.id)
        }
      }
      const hasAllSelectedTags = selectedTagIds.every(tagId => restaurantTagIds.has(tagId))
      if (!hasAllSelectedTags) return false
    }

    return true
  }).sort((a, b) => {
    // Sort by overall rating (descending)
    const aRating = a.filteredAvgRating ?? 0
    const bRating = b.filteredAvgRating ?? 0
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

  // Helper to check if a review is visible (for stats calculation)
  // Same logic as isReviewVisible - based on profile privacy
  const isReviewVisibleForStats = (review: { user_id: string | null }): boolean => {
    if (!review.user_id) return false
    const reviewer = users.find(u => u.id === review.user_id)
    if (!reviewer) return false
    // Public profiles visible to all
    if (!reviewer.isPrivate) return true
    // Private profiles: own reviews
    if (user && review.user_id === user.id) return true
    // Private profiles: followers can see
    if (followingIds.has(review.user_id)) return true
    // Private profiles: org members can see
    for (const [_orgId, memberIds] of orgMembersByOrgId) {
      if (memberIds.has(review.user_id) && user && memberIds.has(user.id)) {
        return true
      }
    }
    return false
  }

  // Calculate stats based only on visible reviews
  const getVisibleStats = () => {
    let totalVisibleReviews = 0
    const restaurantVisibleRatings: { id: string; avgRating: number }[] = []

    for (const r of restaurants) {
      const visibleReviews = r.reviews.filter(rev => isReviewVisibleForStats(rev))
      totalVisibleReviews += visibleReviews.length

      const ratings = visibleReviews
        .filter(rev => rev.rating !== null)
        .map(rev => rev.rating as number)

      if (ratings.length > 0) {
        const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
        restaurantVisibleRatings.push({ id: r.id, avgRating: avg })
      }
    }

    const avgRating = restaurantVisibleRatings.length > 0
      ? restaurantVisibleRatings.reduce((sum, r) => sum + r.avgRating, 0) / restaurantVisibleRatings.length
      : 0

    return {
      total: restaurants.length,
      reviews: totalVisibleReviews,
      avgRating,
      topRated: restaurantVisibleRatings.filter(r => r.avgRating >= 8).length,
    }
  }

  const stats = getVisibleStats()

  const handleRowClick = (restaurant: RestaurantWithReviews) => {
    if (!user) return
    setExpandedId(expandedId === restaurant.id ? null : restaurant.id)
  }

  const handleMapClick = (e: React.MouseEvent, restaurant: RestaurantWithReviews) => {
    e.stopPropagation()
    setHighlightedRestaurantId(restaurant.id)
    document.querySelector('.map-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Check if a review's details (name, comment, tags) should be visible
  // Visibility is based on profile privacy:
  // - Public profile: visible to everyone
  // - Private profile: visible to followers, org members, and themselves
  const isReviewVisible = (reviewUserId: string | null): boolean => {
    // If reviewer not found, hide their details
    if (!reviewUserId) return false

    // Check if reviewer exists in our users list
    const reviewer = users.find(u => u.id === reviewUserId)
    if (!reviewer) return false

    // Public profiles are visible to everyone
    if (!reviewer.isPrivate) return true

    // Private profiles: own reviews are always visible
    if (user && reviewUserId === user.id) return true

    // Private profiles: followers can see
    if (followingIds.has(reviewUserId)) return true

    // Private profiles: org members can see (shares any org with viewer)
    for (const [_orgId, memberIds] of orgMembersByOrgId) {
      if (memberIds.has(reviewUserId) && user && memberIds.has(user.id)) {
        return true
      }
    }

    return false
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  const heroDescription = 'opinionated takes. taste encouraged but not necessarily welcome.'

  return (
    <div>
      {/* Navigation */}
      <TopNav user={user} currentOrgSlug={organisationSlug} userOrgs={userOrgs} />

      {/* Hero */}
      <section className="hero" style={{ paddingTop: '120px' }}>
        <div className="container">
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
          availableTags={availableTags}
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
                <th style={{ paddingLeft: '16px' }}>Name</th>
                <th className="hide-mobile">Type</th>
                <th>Rating</th>
                <th className="hide-mobile">Tags</th>
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
                    <td style={{ paddingLeft: '16px' }}>
                      <strong style={{ fontWeight: 500 }}>{restaurant.name}</strong>
                    </td>
                    <td className="hide-mobile" style={{ color: 'var(--text-secondary)' }}>
                      {restaurant.cuisine}
                    </td>
                    <td>
                      {restaurant.filteredAvgRating !== null ? (
                        <span className={`rating-badge ${getRatingClass(restaurant.filteredAvgRating)}`}>
                          {restaurant.filteredAvgRating.toFixed(1)} — {getRatingLabel(restaurant.filteredAvgRating)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="hide-mobile">
                      {restaurant.filteredTopTags && restaurant.filteredTopTags.length > 0 && (
                        <div className="tags-table">
                          {restaurant.filteredTopTags.map(({ tag, count }) => (
                            <span key={tag.id} className="tag-mini">
                              <span className="tag-mini-name">{tag.name}</span>
                              <span className="tag-mini-count">{count}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {restaurant.relevantReviewCount} review{restaurant.relevantReviewCount !== 1 ? 's' : ''}
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
                      <td colSpan={6} style={{ background: 'var(--bg-warm)', padding: '24px' }}>
                        {(() => {
                          const reviews = restaurant.reviews
                          return reviews.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {reviews.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).map((review) => {
                                const canSeeDetails = isReviewVisible(review.user_id)
                                const reviewer = users.find(u => u.id === review.user_id)
                                return (
                                  <div key={review.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                      <span className={`mono ${getRatingClass(review.rating || 0)}`} style={{ fontSize: '14px', minWidth: '50px' }}>
                                        {review.rating}/10
                                      </span>
                                      <span style={{ color: 'var(--text-muted)', fontSize: '13px', minWidth: '80px' }}>
                                        {canSeeDetails ? (reviewer?.email || 'Anonymous') : 'Anonymous'}
                                      </span>
                                      {canSeeDetails && review.comment && (
                                        <span style={{ color: 'var(--text-secondary)' }}>{review.comment}</span>
                                      )}
                                    </div>
                                    {canSeeDetails && review.tags && review.tags.length > 0 && (
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginLeft: '66px' }}>
                                        {review.tags.map(tag => (
                                          <span key={tag.id} className="tag-small">
                                            {tag.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p style={{ color: 'var(--text-muted)' }}>No reviews yet</p>
                          )
                        })()}
                        {user && (
                          <InlineReviewForm
                            restaurantId={restaurant.id}
                            userId={user.id}
                            existingReview={restaurant.reviews.find(r => r.user_id === user.id) as { id: string; rating: number | null; comment: string | null; tags?: Tag[] } | undefined}
                            availableTags={availableTags}
                            onSaved={fetchData}
                            onTagCreated={(tag) => setAvailableTags(prev => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))}
                          />
                        )}
                        {/* Mobile map button */}
                        {restaurant.latitude && restaurant.longitude && (
                          <div className="show-mobile" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button
                              onClick={(e) => handleMapClick(e, restaurant)}
                              style={{
                                background: 'none',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                                color: 'var(--accent)',
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                              </svg>
                              View on map
                            </button>
                          </div>
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
