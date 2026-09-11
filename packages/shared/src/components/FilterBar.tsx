import type { ReactNode } from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useFilterStore } from '../lib/store'
import { CategoryChips } from './CategoryChips'
import { RatingSlider } from './RatingSlider'
import type { SocialFilter, OrganisationWithMembership, Tag } from '../lib/database.types'

interface SearchableUser {
  id: string
  name: string
  source: 'following' | 'org_member'
}

interface FilterBarProps {
  userOrgs?: OrganisationWithMembership[]
  isSignedIn?: boolean
  rightActions?: ReactNode
  searchableUsers?: SearchableUser[]
  availableTags?: Tag[]
  availableCuisines?: string[]
}

const SOCIAL_OPTIONS: { value: SocialFilter; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'following', label: 'Following' },
  { value: 'followers', label: 'Followers' },
  { value: 'just_me', label: 'Just Me' },
]

interface ActiveFilter {
  key: string
  label: string
  remove: () => void
}

export function FilterBar({ userOrgs = [], isSignedIn = false, rightActions, searchableUsers = [], availableTags = [], availableCuisines = [] }: FilterBarProps) {
  const {
    selectedCategories,
    setSelectedCategories,
    minOverallRating,
    setMinOverallRating,
    socialFilter,
    setSocialFilter,
    selectedUserIds,
    toggleSelectedUserId,
    setSelectedUserIds,
    selectedTagIds,
    toggleTagId,
    selectedCuisines,
    toggleCuisine,
    clearFilters,
    hasActiveFilters,
  } = useFilterStore()

  const [sheetOpen, setSheetOpen] = useState(false)

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [sheetOpen])

  // Close on Escape
  useEffect(() => {
    if (!sheetOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [sheetOpen])

  const isActive = hasActiveFilters()

  // Build social options with user's orgs
  const socialOptions = useMemo(() => {
    const opts = [...SOCIAL_OPTIONS]
    userOrgs.forEach((org) => {
      opts.push({ value: org.slug, label: org.name })
    })
    return opts
  }, [userOrgs])

  // Compute active filter chips (excluding rating — it has its own visible row)
  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = []

    selectedCategories.forEach((cat) => {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1)
      filters.push({
        key: `cat-${cat}`,
        label,
        remove: () => setSelectedCategories(selectedCategories.filter(c => c !== cat)),
      })
    })

    selectedCuisines.forEach((cuisine) => {
      filters.push({
        key: `cuisine-${cuisine}`,
        label: cuisine,
        remove: () => toggleCuisine(cuisine),
      })
    })

    if (socialFilter !== 'everyone') {
      const opt = socialOptions.find(o => o.value === socialFilter)
      filters.push({
        key: `social-${socialFilter}`,
        label: opt?.label || socialFilter,
        remove: () => { setSocialFilter('everyone'); setSelectedUserIds([]) },
      })
    }

    selectedUserIds.forEach((uid) => {
      const user = searchableUsers.find(u => u.id === uid)
      if (user) {
        filters.push({
          key: `user-${uid}`,
          label: user.name,
          remove: () => toggleSelectedUserId(uid),
        })
      }
    })

    selectedTagIds.forEach((tid) => {
      const tag = availableTags.find(t => t.id === tid)
      if (tag) {
        filters.push({
          key: `tag-${tid}`,
          label: tag.name,
          remove: () => toggleTagId(tid),
        })
      }
    })

    return filters
  }, [selectedCategories, selectedCuisines, socialFilter, selectedUserIds, selectedTagIds, socialOptions, searchableUsers, availableTags, setSelectedCategories, toggleCuisine, setSocialFilter, setSelectedUserIds, toggleSelectedUserId, toggleTagId])

  const activeCount = activeFilters.length

  return (
    <div data-testid="filter-bar">
      {/* Row 1: Rating slider */}
      <div className="filter-bar-rating">
        <span className="filter-row-label">Rating</span>
        <div className="rating-filters">
          <RatingSlider
            label="Rating"
            value={minOverallRating}
            onChange={setMinOverallRating}
            compact
          />
        </div>
      </div>

      {/* Row 2: Clear + Filters + Add Place */}
      <div className="filter-bar-actions-row">
        {isActive && (
          <button
            className="filter-clear-btn"
            onClick={clearFilters}
            data-testid="clear-filters"
          >
            Clear
          </button>
        )}
        <button
          className={`filter-trigger-btn${activeCount > 0 ? ' has-active' : ''}`}
          onClick={() => setSheetOpen(true)}
        >
          Filters{activeCount > 0 && <span className="filter-count">{activeCount}</span>}
        </button>
        {rightActions && (
          <div className="filter-bar-actions">
            {rightActions}
          </div>
        )}
      </div>

      {/* Filter Sheet */}
      {sheetOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSheetOpen(false) }}
        >
          <div className="filter-sheet">
            {/* Header */}
            <div className="filter-sheet-header">
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '22px',
                fontWeight: 400,
                margin: 0,
                flex: 1,
              }}>
                Filters
              </h2>
              {isActive && (
                <button
                  className="filter-clear-btn"
                  onClick={clearFilters}
                  data-testid="clear-filters"
                  style={{ marginRight: '8px' }}
                >
                  Clear all
                </button>
              )}
              <button
                className="filter-trigger-btn has-active"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
              >
                Search
              </button>
            </div>

            {/* Sections */}
            <div className="filter-sheet-body">
              {/* Type */}
              <div className="filter-sheet-section">
                <div className="filter-sheet-label">Type</div>
                <CategoryChips
                  selected={selectedCategories}
                  onChange={setSelectedCategories}
                />
              </div>

              {/* Cuisine */}
              {availableCuisines.length > 0 && (
                <div className="filter-sheet-section">
                  <div className="filter-sheet-label">Cuisine</div>
                  <div className="filter-sheet-chips">
                    {availableCuisines.map((cuisine) => (
                      <button
                        key={cuisine}
                        className={`chip ${selectedCuisines.includes(cuisine) ? 'active' : ''}`}
                        onClick={() => toggleCuisine(cuisine)}
                      >
                        {cuisine}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* View */}
              {isSignedIn && (
                <div className="filter-sheet-section">
                  <div className="filter-sheet-label">View</div>
                  <div className="filter-sheet-chips">
                    {socialOptions.map((option) => (
                      <button
                        key={option.value}
                        className={`chip ${socialFilter === option.value && selectedUserIds.length === 0 ? 'active' : ''}`}
                        onClick={() => {
                          setSocialFilter(option.value)
                          setSelectedUserIds([])
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                    {/* Selected user chips */}
                    {searchableUsers
                      .filter(u => selectedUserIds.includes(u.id))
                      .map((user) => (
                        <button
                          key={user.id}
                          className="chip active"
                          onClick={() => toggleSelectedUserId(user.id)}
                        >
                          {user.name} ×
                        </button>
                      ))}
                  </div>
                  {/* Person search */}
                  {searchableUsers.length > 0 && (
                    <PersonSearch
                      users={searchableUsers}
                      selectedUserIds={selectedUserIds}
                      onToggle={(uid) => {
                        toggleSelectedUserId(uid)
                        setSocialFilter('everyone')
                      }}
                    />
                  )}
                </div>
              )}

              {/* Tags */}
              {availableTags.length > 0 && (
                <div className="filter-sheet-section" style={{ borderBottom: 'none' }}>
                  <div className="filter-sheet-label">Tags</div>
                  <div className="filter-sheet-chips">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        className={`chip ${selectedTagIds.includes(tag.id) ? 'active' : ''}`}
                        onClick={() => toggleTagId(tag.id)}
                      >
                        {tag.icon} {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline person search within the sheet
function PersonSearch({
  users,
  selectedUserIds,
  onToggle,
}: {
  users: SearchableUser[]
  selectedUserIds: string[]
  onToggle: (uid: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(query.toLowerCase())
  )

  if (!open) {
    return (
      <button
        className="filter-person-search-trigger"
        onClick={() => setOpen(true)}
        style={{
          marginTop: '12px',
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          cursor: 'pointer',
          fontSize: '12px',
          padding: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        + Add person
      </button>
    )
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <input
        type="text"
        placeholder="Search people..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          border: 'none',
          borderBottom: '1px solid var(--border)',
          padding: '8px 0',
          fontSize: '13px',
          background: 'transparent',
          outline: 'none',
          color: 'var(--text)',
        }}
      />
      <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '4px' }}>
        {filtered.slice(0, 10).map((user) => {
          const isSelected = selectedUserIds.includes(user.id)
          return (
            <button
              key={user.id}
              className={`dropdown-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onToggle(user.id)}
              style={{ width: '100%' }}
            >
              <span className="item-check">{isSelected ? '✓' : ''}</span>
              <span className="item-label">{user.name}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {user.source === 'following' ? 'Following' : 'Org'}
              </span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
            No results
          </div>
        )}
      </div>
    </div>
  )
}
