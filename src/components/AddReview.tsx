import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { RestaurantCategory, Tag } from '../lib/database.types'
import { PhotoUpload } from './PhotoUpload'
import type { PhotoUploadHandle } from './PhotoUpload'

const ALL_CATEGORIES: { value: RestaurantCategory; label: string }[] = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'brunch', label: 'Brunch' },
  { value: 'pub', label: 'Pub' },
]

const RATING_LABELS: Record<number, string> = {
  1: 'Avoid', 2: 'Poor', 3: 'Bad', 4: 'Meh', 5: 'Ok',
  6: 'Decent', 7: 'Good', 8: 'Great', 9: 'Excellent', 10: 'Perfect'
}

function getRatingColor(r: number): string {
  if (r >= 8) return 'var(--great)'
  if (r >= 6) return 'var(--good)'
  return 'var(--poor)'
}

interface AddReviewProps {
  userId: string
  organisationId?: string
  availableCuisines?: string[]
  onAdded: () => void
}

interface PlaceResult {
  placeId: string
  name: string
  address: string
  lat?: number
  lng?: number
}

export function AddReview({ userId, organisationId, availableCuisines = [], onAdded }: AddReviewProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [nameQuery, setNameQuery] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [cuisine, setCuisine] = useState('')
  const [categories, setCategories] = useState<RestaurantCategory[]>([])
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [overallRating, setOverallRating] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [comment, setComment] = useState('')
  const [dish, setDish] = useState('')
  const [loading, setLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResults, setLookupResults] = useState<PlaceResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<'rating' | 'tag' | 'cuisine' | null>(null)
  const [dropdownDir, setDropdownDir] = useState<'up' | 'down'>('down')
  const [dropdownRight, setDropdownRight] = useState<number>(0)
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const [cuisineSearchQuery, setCuisineSearchQuery] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set())
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const ratingDropdownRef = useRef<HTMLDivElement>(null)
  const cuisineDropdownRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<PhotoUploadHandle>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  // Check if dropdown should open upward or downward
  const openDropdownSmart = (which: 'rating' | 'tag' | 'cuisine', triggerEl: HTMLElement) => {
    if (openDropdown === which) {
      setOpenDropdown(null)
      return
    }
    const receipt = receiptRef.current
    if (receipt) {
      const triggerRect = triggerEl.getBoundingClientRect()
      const receiptRect = receipt.getBoundingClientRect()
      const spaceBelow = receiptRect.bottom - triggerRect.bottom
      setDropdownDir(spaceBelow < 280 ? 'up' : 'down')
      // How far the trigger's right edge is from the receipt's right padding edge (28px padding)
      const receiptInnerRight = receiptRect.right - 28
      const offsetFromRight = triggerRect.right - receiptInnerRight
      setDropdownRight(-offsetFromRight)
    }
    setOpenDropdown(which)
  }

  // Fetch available tags on mount
  useEffect(() => {
    async function fetchTags() {
      const { data } = await supabase.from('tags').select('*').order('name')
      if (data) setAvailableTags(data)
    }
    fetchTags()
  }, [])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    } else {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const inTag = tagDropdownRef.current?.contains(target)
      const inRating = ratingDropdownRef.current?.contains(target)
      const inCuisine = cuisineDropdownRef.current?.contains(target)
      if (!inTag && !inRating && !inCuisine) {
        setOpenDropdown(null)
        setTagSearchQuery('')
        setCuisineSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleCategory = (cat: RestaurantCategory) => {
    setCategories(prev =>
      prev.includes(cat)
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    )
  }

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

      setAvailableTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedTags(prev => [...prev, newTag.id])
      setTagSearchQuery('')
      setOpenDropdown(null)
    } catch (err) {
      console.error('Failed to create tag:', err)
    } finally {
      setCreatingTag(false)
    }
  }

  const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
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
        setValidationErrors(prev => { const next = new Set(prev); next.delete('name'); return next })
      }
    } catch (err) {
      console.error('Place details error:', err)
      setError('Failed to get location details.')
    }

    setLookupResults([])
  }

  const clearSelectedPlace = () => {
    setSelectedPlace(null)
    setLatitude(null)
    setLongitude(null)
    setNameQuery('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const name = selectedPlace?.name || nameQuery
    const errors = new Set<string>()
    if (!name.trim()) errors.add('name')
    if (!overallRating) errors.add('rating')
    if (errors.size > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors(new Set())
    setLoading(true)
    setError(null)

    try {
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name,
          cuisine: cuisine || '',
          categories,
          latitude: latitude,
          longitude: longitude,
        })
        .select()
        .single()

      if (restaurantError) throw restaurantError

      // Only add review if overall rating is provided (required)
      if (overallRating) {
        const { data: review, error: reviewError } = await supabase.from('reviews').insert({
          restaurant_id: restaurant.id,
          user_id: userId,
          rating: parseInt(overallRating),
          comment: comment || null,
          dish: dish || null,
          organisation_id: organisationId || null,
        }).select().single()

        if (reviewError) throw reviewError

        // Upload photo if selected (crop to square first)
        if (review && photoRef.current?.hasNewPhoto) {
          const croppedBlob = await photoRef.current.getCroppedBlob()
          if (croppedBlob) {
            const filePath = `${userId}/${review.id}.jpg`
            const { error: uploadError } = await supabase.storage
              .from('review-photos')
              .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' })
            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
              .from('review-photos')
              .getPublicUrl(filePath)

            const photoUrlWithCache = `${publicUrl}?t=${Date.now()}`
            await supabase.from('reviews').update({ photo_url: photoUrlWithCache }).eq('id', review.id)
          }
        }

        // Add tags to the review
        if (review && selectedTags.length > 0) {
          const tagInserts = selectedTags.map(tagId => ({
            review_id: review.id,
            tag_id: tagId,
          }))
          const { error: tagError } = await supabase.from('review_tags').insert(tagInserts)
          if (tagError) throw tagError
        }
      }

      // Reset form
      setNameQuery('')
      setSelectedPlace(null)
      setCuisine('')
      setCategories([])
      setLatitude(null)
      setLongitude(null)
      setOverallRating('')
      setSelectedTags([])
      setComment('')
      setDish('')
      photoRef.current?.reset()
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
          <div className="receipt-wrap">
            <div className="torn-top" />
            <div className="receipt" ref={receiptRef}>
              <form id="receipt-form" className="receipt-body" onSubmit={handleSubmit} noValidate>

                {/* Place name */}
                <div className="receipt-place" style={validationErrors.has('name') ? { border: '1px solid var(--poor)', padding: '8px', marginLeft: '-8px', marginRight: '-8px' } : undefined}>
                  {selectedPlace ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <h3>{selectedPlace.name}</h3>
                      <button
                        type="button"
                        onClick={clearSelectedPlace}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#666', lineHeight: 1, fontFamily: 'inherit' }}
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="receipt-input centered"
                        value={nameQuery}
                        onChange={(e) => { setNameQuery(e.target.value); setValidationErrors(prev => { const next = new Set(prev); next.delete('name'); return next }) }}
                        placeholder="Search for a restaurant..."
                        autoComplete="off"
                      />
                      {lookupResults.length > 0 && (
                        <div className="receipt-autocomplete">
                          {lookupResults.map((result) => (
                            <button
                              key={result.placeId}
                              type="button"
                              className="receipt-autocomplete-item"
                              onClick={() => selectResult(result)}
                            >
                              <div className="item-name">{result.name}</div>
                              <div className="item-address">{result.address}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      {lookupLoading && (
                        <span style={{ display: 'block', textAlign: 'center', color: '#999', fontSize: '11px', marginTop: '4px' }}>...</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Address row */}
                <div className="receipt-row">
                  <span className="receipt-label">Address</span>
                  <span className="receipt-value address">{selectedPlace?.address || '\u2014'}</span>
                </div>

                {/* Date row */}
                <div className="receipt-row">
                  <span className="receipt-label">Date</span>
                  <span className="receipt-value">{new Date().toLocaleDateString('en-GB')}</span>
                </div>

                {/* Rating */}
                <div className="category-dropdown-wrapper" ref={ratingDropdownRef} style={{ display: 'block', ...(validationErrors.has('rating') ? { border: '1px solid var(--poor)', padding: '0 8px', width: 'fit-content', margin: '0 auto' } : {}) }}>
                  <div
                    className={`receipt-rating ${!overallRating ? 'receipt-rating-empty' : ''}`}
                    onClick={() => { setOpenDropdown(openDropdown === 'rating' ? null : 'rating'); setValidationErrors(prev => { const next = new Set(prev); next.delete('rating'); return next }) }}
                    style={{ paddingTop: '10px' }}
                  >
                    <div>
                      <span className="number" style={overallRating ? { color: getRatingColor(parseInt(overallRating)) } : undefined}>
                        {overallRating || ''}
                      </span>
                      <span className="out-of">/10</span>
                    </div>
                    <div className="word" style={overallRating ? { color: getRatingColor(parseInt(overallRating)) } : undefined}>
                      {overallRating ? RATING_LABELS[parseInt(overallRating)] : 'tap to rate'}
                    </div>
                  </div>
                  {openDropdown === 'rating' && (
                    <div className="category-dropdown" style={{ left: '50%', transform: 'translateX(-50%)', minWidth: '200px' }}>
                      <div className="dropdown-list">
                        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
                          <button
                            key={r}
                            type="button"
                            className={`dropdown-item ${overallRating === r.toString() ? 'selected' : ''}`}
                            onClick={() => {
                              setOverallRating(r.toString())
                              setOpenDropdown(null)
                            }}
                          >
                            <span className="item-check">{overallRating === r.toString() ? '\u2713' : ''}</span>
                            <span className="item-label">{r}/10 &mdash; {RATING_LABELS[r]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="receipt-dashes" />
                <div className="receipt-section-label">Optional Details</div>

                {/* Photo zone */}
                <PhotoUpload ref={photoRef} onError={setError} />

                {/* Comment */}
                <div className="receipt-row" style={{ alignItems: 'flex-start', marginBottom: '10px' }}>
                  <span className="receipt-label" style={{ paddingTop: '8px', minWidth: '80px' }}>Comment</span>
                  <textarea
                    className="receipt-textarea"
                    style={{ flex: 1, maxWidth: '60%', textAlign: 'right' }}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onInput={autoResize}
                    placeholder="comment..."
                    rows={1}
                  />
                </div>

                {/* Dish */}
                <div className="receipt-row" style={{ alignItems: 'flex-start', marginBottom: '10px' }}>
                  <span className="receipt-label" style={{ paddingTop: '8px', minWidth: '80px' }}>Dish</span>
                  <textarea
                    className="receipt-textarea"
                    style={{ flex: 1, maxWidth: '60%', textAlign: 'right' }}
                    value={dish}
                    onChange={(e) => setDish(e.target.value)}
                    onInput={autoResize}
                    placeholder="e.g. Pad Thai"
                    rows={1}
                  />
                </div>

                {/* Cuisine */}
                <div style={{ marginBottom: '10px' }}>
                  {(() => {
                    const defaultCuisines = availableCuisines.slice(0, 3)
                    const selectedNotInDefault = cuisine && !defaultCuisines.includes(cuisine) ? [cuisine] : []
                    const visibleCuisines = [...defaultCuisines, ...selectedNotInDefault]
                    const filteredCuisines = availableCuisines.filter(c =>
                      c.toLowerCase().includes(cuisineSearchQuery.toLowerCase())
                    )

                    return (
                      <div className="receipt-row" style={{ alignItems: 'flex-start' }}>
                        <span className="receipt-label" style={{ paddingTop: '4px' }}>Cuisine</span>
                        <div className="receipt-tags" style={{ justifyContent: 'flex-end', flex: 1 }}>
                          {visibleCuisines.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={`receipt-tag ${cuisine === c ? 'active' : ''}`}
                              onClick={() => setCuisine(cuisine === c ? '' : c)}
                            >
                              {c}
                            </button>
                          ))}
                          <div className="category-dropdown-wrapper" ref={cuisineDropdownRef}>
                            <button
                              type="button"
                              className="receipt-tag add"
                              onClick={(e) => openDropdownSmart('cuisine', e.currentTarget)}
                            >
                              +
                            </button>
                            {openDropdown === 'cuisine' && (
                              <div className="category-dropdown wide" style={{
                                left: 'auto', right: dropdownRight,
                                ...(dropdownDir === 'up'
                                  ? { bottom: 'calc(100% + 8px)', top: 'auto' }
                                  : { top: 'calc(100% + 8px)' })
                              }}>
                                <div className="dropdown-header">
                                  <span className="dropdown-title">Search cuisines</span>
                                </div>
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                                  <input
                                    type="text"
                                    placeholder="Type to search..."
                                    value={cuisineSearchQuery}
                                    onChange={(e) => setCuisineSearchQuery(e.target.value)}
                                    style={{
                                      width: '100%',
                                      border: 'none',
                                      padding: '4px 0',
                                      fontSize: '13px',
                                      background: 'transparent',
                                      outline: 'none'
                                    }}
                                    autoFocus
                                  />
                                </div>
                                <div className="dropdown-list">
                                  {filteredCuisines.length === 0 ? (
                                    <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                      No results
                                    </div>
                                  ) : (
                                    filteredCuisines.map((c) => (
                                      <button
                                        key={c}
                                        type="button"
                                        className={`dropdown-item ${cuisine === c ? 'selected' : ''}`}
                                        onClick={() => {
                                          setCuisine(cuisine === c ? '' : c)
                                          setOpenDropdown(null)
                                          setCuisineSearchQuery('')
                                        }}
                                      >
                                        <span className="item-check">{cuisine === c ? '\u2713' : ''}</span>
                                        <span className="item-label">{c}</span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Categories / Type */}
                <div style={{ marginBottom: '10px' }}>
                  <div className="receipt-row" style={{ alignItems: 'flex-start' }}>
                    <span className="receipt-label" style={{ paddingTop: '4px' }}>Type</span>
                    <div className="receipt-tags" style={{ justifyContent: 'flex-end', flex: 1 }}>
                      {ALL_CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          className={`receipt-tag ${categories.includes(cat.value) ? 'active' : ''}`}
                          onClick={() => toggleCategory(cat.value)}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div style={{ marginBottom: '10px' }}>
                  {(() => {
                    const defaultTags = availableTags.slice(0, 3)
                    const selectedTagsNotInDefault = availableTags.filter(
                      t => selectedTags.includes(t.id) && !defaultTags.some(dt => dt.id === t.id)
                    )
                    const visibleTags = [...defaultTags, ...selectedTagsNotInDefault]
                    const filteredTags = availableTags.filter(t =>
                      t.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
                    )

                    return (
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
                          <div className="category-dropdown-wrapper" ref={tagDropdownRef}>
                            <button
                              type="button"
                              className="receipt-tag add"
                              onClick={(e) => openDropdownSmart('tag', e.currentTarget)}
                            >
                              +
                            </button>
                            {openDropdown === 'tag' && (
                              <div className="category-dropdown wide" style={{
                                left: 'auto', right: dropdownRight,
                                ...(dropdownDir === 'up'
                                  ? { bottom: 'calc(100% + 8px)', top: 'auto' }
                                  : { top: 'calc(100% + 8px)' })
                              }}>
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
                                        <span className="item-check">{isSelected ? '\u2713' : ''}</span>
                                        <span className="item-label">{tag.name}</span>
                                      </button>
                                    )
                                  })}
                                  {tagSearchQuery.trim() && !availableTags.some(t => t.name.toLowerCase() === tagSearchQuery.trim().toLowerCase()) && (
                                    <button
                                      type="button"
                                      className="dropdown-item"
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                      }}
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        createTag(tagSearchQuery)
                                      }}
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
                    )
                  })()}
                </div>

              </form>
              {/* Footer - sticky at bottom of scroll */}
              <div className="receipt-footer">
                {error && (
                  <p style={{ color: 'var(--poor)', fontSize: '11px', marginBottom: '8px', fontFamily: "'JetBrains Mono', monospace" }}>
                    {error}
                  </p>
                )}
                <div className="receipt-btns">
                  <button type="button" className="receipt-btn" onClick={() => setIsOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" form="receipt-form" className="receipt-btn primary" disabled={loading}>
                    {loading ? 'Adding...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
            <div className="torn-bottom" />
          </div>
        </div>
      )}

    </>
  )
}
