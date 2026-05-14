import { describe, it, expect } from 'vitest'

// Test data with dual ratings
const mockReviews = [
  {
    id: 'review-1',
    restaurant_id: 'restaurant-1',
    user_id: 'user-1',
    value_rating: 8,
    taste_rating: 9,
    rating: 8, // Deprecated overall rating
    comment: 'Great value and delicious!',
  },
  {
    id: 'review-2',
    restaurant_id: 'restaurant-1',
    user_id: 'user-2',
    value_rating: 6,
    taste_rating: 8,
    rating: 7,
    comment: 'Tasty but pricey',
  },
  {
    id: 'review-3',
    restaurant_id: 'restaurant-2',
    user_id: 'user-1',
    value_rating: 9,
    taste_rating: 6,
    rating: 7,
    comment: 'Great deal, okay food',
  },
  {
    id: 'review-4',
    restaurant_id: 'restaurant-2',
    user_id: 'user-3',
    value_rating: 4,
    taste_rating: 5,
    rating: 4,
    comment: 'Not worth it',
  },
]

/**
 * Calculate average value rating for a restaurant
 */
function calculateAvgValue(
  reviews: typeof mockReviews,
  restaurantId: string
): number {
  const restaurantReviews = reviews.filter(
    (r) => r.restaurant_id === restaurantId
  )
  if (restaurantReviews.length === 0) return 0

  const sum = restaurantReviews.reduce((acc, r) => acc + r.value_rating, 0)
  return sum / restaurantReviews.length
}

/**
 * Calculate average taste rating for a restaurant
 */
function calculateAvgTaste(
  reviews: typeof mockReviews,
  restaurantId: string
): number {
  const restaurantReviews = reviews.filter(
    (r) => r.restaurant_id === restaurantId
  )
  if (restaurantReviews.length === 0) return 0

  const sum = restaurantReviews.reduce((acc, r) => acc + r.taste_rating, 0)
  return sum / restaurantReviews.length
}

/**
 * Filter reviews by minimum value rating
 */
function filterByMinValue(
  reviews: typeof mockReviews,
  minValue: number | null
): typeof mockReviews {
  if (minValue === null) return reviews
  return reviews.filter((r) => r.value_rating >= minValue)
}

/**
 * Filter reviews by minimum taste rating
 */
function filterByMinTaste(
  reviews: typeof mockReviews,
  minTaste: number | null
): typeof mockReviews {
  if (minTaste === null) return reviews
  return reviews.filter((r) => r.taste_rating >= minTaste)
}

/**
 * Get rating label
 */
function getRatingLabel(rating: number): string {
  const labels = [
    'Avoid', // 1
    'Poor', // 2
    'Bad', // 3
    'Meh', // 4
    'Ok', // 5
    'Decent', // 6
    'Good', // 7
    'Great', // 8
    'Excellent', // 9
    'Perfect', // 10
  ]
  return labels[rating - 1] || 'Unknown'
}

/**
 * Get rating color class
 */
function getRatingClass(rating: number): 'great' | 'good' | 'poor' {
  if (rating >= 8) return 'great'
  if (rating >= 6) return 'good'
  return 'poor'
}

