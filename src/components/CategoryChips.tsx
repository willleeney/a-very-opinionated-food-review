import type { RestaurantCategory } from '../lib/database.types'

const ALL_CATEGORIES: { value: RestaurantCategory; label: string }[] = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'brunch', label: 'Brunch' },
  { value: 'pub', label: 'Pub' },
]

interface CategoryChipsProps {
  selected: RestaurantCategory[]
  onChange: (categories: RestaurantCategory[]) => void
  compact?: boolean
}

export function CategoryChips({ selected, onChange, compact = false }: CategoryChipsProps) {
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

  return (
    <div className="category-chips">
      {/* All button */}
      <button
        className={`default-chip accent ${isAllSelected ? 'active' : ''} ${compact ? 'small' : ''}`}
        onClick={handleSelectAll}
      >
        All
      </button>

      {/* All category chips */}
      {ALL_CATEGORIES.map((category) => {
        const isSelected = selected.includes(category.value)
        return (
          <button
            key={category.value}
            className={`default-chip accent ${isSelected ? 'active' : ''} ${compact ? 'small' : ''}`}
            onClick={() => handleToggleCategory(category.value)}
          >
            {category.label}
          </button>
        )
      })}
    </div>
  )
}
