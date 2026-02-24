import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { RestaurantWithReviews, Organisation, OrganisationWithMembership, OfficeLocation, RestaurantCategory, Tag } from '../lib/database.types'
import { MapView } from './MapView'
import { RatingHistogram } from './RatingHistogram'
import { AddReview } from './AddReview'
import { PhotoUpload } from './PhotoUpload'
import type { PhotoUploadHandle } from './PhotoUpload'
import { TopNav } from './TopNav'
import { FilterBar } from './FilterBar'
import { useFilterStore } from '../lib/store'
import { getRatingClass, getRatingLabel } from '../lib/ratings'
import type { User } from '@supabase/supabase-js'

interface DashboardProps {
  organisationSlug?: string | null
}

interface ReviewUser {
  id: string
  email: string
  isPrivate: boolean
  avatarUrl: string | null
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
  existingReview?: { id: string; rating: number | null; comment: string | null; dish?: string | null; photo_url?: string | null; tags?: Tag[] }
  availableTags: Tag[]
  onSaved: () => void
  onTagCreated?: (tag: Tag) => void
}) {
  const [overallRating, setOverallRating] = useState(existingReview?.rating?.toString() || '')
  const [selectedTags, setSelectedTags] = useState<string[]>(existingReview?.tags?.map(t => t.id) || [])
  const [comment, setComment] = useState(existingReview?.comment || '')
  const [dish, setDish] = useState(existingReview?.dish || '')
  const [saving, setSaving] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const [localTags, setLocalTags] = useState<Tag[]>([]) // Track newly created tags locally
  const [error, setError] = useState<string | null>(null)
  const [showRatingRequired, setShowRatingRequired] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<'rating' | 'tag' | null>(null)
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const ratingDropdownRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const photoRef = useRef<PhotoUploadHandle>(null)

  // Merge available tags with locally created tags
  const allTags = [...availableTags, ...localTags.filter(lt => !availableTags.some(at => at.id === lt.id))]

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
    setDish(existingReview?.dish || '')
  }, [existingReview?.id])

  // Resize textarea when comment changes or on mount
  useEffect(() => {
    resizeTextarea()
  }, [comment, resizeTextarea])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node) &&
          ratingDropdownRef.current && !ratingDropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
        setTagSearchQuery('')
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

      // Add to local tags, selected tags, and notify parent
      setLocalTags(prev => [...prev, newTag])
      setSelectedTags(prev => [...prev, newTag.id])
      onTagCreated?.(newTag)
      setTagSearchQuery('')
      setOpenDropdown(null)
    } catch (err) {
      console.error('Failed to create tag:', err)
    } finally {
      setCreatingTag(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!overallRating) {
      setShowRatingRequired(true)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const reviewData = {
        rating: parseInt(overallRating),
        comment: comment || null,
        dish: dish || null,
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

      // Upload photo if selected (crop to square first)
      if (photoRef.current?.hasNewPhoto) {
        const croppedBlob = await photoRef.current.getCroppedBlob()
        if (croppedBlob) {
          const filePath = `${userId}/${reviewId}.jpg`
          const { error: uploadError } = await supabase.storage
            .from('review-photos')
            .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' })
          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('review-photos')
            .getPublicUrl(filePath)

          const photoUrlWithCache = `${publicUrl}?t=${Date.now()}`
          await supabase.from('reviews').update({ photo_url: photoUrlWithCache }).eq('id', reviewId)
        }
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
  const selectedTagsNotInDefault = allTags.filter(
    t => selectedTags.includes(t.id) && !defaultTags.some(dt => dt.id === t.id)
  )
  const visibleTags = [...defaultTags, ...selectedTagsNotInDefault]

  // Filter tags for dropdown search
  const filteredTags = allTags.filter(t =>
    t.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
  )

  return (
    <form onSubmit={handleSubmit} className="receipt popup-receipt-form">
      {/* Rating */}
      <div className="category-dropdown-wrapper" ref={ratingDropdownRef} style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          className={`receipt-rating ${!overallRating ? 'receipt-rating-empty' : ''} ${showRatingRequired ? 'receipt-rating-error' : ''}`}
          onClick={() => setOpenDropdown(openDropdown === 'rating' ? null : 'rating')}
        >
          <span className={`number ${overallRating ? getRatingClass(parseInt(overallRating)) : ''}`}>
            {overallRating || '\u00A0'}
          </span>
          <span className="out-of">/10</span>
          <div className="word">
            {overallRating ? getRatingLabel(parseInt(overallRating)) : 'tap to rate'}
          </div>
        </div>
        {openDropdown === 'rating' && (
          <div className="category-dropdown" style={{ minWidth: '200px', left: '50%', transform: 'translateX(-50%)' }}>
            <div className="dropdown-list">
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`dropdown-item ${overallRating === r.toString() ? 'selected' : ''}`}
                  onClick={() => {
                    setOverallRating(r.toString())
                    setOpenDropdown(null)
                    setShowRatingRequired(false)
                  }}
                >
                  <span className="item-check">{overallRating === r.toString() ? '✓' : ''}</span>
                  <span className="item-label">{r}/10 — {getRatingLabel(r)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="receipt-dashes" />

      {/* Photo */}
      <PhotoUpload
        key={existingReview?.id || 'new'}
        ref={photoRef}
        initialPreview={existingReview?.photo_url || null}
        onError={setError}
      />

      {/* Dish */}
      <div className="receipt-row" style={{ alignItems: 'flex-start', marginTop: '10px' }}>
        <span className="receipt-label" style={{ paddingTop: '8px', minWidth: '70px' }}>Dish</span>
        <input
          className="receipt-input"
          type="text"
          style={{ flex: 1, textAlign: 'right', width: 'auto' }}
          value={dish}
          onChange={(e) => setDish(e.target.value)}
          placeholder="e.g. Pad Thai"
        />
      </div>

      {/* Comment */}
      <div className="receipt-row" style={{ alignItems: 'flex-start', marginBottom: '10px' }}>
        <span className="receipt-label" style={{ paddingTop: '8px', minWidth: '70px' }}>Comment</span>
        <textarea
          ref={textareaRef}
          className="receipt-textarea"
          style={{ flex: 1, textAlign: 'right' }}
          value={comment}
          onChange={(e) => { setComment(e.target.value); resizeTextarea() }}
          placeholder="Your thoughts..."
          rows={1}
        />
      </div>

      {/* Tags */}
      <div className="receipt-row" style={{ alignItems: 'flex-start' }}>
        <span className="receipt-label" style={{ paddingTop: '4px' }}>Tags</span>
        <div className="receipt-tags" style={{ justifyContent: 'flex-end', flex: 1 }}>
          {visibleTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`receipt-tag ${selectedTags.includes(tag.id) ? 'active' : ''}`}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
            </button>
          ))}
          <div className="category-dropdown-wrapper" ref={tagDropdownRef} style={{ display: 'inline-block' }}>
            <button
              type="button"
              className="receipt-tag add"
              onClick={() => setOpenDropdown(openDropdown === 'tag' ? null : 'tag')}
            >
              +
            </button>
            {openDropdown === 'tag' && (
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
                      padding: '4px 0',
                      fontSize: '13px',
                      background: 'transparent',
                      outline: 'none',
                      fontFamily: "'JetBrains Mono', monospace"
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
                  {tagSearchQuery.trim() && !allTags.some(t => t.name.toLowerCase() === tagSearchQuery.trim().toLowerCase()) && (
                    <button
                      type="button"
                      className="dropdown-item"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); createTag(tagSearchQuery) }}
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
        </div>
      </div>

      {/* Button */}
      <div className="receipt-btns">
        {error && <span style={{ color: 'var(--poor)', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>{error}</span>}
        <button type="submit" disabled={saving} className="receipt-btn primary">
          {saving ? '...' : existingReview ? 'Update' : 'Submit'}
        </button>
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
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantWithReviews | null>(null)
  const [selectedPhotoReviewId, setSelectedPhotoReviewId] = useState<string | null>(null)
  const [addReviewOpen, setAddReviewOpen] = useState(false)

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
    selectedCuisines,
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
          .select('id, display_name, is_private, avatar_url')
          .in('id', Array.from(userIds))

        if (profiles) {
          setUsers(profiles.map(p => ({
            id: p.id,
            email: p.display_name || p.id.slice(0, 8),
            isPrivate: p.is_private || false,
            avatarUrl: p.avatar_url || null
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

  // Keyboard navigation for photo lightbox
  useEffect(() => {
    if (!selectedPhotoReviewId || !selectedRestaurant) return
    const photosInReviews = selectedRestaurant.reviews.filter(r => r.photo_url)
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIdx = photosInReviews.findIndex(r => r.id === selectedPhotoReviewId)
      if (e.key === 'ArrowRight' && currentIdx < photosInReviews.length - 1) {
        setSelectedPhotoReviewId(photosInReviews[currentIdx + 1].id)
      } else if (e.key === 'ArrowLeft' && currentIdx > 0) {
        setSelectedPhotoReviewId(photosInReviews[currentIdx - 1].id)
      } else if (e.key === 'Escape') {
        setSelectedPhotoReviewId(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedPhotoReviewId, selectedRestaurant])

  // Keep selectedRestaurant in sync when restaurants data refreshes
  useEffect(() => {
    if (selectedRestaurant) {
      const updated = restaurants.find(r => r.id === selectedRestaurant.id)
      if (updated && updated !== selectedRestaurant) {
        setSelectedRestaurant(updated)
      }
    }
  }, [restaurants, selectedRestaurant])

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

    // Cuisine filter
    if (selectedCuisines.length > 0) {
      if (!r.cuisine || !selectedCuisines.includes(r.cuisine)) return false
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
    setSelectedRestaurant(restaurant)
    setAddReviewOpen(false)
    setSelectedPhotoReviewId(null)
    document.body.style.overflow = 'hidden'
  }

  const closePopup = () => {
    setSelectedRestaurant(null)
    setSelectedPhotoReviewId(null)
    setAddReviewOpen(false)
    document.body.style.overflow = ''
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
            officeLocation={activeOfficeLocation}
            showOfficeMarker={showOffice}
            orgName={activeOrgName}
            onRestaurantClick={handleRowClick}
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
          availableCuisines={[...new Set(restaurants.map(r => r.cuisine).filter(Boolean))].sort()}
          rightActions={
            user && (
              <AddReview
                userId={user.id}
                organisationId={currentOrg?.id}
                availableCuisines={[...new Set(restaurants.map(r => r.cuisine).filter(Boolean))].sort()}
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
                <th className="hide-mobile">Cuisine</th>
                <th>Rating</th>
                <th className="hide-mobile">Tags</th>
                <th></th>
                <th className="hide-mobile"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRestaurants.map((restaurant) => (
                <tr
                  key={restaurant.id}
                  onClick={() => handleRowClick(restaurant)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ paddingLeft: '16px' }}>
                    <strong style={{ fontWeight: 500 }}>{restaurant.name}</strong>
                  </td>
                  <td className="hide-mobile">
                    {restaurant.cuisine && (
                      <span className="tag-mini">
                        <span className="tag-mini-name">{restaurant.cuisine}</span>
                      </span>
                    )}
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

      {/* Restaurant Detail Popup — Split Panel */}
      {selectedRestaurant && (() => {
        const restaurant = selectedRestaurant
        const reviews = restaurant.reviews
        const sortedReviews = reviews.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0))
        const photosInReviews = reviews.filter(r => r.photo_url)
        const avgRating = reviews.filter(r => r.rating !== null).length > 0
          ? reviews.filter(r => r.rating !== null).reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.filter(r => r.rating !== null).length
          : null
        const reviewsPanelRef = { current: null as HTMLDivElement | null }

        const selectedPhotoReview = selectedPhotoReviewId ? photosInReviews.find(r => r.id === selectedPhotoReviewId) : null

        const handlePhotoClick = (reviewId: string) => {
          setSelectedPhotoReviewId(selectedPhotoReviewId === reviewId ? null : reviewId)
          // Scroll review into view
          setTimeout(() => {
            const el = reviewsPanelRef.current?.querySelector(`[data-review-id="${reviewId}"]`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }, 50)
        }

        return (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePopup() }}>
            <div className={`restaurant-popup ${photosInReviews.length > 0 ? 'has-photos' : ''}`}>
              {photosInReviews.length > 0 ? (
                <div className="split-panel">
                  {/* Left: photo gallery */}
                  <div className="split-gallery">
                    <div className="split-gallery-grid">
                      {photosInReviews.map((review) => (
                        <div
                          key={review.id}
                          className={`split-gallery-item ${selectedPhotoReviewId === review.id ? 'active' : ''}`}
                          onClick={() => handlePhotoClick(review.id)}
                        >
                          <img src={review.photo_url!} alt={review.dish || 'Review photo'} />
                          {review.rating && (
                            <span className={`mini-score ${getRatingClass(review.rating)}`}>{review.rating}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: info + reviews */}
                  <div className="split-reviews" ref={(el) => { reviewsPanelRef.current = el }}>
                    <div className="split-reviews-header">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h2 style={{ fontSize: '24px' }}>{restaurant.name}</h2>
                        <button
                          onClick={closePopup}
                          style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, padding: '0 0 0 16px' }}
                        >
                          ×
                        </button>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '10px' }}>
                        {[restaurant.cuisine, restaurant.address].filter(Boolean).join(' · ')}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {avgRating !== null && (
                          <span className={`rating-badge ${getRatingClass(avgRating)}`} style={{ fontSize: '15px' }}>
                            {avgRating.toFixed(1)} — {getRatingLabel(avgRating)}
                          </span>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="split-reviews-list">
                      {sortedReviews.map((review) => {
                        const canSee = isReviewVisible(review.user_id)
                        const reviewer = users.find(u => u.id === review.user_id)
                        const displayName = canSee ? (reviewer?.email || 'Anonymous') : 'Anonymous'
                        const initial = canSee && reviewer?.email ? reviewer.email[0].toUpperCase() : '?'
                        const avatarUrl = canSee ? reviewer?.avatarUrl : null
                        const isHighlighted = selectedPhotoReviewId === review.id

                        return (
                          <div
                            key={review.id}
                            data-review-id={review.id}
                            className={`popup-review-row ${isHighlighted ? 'highlighted' : ''}`}
                          >
                            <div className="review-avatar">
                              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{initial}</span>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                <span className={`mono ${getRatingClass(review.rating || 0)}`} style={{ fontSize: '13px' }}>
                                  {review.rating}/10
                                </span>
                                <span style={{ fontWeight: 500, fontSize: '12px' }}>{displayName}</span>
                                {canSee && review.dish && (
                                  <span className="dish-badge">{review.dish}</span>
                                )}
                              </div>
                              {canSee && review.comment && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>{review.comment}</p>
                              )}
                              {canSee && review.tags && review.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>
                                  {review.tags.map(tag => (
                                    <span key={tag.id} className="tag-small" style={{ fontSize: '10px' }}>{tag.name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {reviews.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', padding: '8px 0' }}>No reviews yet</p>
                      )}
                    </div>

                    {/* Collapsible add review section */}
                    {user && (
                      <>
                        <div
                          className="popup-add-review-header"
                          onClick={() => setAddReviewOpen(!addReviewOpen)}
                        >
                          <span className="popup-add-review-label">
                            {restaurant.reviews.find(r => r.user_id === user.id) ? 'Edit your review' : 'Add your review'}
                          </span>
                          <svg
                            className={`popup-add-review-chevron ${addReviewOpen ? 'open' : ''}`}
                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                        {addReviewOpen && (
                          <div className="popup-add-review-body">
                            <InlineReviewForm
                              restaurantId={restaurant.id}
                              userId={user.id}
                              existingReview={restaurant.reviews.find(r => r.user_id === user.id) as { id: string; rating: number | null; comment: string | null; dish?: string | null; photo_url?: string | null; tags?: Tag[] } | undefined}
                              availableTags={availableTags}
                              onSaved={() => {
                                fetchData()
                              }}
                              onTagCreated={(tag) => setAvailableTags(prev => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* No photos: single-column layout */
                <>
                  <div className="popup-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <h2 style={{ fontSize: '24px' }}>{restaurant.name}</h2>
                      <button
                        onClick={closePopup}
                        style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, padding: '0 0 0 16px' }}
                      >
                        ×
                      </button>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '10px' }}>
                      {[restaurant.cuisine, restaurant.address].filter(Boolean).join(' · ')}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {avgRating !== null && (
                        <span className={`rating-badge ${getRatingClass(avgRating)}`} style={{ fontSize: '15px' }}>
                          {avgRating.toFixed(1)} — {getRatingLabel(avgRating)}
                        </span>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '0 24px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {sortedReviews.map((review) => {
                        const canSee = isReviewVisible(review.user_id)
                        const reviewer = users.find(u => u.id === review.user_id)
                        const displayName = canSee ? (reviewer?.email || 'Anonymous') : 'Anonymous'
                        const initial = canSee && reviewer?.email ? reviewer.email[0].toUpperCase() : '?'
                        const avatarUrl = canSee ? reviewer?.avatarUrl : null

                        return (
                          <div key={review.id} className="popup-review-row">
                            <div className="review-avatar">
                              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{initial}</span>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                <span className={`mono ${getRatingClass(review.rating || 0)}`} style={{ fontSize: '13px' }}>
                                  {review.rating}/10
                                </span>
                                <span style={{ fontWeight: 500, fontSize: '12px' }}>{displayName}</span>
                                {canSee && review.dish && (
                                  <span className="dish-badge">{review.dish}</span>
                                )}
                              </div>
                              {canSee && review.comment && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>{review.comment}</p>
                              )}
                              {canSee && review.tags && review.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>
                                  {review.tags.map(tag => (
                                    <span key={tag.id} className="tag-small" style={{ fontSize: '10px' }}>{tag.name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {reviews.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', padding: '8px 0' }}>No reviews yet</p>
                      )}
                    </div>
                  </div>

                  {/* Collapsible add review section */}
                  {user && (
                    <>
                      <div
                        className="popup-add-review-header"
                        onClick={() => setAddReviewOpen(!addReviewOpen)}
                      >
                        <span className="popup-add-review-label">
                          {restaurant.reviews.find(r => r.user_id === user.id) ? 'Edit your review' : 'Add your review'}
                        </span>
                        <svg
                          className={`popup-add-review-chevron ${addReviewOpen ? 'open' : ''}`}
                          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                      {addReviewOpen && (
                        <div className="popup-add-review-body">
                          <InlineReviewForm
                            restaurantId={restaurant.id}
                            userId={user.id}
                            existingReview={restaurant.reviews.find(r => r.user_id === user.id) as { id: string; rating: number | null; comment: string | null; dish?: string | null; photo_url?: string | null; tags?: Tag[] } | undefined}
                            availableTags={availableTags}
                            onSaved={() => {
                              fetchData()
                            }}
                            onTagCreated={(tag) => setAvailableTags(prev => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* Photo Lightbox */}
      {selectedPhotoReviewId && selectedRestaurant && (() => {
        const review = selectedRestaurant.reviews.find(r => r.id === selectedPhotoReviewId)
        if (!review?.photo_url) return null
        const canSee = isReviewVisible(review.user_id)
        const reviewer = users.find(u => u.id === review.user_id)
        const displayName = canSee ? (reviewer?.email || 'Anonymous') : 'Anonymous'
        const photosInReviews = selectedRestaurant.reviews.filter(r => r.photo_url)
        const currentIdx = photosInReviews.findIndex(r => r.id === selectedPhotoReviewId)

        return (
          <div
            className="photo-lightbox"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedPhotoReviewId(null) }}
          >
            <button
              className="photo-lightbox-close"
              onClick={() => setSelectedPhotoReviewId(null)}
            >
              ×
            </button>
            {photosInReviews.length > 1 && currentIdx > 0 && (
              <button
                className="photo-lightbox-nav prev"
                onClick={() => setSelectedPhotoReviewId(photosInReviews[currentIdx - 1].id)}
              >
                ‹
              </button>
            )}
            <img src={review.photo_url} alt={review.dish || 'Review photo'} />
            {photosInReviews.length > 1 && currentIdx < photosInReviews.length - 1 && (
              <button
                className="photo-lightbox-nav next"
                onClick={() => setSelectedPhotoReviewId(photosInReviews[currentIdx + 1].id)}
              >
                ›
              </button>
            )}
            <div className="photo-lightbox-info">
              <span className={`mono ${getRatingClass(review.rating || 0)}`} style={{ fontSize: '16px' }}>
                {review.rating}/10 — {getRatingLabel(review.rating || 0)}
              </span>
              <span style={{ marginLeft: '12px', fontSize: '14px' }}>{displayName}</span>
              {canSee && review.dish && (
                <span className="dish-badge" style={{ marginLeft: '12px', color: 'rgba(255,255,255,0.6)' }}>{review.dish}</span>
              )}
              {canSee && review.comment && (
                <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>{review.comment}</p>
              )}
              {canSee && review.tags && review.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {review.tags.map(tag => (
                    <span key={tag.id} className="lightbox-tag">{tag.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
