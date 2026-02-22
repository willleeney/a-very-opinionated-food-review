import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { RestaurantCategory, Tag } from '../lib/database.types'

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
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
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
  const [photoZoom, setPhotoZoom] = useState(1)
  const [photoPan, setPhotoPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [minZoom, setMinZoom] = useState(1)
  const cropOverlayMouseDownTarget = useRef<EventTarget | null>(null)
  const [showCropEditor, setShowCropEditor] = useState(false)
  const [photoNaturalSize, setPhotoNaturalSize] = useState({ w: 0, h: 0 })
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const ratingDropdownRef = useRef<HTMLDivElement>(null)
  const cuisineDropdownRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoContainerRef = useRef<HTMLDivElement>(null)
  const editorContainerWidthRef = useRef(368)
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

  const handlePhotoSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))

    setPhotoNaturalSize({ w: 0, h: 0 })
    setPhotoZoom(1)
    setPhotoPan({ x: 0, y: 0 })
    setShowCropEditor(true)
    setError(null)
  }

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handlePhotoSelect(file)
  }

  const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const handlePhotoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const container = photoContainerRef.current
    if (!container) return
    const containerSize = container.offsetWidth
    const nw = img.naturalWidth
    const nh = img.naturalHeight
    // Allow zooming out to "contain" (full image visible)
    const containZoom = Math.min(containerSize / nw, containerSize / nh)
    const coverZoom = Math.max(containerSize / nw, containerSize / nh)
    setPhotoNaturalSize({ w: nw, h: nh })
    setMinZoom(containZoom)
    // Only set default zoom/pan on first load (not when reopening editor)
    if (photoNaturalSize.w === 0) {
      setPhotoZoom(containZoom)
      // Center the image
      const scaledW = nw * containZoom
      const scaledH = nh * containZoom
      setPhotoPan({
        x: scaledW < containerSize ? (containerSize - scaledW) / 2 : 0,
        y: scaledH < containerSize ? (containerSize - scaledH) / 2 : 0,
      })
    }
  }

  const clampPan = (pan: { x: number; y: number }, zoom: number) => {
    const container = photoContainerRef.current
    if (!container || !photoNaturalSize.w) return pan
    const cs = container.offsetWidth
    const scaledW = photoNaturalSize.w * zoom
    const scaledH = photoNaturalSize.h * zoom
    let x = pan.x
    let y = pan.y
    if (scaledW <= cs) {
      x = (cs - scaledW) / 2
    } else {
      x = Math.min(0, Math.max(cs - scaledW, x))
    }
    if (scaledH <= cs) {
      y = (cs - scaledH) / 2
    } else {
      y = Math.min(0, Math.max(cs - scaledH, y))
    }
    return { x, y }
  }

  const handleCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - photoPan.x, y: e.clientY - photoPan.y })
  }

  const handleCropTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    setIsDragging(true)
    setDragStart({ x: t.clientX - photoPan.x, y: t.clientY - photoPan.y })
  }

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (clientX: number, clientY: number) => {
      const newPan = { x: clientX - dragStart.x, y: clientY - dragStart.y }
      setPhotoPan(clampPan(newPan, photoZoom))
    }
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX, e.touches[0].clientY)
    const onEnd = () => setIsDragging(false)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onTouchMove)
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [isDragging, dragStart, photoZoom, photoNaturalSize])

  const handleZoomChange = (newZoom: number) => {
    // Re-center pan around the container center when zooming
    const container = photoContainerRef.current
    if (container && photoNaturalSize.w) {
      const cs = container.offsetWidth
      const cx = cs / 2
      const cy = cs / 2
      const oldZoom = photoZoom
      // Point in image space that's currently at center
      const imgX = (cx - photoPan.x) / oldZoom
      const imgY = (cy - photoPan.y) / oldZoom
      // New pan to keep that point at center
      const newPan = { x: cx - imgX * newZoom, y: cy - imgY * newZoom }
      setPhotoZoom(newZoom)
      setPhotoPan(clampPan(newPan, newZoom))
    } else {
      setPhotoZoom(newZoom)
    }
  }

  const drawCropToCanvas = (canvasSize: number, imgEl: HTMLImageElement, containerWidth: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvasSize
    canvas.height = canvasSize
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvasSize, canvasSize)
    const scale = canvasSize / containerWidth
    const dx = photoPan.x * scale
    const dy = photoPan.y * scale
    const dw = imgEl.naturalWidth * photoZoom * scale
    const dh = imgEl.naturalHeight * photoZoom * scale
    ctx.drawImage(imgEl, 0, 0, imgEl.naturalWidth, imgEl.naturalHeight, dx, dy, dw, dh)
    return canvas
  }

  const getCroppedBlob = (): Promise<Blob | null> => {
    if (!photoPreview || !photoNaturalSize.w) return Promise.resolve(null)
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const canvas = drawCropToCanvas(800, img, editorContainerWidthRef.current)
        if (!canvas) return resolve(null)
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9)
      }
      img.onerror = () => resolve(null)
      img.src = photoPreview
    })
  }

  const saveCropAndClose = () => {
    const container = photoContainerRef.current
    if (container) {
      editorContainerWidthRef.current = container.offsetWidth
    }
    setShowCropEditor(false)
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
        if (review && photoFile) {
          let fileToUpload: File | Blob = photoFile
          const croppedBlob = await getCroppedBlob()
          if (croppedBlob) fileToUpload = croppedBlob
          const ext = croppedBlob ? 'jpg' : (photoFile.name.split('.').pop() || 'jpg')
          const filePath = `${userId}/${review.id}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('review-photos')
            .upload(filePath, fileToUpload, { upsert: true, contentType: croppedBlob ? 'image/jpeg' : undefined })
          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('review-photos')
            .getPublicUrl(filePath)

          const photoUrlWithCache = `${publicUrl}?t=${Date.now()}`
          await supabase.from('reviews').update({ photo_url: photoUrlWithCache }).eq('id', review.id)
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
      setPhotoFile(null)
      setPhotoPreview(null)
  
      setPhotoZoom(1)
      setPhotoPan({ x: 0, y: 0 })
      setMinZoom(1)
      setPhotoNaturalSize({ w: 0, h: 0 })
      setShowCropEditor(false)
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

                {/* Photo zone - small thumbnail or upload prompt */}
                <div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handlePhotoSelect(file)
                    }}
                  />
                  {photoPreview ? (
                    <div className="receipt-photo-zone has-photo" onClick={() => setShowCropEditor(true)} style={{ cursor: 'pointer', background: '#000' }}>
                      <img
                        src={photoPreview}
                        alt="Preview"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: `${(photoNaturalSize.w * photoZoom / editorContainerWidthRef.current) * 100}%`,
                          height: `${(photoNaturalSize.h * photoZoom / editorContainerWidthRef.current) * 100}%`,
                          marginLeft: `${(photoPan.x / editorContainerWidthRef.current) * 100}%`,
                          marginTop: `${(photoPan.y / editorContainerWidthRef.current) * 100}%`,
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPhotoFile(null)
                          setPhotoPreview(null)
                      
                          setPhotoZoom(1)
                          setPhotoPan({ x: 0, y: 0 })
                          setMinZoom(1)
                          setPhotoNaturalSize({ w: 0, h: 0 })
                        }}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(0,0,0,0.5)',
                          color: 'white',
                          border: 'none',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          lineHeight: '18px',
                          textAlign: 'center',
                          padding: 0
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`receipt-photo-zone ${dragOver ? 'drag-over' : ''}`}
                      onClick={() => photoInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handlePhotoDrop}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" style={{ marginBottom: '2px' }}>
                        <rect x="3" y="3" width="18" height="18" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <div className="hint">Drop photo or click</div>
                    </div>
                  )}
                </div>

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

      {/* Photo crop editor overlay */}
      {showCropEditor && photoPreview && (
        <div
          className="modal-overlay"
          style={{ zIndex: 10001 }}
          onMouseDown={(e) => { cropOverlayMouseDownTarget.current = e.target }}
          onClick={(e) => { if (e.target === e.currentTarget && cropOverlayMouseDownTarget.current === e.currentTarget) { saveCropAndClose() } }}
        >
          <div style={{
            background: '#1a1a1a',
            width: '100%',
            maxWidth: '400px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px',
          }}>
            <div
              ref={photoContainerRef}
              className="receipt-photo-crop"
              style={{ width: '100%', maxWidth: '368px', background: '#000' }}
              onMouseDown={handleCropMouseDown}
              onTouchStart={handleCropTouchStart}
            >
              <img
                src={photoPreview}
                alt="Crop preview"
                onLoad={handlePhotoLoad}
                style={{
                  width: photoNaturalSize.w * photoZoom + 'px',
                  height: photoNaturalSize.h * photoZoom + 'px',
                  transform: `translate(${photoPan.x}px, ${photoPan.y}px)`,
                }}
                draggable={false}
              />
            </div>
            <div style={{ width: '100%', maxWidth: '368px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zoom</span>
              <input
                type="range"
                min={minZoom}
                max={minZoom * 2.5}
                step={0.01}
                value={photoZoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="receipt-btn"
                style={{ color: '#ccc', borderColor: '#555' }}
                onClick={() => {
                  setPhotoFile(null)
                  setPhotoPreview(null)
              
                  setPhotoZoom(1)
                  setPhotoPan({ x: 0, y: 0 })
                  setMinZoom(1)
                  setPhotoNaturalSize({ w: 0, h: 0 })
                  setShowCropEditor(false)
                }}
              >
                Remove
              </button>
              <button
                type="button"
                className="receipt-btn primary"
                onClick={() => saveCropAndClose()}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
