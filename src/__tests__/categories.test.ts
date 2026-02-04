import { describe, it, expect } from 'vitest'

// Category types
type RestaurantCategory = 'lunch' | 'dinner' | 'coffee' | 'brunch' | 'pub'

// Test data
const mockRestaurants = [
  {
    id: 'restaurant-1',
    name: 'Borough Market Kitchen',
    cuisine: 'British',
    categories: ['lunch', 'brunch'] as RestaurantCategory[],
  },
  {
    id: 'restaurant-2',
    name: 'Padella',
    cuisine: 'Italian',
    categories: ['lunch', 'dinner'] as RestaurantCategory[],
  },
  {
    id: 'restaurant-3',
    name: 'Hawksmoor Borough',
    cuisine: 'Steakhouse',
    categories: ['dinner'] as RestaurantCategory[],
  },
  {
    id: 'restaurant-4',
    name: 'Monmouth Coffee',
    cuisine: 'Cafe',
    categories: ['coffee', 'brunch'] as RestaurantCategory[],
  },
  {
    id: 'restaurant-5',
    name: 'The Rake',
    cuisine: 'Pub',
    categories: ['pub', 'lunch'] as RestaurantCategory[],
  },
]

/**
 * Filter restaurants by categories (OR logic - matches any selected category)
 */
function filterByCategories(
  restaurants: typeof mockRestaurants,
  selectedCategories: RestaurantCategory[]
): typeof mockRestaurants {
  // If no categories selected, show all
  if (selectedCategories.length === 0) return restaurants

  return restaurants.filter((restaurant) =>
    selectedCategories.some((category) =>
      restaurant.categories.includes(category)
    )
  )
}

/**
 * Check if restaurant matches category filter
 */
function matchesCategory(
  restaurant: { categories: RestaurantCategory[] },
  selectedCategories: RestaurantCategory[]
): boolean {
  if (selectedCategories.length === 0) return true
  return selectedCategories.some((cat) => restaurant.categories.includes(cat))
}

describe('Restaurant Categories', () => {
  describe('Category data structure', () => {
    it('restaurants have categories array', () => {
      mockRestaurants.forEach((restaurant) => {
        expect(Array.isArray(restaurant.categories)).toBe(true)
        expect(restaurant.categories.length).toBeGreaterThan(0)
      })
    })

    it('categories are valid values', () => {
      const validCategories: RestaurantCategory[] = [
        'lunch',
        'dinner',
        'coffee',
        'brunch',
        'pub',
      ]

      mockRestaurants.forEach((restaurant) => {
        restaurant.categories.forEach((category) => {
          expect(validCategories).toContain(category)
        })
      })
    })

    it('restaurants can have multiple categories', () => {
      const multiCategoryRestaurants = mockRestaurants.filter(
        (r) => r.categories.length > 1
      )

      expect(multiCategoryRestaurants.length).toBeGreaterThan(0)
    })
  })

  describe('Category filtering', () => {
    it('returns all restaurants when no category selected', () => {
      const result = filterByCategories(mockRestaurants, [])

      expect(result).toHaveLength(mockRestaurants.length)
    })

    it('filters by single category', () => {
      const result = filterByCategories(mockRestaurants, ['coffee'])

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Monmouth Coffee')
    })

    it('filters by multiple categories (OR logic)', () => {
      const result = filterByCategories(mockRestaurants, ['coffee', 'pub'])

      expect(result).toHaveLength(2)
      expect(result.map((r) => r.name)).toContain('Monmouth Coffee')
      expect(result.map((r) => r.name)).toContain('The Rake')
    })

    it('includes restaurants that match any selected category', () => {
      // Borough Market Kitchen is lunch AND brunch
      // Selecting lunch should include it
      const result = filterByCategories(mockRestaurants, ['lunch'])

      expect(result.map((r) => r.name)).toContain('Borough Market Kitchen')
      expect(result.map((r) => r.name)).toContain('Padella')
      expect(result.map((r) => r.name)).toContain('The Rake')
    })

    it('returns empty array when no matches', () => {
      // Create a filter that matches nothing in our test data
      const restaurantsWithNoMatch = [
        {
          id: 'r1',
          name: 'Test',
          cuisine: 'Test',
          categories: ['lunch'] as RestaurantCategory[],
        },
      ]

      const result = filterByCategories(restaurantsWithNoMatch, ['pub'])

      expect(result).toHaveLength(0)
    })
  })

  describe('Category matching', () => {
    it('matches when restaurant has selected category', () => {
      const restaurant = mockRestaurants[0] // Borough Market Kitchen - lunch, brunch

      expect(matchesCategory(restaurant, ['lunch'])).toBe(true)
      expect(matchesCategory(restaurant, ['brunch'])).toBe(true)
    })

    it('does not match when restaurant lacks selected category', () => {
      const restaurant = mockRestaurants[0] // Borough Market Kitchen - lunch, brunch

      expect(matchesCategory(restaurant, ['dinner'])).toBe(false)
      expect(matchesCategory(restaurant, ['pub'])).toBe(false)
    })

    it('matches when any selected category matches', () => {
      const restaurant = mockRestaurants[0] // Borough Market Kitchen - lunch, brunch

      // Has brunch but not dinner - should still match
      expect(matchesCategory(restaurant, ['dinner', 'brunch'])).toBe(true)
    })

    it('always matches when no categories selected', () => {
      mockRestaurants.forEach((restaurant) => {
        expect(matchesCategory(restaurant, [])).toBe(true)
      })
    })
  })

  describe('Dinner-only restaurants', () => {
    it('identifies dinner-only restaurants', () => {
      const dinnerOnly = mockRestaurants.filter(
        (r) => r.categories.length === 1 && r.categories[0] === 'dinner'
      )

      expect(dinnerOnly).toHaveLength(1)
      expect(dinnerOnly[0].name).toBe('Hawksmoor Borough')
    })

    it('dinner filter includes multi-category restaurants', () => {
      const dinnerResults = filterByCategories(mockRestaurants, ['dinner'])

      // Should include both Hawksmoor (dinner only) and Padella (lunch, dinner)
      expect(dinnerResults).toHaveLength(2)
      expect(dinnerResults.map((r) => r.name)).toContain('Hawksmoor Borough')
      expect(dinnerResults.map((r) => r.name)).toContain('Padella')
    })
  })

  describe('Brunch category', () => {
    it('finds all brunch spots', () => {
      const brunchResults = filterByCategories(mockRestaurants, ['brunch'])

      expect(brunchResults).toHaveLength(2)
      expect(brunchResults.map((r) => r.name)).toContain('Borough Market Kitchen')
      expect(brunchResults.map((r) => r.name)).toContain('Monmouth Coffee')
    })
  })
})
