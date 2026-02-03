import { useState, useRef, useEffect } from 'react'
import type { RestaurantCategory } from '../lib/database.types'

const ALL_CATEGORIES: { value: RestaurantCategory; label: string }[] = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'brunch', label: 'Brunch' },
  { value: 'pub', label: 'Pub' },
]

// Default visible chips (always shown)
const DEFAULT_VISIBLE = ['lunch', 'coffee', 'dinner'] as RestaurantCategory[]

interface CategoryChipsProps {
  selected: RestaurantCategory[]
  onChange: (categories: RestaurantCategory[]) => void
  compact?: boolean
  isDropdownOpen?: boolean
  onDropdownToggle?: (open: boolean) => void
}

export function CategoryChips({ selected, onChange, compact = false, isDropdownOpen, onDropdownToggle }: CategoryChipsProps) {
  const [internalShowDropdown, setInternalShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Use external state if provided, otherwise use internal
  const showDropdown = isDropdownOpen !== undefined ? isDropdownOpen : internalShowDropdown
  const setShowDropdown = onDropdownToggle || setInternalShowDropdown

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setShowDropdown])

  const isAllSelected = selected.length === 0

  const handleToggleCategory = (category: RestaurantCategory) => {
    if (selected.includes(category)) {
      onChange(selected.filter((c) => c !== category))
    } else {
      onChange([...selected, category])
    }
  }

  const handleSelectAll = () => {
    onChange([])
  }

  // Get categories that are selected but not in default visible
  const additionalSelected = selected.filter(
    (s) => !DEFAULT_VISIBLE.includes(s)
  )

  // Categories available in dropdown (not default visible AND not already selected)
  const dropdownCategories = ALL_CATEGORIES.filter(
    (c) => !DEFAULT_VISIBLE.includes(c.value)
  )

  const hasMoreToAdd = dropdownCategories.some(c => !selected.includes(c.value))

  return (
    <div className="category-chips">
      {/* All button */}
      <button
        className={`default-chip accent ${isAllSelected ? 'active' : ''} ${compact ? 'small' : ''}`}
        onClick={handleSelectAll}
      >
        All
      </button>

      {/* Default visible chips */}
      {DEFAULT_VISIBLE.map((cat) => {
        const category = ALL_CATEGORIES.find((c) => c.value === cat)!
        const isSelected = selected.includes(cat)
        return (
          <button
            key={cat}
            className={`default-chip accent ${isSelected ? 'active' : ''} ${compact ? 'small' : ''}`}
            onClick={() => handleToggleCategory(cat)}
          >
            {category.label}
          </button>
        )
      })}

      {/* Show selected additional categories as visible chips */}
      {additionalSelected.map((cat) => {
        const category = ALL_CATEGORIES.find((c) => c.value === cat)!
        return (
          <button
            key={cat}
            className={`default-chip accent active ${compact ? 'small' : ''}`}
            onClick={() => handleToggleCategory(cat)}
          >
            {category.label}
          </button>
        )
      })}

      {/* Dropdown for more categories (only show if there are more to add) */}
      {hasMoreToAdd && (
        <div className="category-dropdown-wrapper" ref={dropdownRef}>
          <button
            className={`add-chip ${compact ? 'small' : ''}`}
            onClick={() => setShowDropdown(!showDropdown)}
            onMouseEnter={() => setShowDropdown(true)}
          >
            +
          </button>

          {showDropdown && (
            <div
              className="category-dropdown"
              onMouseLeave={() => setShowDropdown(false)}
            >
              <div className="dropdown-header">
                <span className="dropdown-title">More types</span>
              </div>
              <div className="dropdown-list">
                {dropdownCategories.map((category) => {
                  const isSelected = selected.includes(category.value)
                  return (
                    <button
                      key={category.value}
                      className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleCategory(category.value)}
                    >
                      <span className="item-check">{isSelected ? '✓' : ''}</span>
                      <span className="item-label">{category.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