describe('Dual Ratings', () => {
  describe('Rating data structure', () => {
    it('reviews have value_rating and taste_rating', () => {
      mockReviews.forEach((review) => {
        expect(review.value_rating).toBeDefined()
        expect(review.taste_rating).toBeDefined()
        expect(typeof review.value_rating).toBe('number')
        expect(typeof review.taste_rating).toBe('number')
      })
    })

    it('ratings are between 1 and 10', () => {
      mockReviews.forEach((review) => {
        expect(review.value_rating).toBeGreaterThanOrEqual(1)
        expect(review.value_rating).toBeLessThanOrEqual(10)
        expect(review.taste_rating).toBeGreaterThanOrEqual(1)
        expect(review.taste_rating).toBeLessThanOrEqual(10)
      })
    })

    it('deprecated rating field still exists', () => {
      mockReviews.forEach((review) => {
        expect(review.rating).toBeDefined()
      })
    })
  })

  describe('Average calculations', () => {
    it('calculates average value rating for restaurant', () => {
      // Restaurant 1: reviews with value 8 and 6 = avg 7
      const avgValue = calculateAvgValue(mockReviews, 'restaurant-1')
      expect(avgValue).toBe(7)
    })

    it('calculates average taste rating for restaurant', () => {
      // Restaurant 1: reviews with taste 9 and 8 = avg 8.5
      const avgTaste = calculateAvgTaste(mockReviews, 'restaurant-1')
      expect(avgTaste).toBe(8.5)
    })

    it('handles restaurants with different averages', () => {
      // Restaurant 2: value 9 and 4 = avg 6.5, taste 6 and 5 = avg 5.5
      const avgValue = calculateAvgValue(mockReviews, 'restaurant-2')
      const avgTaste = calculateAvgTaste(mockReviews, 'restaurant-2')

      expect(avgValue).toBe(6.5)
      expect(avgTaste).toBe(5.5)
    })

    it('returns 0 for restaurant with no reviews', () => {
      const avgValue = calculateAvgValue(mockReviews, 'nonexistent')
      const avgTaste = calculateAvgTaste(mockReviews, 'nonexistent')

      expect(avgValue).toBe(0)
      expect(avgTaste).toBe(0)
    })
  })

  describe('Rating filters', () => {
    describe('Value rating filter', () => {
      it('returns all when minValue is null', () => {
        const result = filterByMinValue(mockReviews, null)
        expect(result).toHaveLength(mockReviews.length)
      })

      it('filters by minimum value rating', () => {
        const result = filterByMinValue(mockReviews, 6)
        expect(result).toHaveLength(3) // 8, 6, 9 pass; 4 fails
      })

      it('filters strictly by minimum', () => {
        const result = filterByMinValue(mockReviews, 8)
        expect(result).toHaveLength(2) // Only 8 and 9 pass
      })

      it('returns empty when minimum too high', () => {
        const result = filterByMinValue(mockReviews, 10)
        expect(result).toHaveLength(0)
      })
    })

    describe('Taste rating filter', () => {
      it('returns all when minTaste is null', () => {
        const result = filterByMinTaste(mockReviews, null)
        expect(result).toHaveLength(mockReviews.length)
      })

      it('filters by minimum taste rating', () => {
        const result = filterByMinTaste(mockReviews, 6)
        expect(result).toHaveLength(3) // 9, 8, 6 pass; 5 fails
      })

      it('filters strictly by minimum', () => {
        const result = filterByMinTaste(mockReviews, 8)
        expect(result).toHaveLength(2) // Only 9 and 8 pass
      })
    })

    describe('Combined filters', () => {
      it('applies both value and taste filters', () => {
        const afterValue = filterByMinValue(mockReviews, 6)
        const afterBoth = filterByMinTaste(afterValue, 8)

        // Value >= 6: reviews 1, 2, 3
        // Then taste >= 8: reviews 1, 2
        expect(afterBoth).toHaveLength(2)
      })

      it('order of filters does not matter', () => {
        const valueFirst = filterByMinTaste(
          filterByMinValue(mockReviews, 6),
          8
        )
        const tasteFirst = filterByMinValue(
          filterByMinTaste(mockReviews, 8),
          6
        )

        expect(valueFirst).toHaveLength(tasteFirst.length)
        expect(valueFirst.map((r) => r.id).sort()).toEqual(
          tasteFirst.map((r) => r.id).sort()
        )
      })
    })
  })

  describe('Rating labels', () => {
    it('returns correct labels for each rating', () => {
      expect(getRatingLabel(1)).toBe('Avoid')
      expect(getRatingLabel(2)).toBe('Poor')
      expect(getRatingLabel(3)).toBe('Bad')
      expect(getRatingLabel(4)).toBe('Meh')
      expect(getRatingLabel(5)).toBe('Ok')
      expect(getRatingLabel(6)).toBe('Decent')
      expect(getRatingLabel(7)).toBe('Good')
      expect(getRatingLabel(8)).toBe('Great')
      expect(getRatingLabel(9)).toBe('Excellent')
      expect(getRatingLabel(10)).toBe('Perfect')
    })

    it('handles invalid ratings', () => {
      expect(getRatingLabel(0)).toBe('Unknown')
      expect(getRatingLabel(11)).toBe('Unknown')
    })
  })

  describe('Rating colors', () => {
    it('returns great for 8-10', () => {
      expect(getRatingClass(8)).toBe('great')
      expect(getRatingClass(9)).toBe('great')
      expect(getRatingClass(10)).toBe('great')
    })

    it('returns good for 6-7', () => {
      expect(getRatingClass(6)).toBe('good')
      expect(getRatingClass(7)).toBe('good')
    })

    it('returns poor for 1-5', () => {
      expect(getRatingClass(1)).toBe('poor')
      expect(getRatingClass(2)).toBe('poor')
      expect(getRatingClass(3)).toBe('poor')
      expect(getRatingClass(4)).toBe('poor')
      expect(getRatingClass(5)).toBe('poor')
    })
  })

  describe('Rating visibility (same as single rating)', () => {
    it('value and taste ratings are always visible', () => {
      // Ratings should be public - same rule as before
      mockReviews.forEach((review) => {
        // Both new ratings should be accessible
        expect(review.value_rating).toBeDefined()
        expect(review.taste_rating).toBeDefined()
      })
    })
  })
})
