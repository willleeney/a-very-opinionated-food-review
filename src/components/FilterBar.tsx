import type { ReactNode } from 'react'
import { useState, useRef, useEffect } from 'react'
import { useFilterStore } from '../lib/store'
import { CategoryChips } from './CategoryChips'
import { RatingSlider } from './RatingSlider'
import type { SocialFilter, OrganisationWithMembership } from '../lib/database.types'

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
}

const SOCIAL_OPTIONS: { value: SocialFilter; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'following', label: 'Following' },
  { value: 'just_me', label: 'Just Me' },
]

export function FilterBar({ userOrgs = [], isSignedIn = false, rightActions, searchableUsers = [] }: FilterBarProps): JSX.Element {
  const {
    selectedCategories,
    setSelectedCategories,
    minOverallRating,
    setMinOverallRating,
    minValueRating,
    setMinValueRating,
    minTasteRating,
    setMinTasteRating,
    socialFilter,
    setSocialFilter,
    selectedUserId,
    setSelectedUserId,
    clearFilters,
    hasActiveFilters,
  } = useFilterStore()

  const [openDropdown, setOpenDropdown] = useState<'category' | 'user' | null>(null)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const userDropdownRef = useRef<HTMLDivElement>(null)

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        if (openDropdown === 'user') {
          setOpenDropdown(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdown])

  const handleCategoryDropdownToggle = (open: boolean) => {
    setOpenDropdown(open ? 'category' : null)
  }

  const handleUserDropdownToggle = (open: boolean) => {
    setOpenDropdown(open ? 'user' : null)
    if (!open) setUserSearchQuery('')
  }

  const isActive = hasActiveFilters()

  // Build social options with user's orgs
  const socialOptions = [...SOCIAL_OPTIONS]
  if (userOrgs.length > 0) {
    userOrgs.forEach((org) => {
      socialOptions.push({ value: org.slug, label: org.name })
    })
  }

  // Filter searchable users based on query
  const filteredUsers = searchableUsers.filter(u =>
    u.name.toLowerCase().includes(userSearchQuery.toLowerCase())
  )

  // Get selected user name if any
  const selectedUser = selectedUserId ? searchableUsers.find(u => u.id === selectedUserId) : null

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId)
    setSocialFilter('everyone') // Clear social filter when selecting specific user
    setOpenDropdown(null)
    setUserSearchQuery('')
  }

  const handleClearUserFilter = () => {
    setSelectedUserId(null)
  }

  return (
    <div className="filter-bar">
      {/* Type filter row with actions on right */}
      <div className="filter-row filter-row-header">
        <div className="filter-row-left">
          <span className="filter-row-label">Type</span>
          <CategoryChips
            selected={selectedCategories}
            onChange={setSelectedCategories}
            isDropdownOpen={openDropdown === 'category'}
            onDropdownToggle={handleCategoryDropdownToggle}
          />
        </div>
        <div className="filter-row-actions">
          {rightActions}
        </div>
      </div>

      {/* Show filter row - only if signed in */}
      {isSignedIn && (
        <div className="filter-row filter-row-header">
          <div className="filter-row-left">
            <span className="filter-row-label">Show</span>
            <div className="social-tabs">
              {socialOptions.map((option) => (
                <button
                  key={option.value}
                  className={`social-tab ${socialFilter === option.value && !selectedUserId ? 'active' : ''}`}
                  onClick={() => {
                    setSocialFilter(option.value)
                    setSelectedUserId(null)
                  }}
                >
                  {option.label}
                </button>
              ))}
              {/* Selected user chip */}
              {selectedUser && (
                <button
                  className="social-tab active"
                  onClick={handleClearUserFilter}
                  title="Click to remove"
                >
                  {selectedUser.name} ×
                </button>
              )}
              {/* Search dropdown */}
              {searchableUsers.length > 0 && (
                <div className="category-dropdown-wrapper" ref={userDropdownRef}>
                  <button
                    type="button"
                    className={`add-chip ${openDropdown === 'user' ? 'has-selection' : ''}`}
                    onClick={() => handleUserDropdownToggle(openDropdown !== 'user')}
                    onMouseEnter={() => handleUserDropdownToggle(true)}
                  >
                    +
                  </button>

                  {openDropdown === 'user' && (
                    <div
                      className="category-dropdown"
                    >
                      <div className="dropdown-header">
                        <span className="dropdown-title">Search people</span>
                      </div>
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                        <input
                          type="text"
                          placeholder="Type to search..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
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
                        {filteredUsers.length === 0 ? (
                          <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            No results
                          </div>
                        ) : (
                          filteredUsers.slice(0, 10).map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              className="dropdown-item"
                              onClick={() => handleSelectUser(user.id)}
                            >
                              <span className="item-check"></span>
                              <span className="item-label">{user.name}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                {user.source === 'following' ? 'Following' : 'Org'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {isActive && (
            <button
              className="filter-clear-btn"
              onClick={clearFilters}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Rating filter row */}
      <div className="filter-row">
        <span className="filter-row-label">Rating</span>
        <div className="rating-filters">
          <div className="rating-filter">
            <span className="rating-filter-label">Overall</span>
            <RatingSlider
              label="Overall"
              value={minOverallRating}
              onChange={setMinOverallRating}
              compact
            />
          </div>
          <div className="rating-filter">
            <span className="rating-filter-label">Value</span>
            <RatingSlider
              label="Value"
              value={minValueRating}
              onChange={setMinValueRating}
              compact
            />
          </div>
          <div className="rating-filter">
            <span className="rating-filter-label">Taste</span>
            <RatingSlider
              label="Taste"
              value={minTasteRating}
              onChange={setMinTasteRating}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  )
}
