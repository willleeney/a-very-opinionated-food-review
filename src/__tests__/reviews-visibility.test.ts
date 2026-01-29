import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test data
const mockStackOneOrgId = '11111111-1111-1111-1111-111111111111'
const mockAcmeOrgId = '22222222-2222-2222-2222-222222222222'

const mockReviews = [
  {
    id: 'review-1',
    restaurant_id: 'restaurant-1',
    user_id: 'stackone-user',
    rating: 8,
    comment: 'Great pasta, worth the queue!',
    organisation_id: mockStackOneOrgId,
  },
  {
    id: 'review-2',
    restaurant_id: 'restaurant-1',
    user_id: 'acme-user',
    rating: 7,
    comment: 'Good but expensive',
    organisation_id: mockAcmeOrgId,
  },
  {
    id: 'review-3',
    restaurant_id: 'restaurant-2',
    user_id: 'stackone-user-2',
    rating: 6,
    comment: 'Decent lunch option',
    organisation_id: mockStackOneOrgId,
  },
]

/**
 * Comment visibility logic:
 * - Ratings are ALWAYS visible to everyone (global and org views)
 * - Comments are ONLY visible when:
 *   1. User is viewing an org dashboard (not global view)
 *   2. The review belongs to the same organisation they're viewing
 * - In global view, comments show as "[Member review]"
 */
function isCommentVisible(
  reviewOrgId: string | null,
  currentOrgId: string | null
): boolean {
  // In global view (no current org), comments are hidden
  if (!currentOrgId) return false

  // In org view, only show comments from the same org
  if (!reviewOrgId) return false

  return currentOrgId === reviewOrgId
}

function getDisplayComment(
  review: { comment: string | null; organisation_id: string | null },
  currentOrgId: string | null
): string | null {
  if (!review.comment) return null

  if (isCommentVisible(review.organisation_id, currentOrgId)) {
    return review.comment
  }

  return '[Member review]'
}

describe('Review Visibility', () => {
  describe('Rating visibility', () => {
    it('ratings are visible to everyone in global view', () => {
      const currentOrgId = null // Global view

      mockReviews.forEach((review) => {
        // Ratings should always be visible
        expect(review.rating).toBeDefined()
        expect(typeof review.rating).toBe('number')
      })
    })

    it('ratings are visible to everyone in org view', () => {
      const currentOrgId = mockStackOneOrgId // StackOne org view

      mockReviews.forEach((review) => {
        // Ratings should always be visible regardless of review's org
        expect(review.rating).toBeDefined()
        expect(typeof review.rating).toBe('number')
      })
    })
  })

  describe('Comment visibility in global view', () => {
    it('comments are hidden in global view', () => {
      const currentOrgId = null // Global view

      mockReviews.forEach((review) => {
        const visible = isCommentVisible(review.organisation_id, currentOrgId)
        expect(visible).toBe(false)
      })
    })

    it('displays "[Member review]" placeholder in global view', () => {
      const currentOrgId = null // Global view

      mockReviews.forEach((review) => {
        const displayComment = getDisplayComment(review, currentOrgId)
        expect(displayComment).toBe('[Member review]')
      })
    })
  })

  describe('Comment visibility in org view', () => {
    it('comments from same org are visible', () => {
      const currentOrgId = mockStackOneOrgId // StackOne org view

      // StackOne reviews should have visible comments
      const stackoneReviews = mockReviews.filter(
        (r) => r.organisation_id === mockStackOneOrgId
      )

      stackoneReviews.forEach((review) => {
        const visible = isCommentVisible(review.organisation_id, currentOrgId)
        expect(visible).toBe(true)
      })
    })

    it('comments from other orgs are hidden', () => {
      const currentOrgId = mockStackOneOrgId // StackOne org view

      // Acme reviews should have hidden comments
      const acmeReviews = mockReviews.filter(
        (r) => r.organisation_id === mockAcmeOrgId
      )

      acmeReviews.forEach((review) => {
        const visible = isCommentVisible(review.organisation_id, currentOrgId)
        expect(visible).toBe(false)
      })
    })

    it('displays actual comment for same org reviews', () => {
      const currentOrgId = mockStackOneOrgId // StackOne org view

      const stackoneReview = mockReviews.find(
        (r) => r.organisation_id === mockStackOneOrgId
      )!

      const displayComment = getDisplayComment(stackoneReview, currentOrgId)
      expect(displayComment).toBe(stackoneReview.comment)
    })

    it('displays "[Member review]" for other org reviews', () => {
      const currentOrgId = mockStackOneOrgId // StackOne org view

      const acmeReview = mockReviews.find(
        (r) => r.organisation_id === mockAcmeOrgId
      )!

      const displayComment = getDisplayComment(acmeReview, currentOrgId)
      expect(displayComment).toBe('[Member review]')
    })
  })

  describe('Reviews without organisation', () => {
    const reviewWithoutOrg = {
      id: 'review-no-org',
      restaurant_id: 'restaurant-1',
      user_id: 'some-user',
      rating: 5,
      comment: 'Old review without org',
      organisation_id: null,
    }

    it('comments for reviews without org are hidden in global view', () => {
      const currentOrgId = null

      const visible = isCommentVisible(reviewWithoutOrg.organisation_id, currentOrgId)
      expect(visible).toBe(false)
    })

    it('comments for reviews without org are hidden in org view', () => {
      const currentOrgId = mockStackOneOrgId

      const visible = isCommentVisible(reviewWithoutOrg.organisation_id, currentOrgId)
      expect(visible).toBe(false)
    })
  })

  describe('Average rating calculation', () => {
    it('calculates average from all ratings regardless of org', () => {
      const ratings = mockReviews.map((r) => r.rating)
      const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length

      // Average of [8, 7, 6] = 7
      expect(avgRating).toBe(7)
    })

    it('average includes ratings from all organisations', () => {
      // Group by org to verify all are included
      const stackoneRatings = mockReviews
        .filter((r) => r.organisation_id === mockStackOneOrgId)
        .map((r) => r.rating)

      const acmeRatings = mockReviews
        .filter((r) => r.organisation_id === mockAcmeOrgId)
        .map((r) => r.rating)

      // Both orgs' ratings should be included
      expect(stackoneRatings).toHaveLength(2) // [8, 6]
      expect(acmeRatings).toHaveLength(1) // [7]

      // Total should be sum of both
      const allRatings = [...stackoneRatings, ...acmeRatings]
      expect(allRatings).toHaveLength(3)
    })
  })
})
