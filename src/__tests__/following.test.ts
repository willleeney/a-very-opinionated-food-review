import { describe, it, expect } from 'vitest'

// Test data for following
const mockUsers = [
  { id: 'user-1', display_name: 'James Mitchell', email: 'james@example.com', is_private: false },
  { id: 'user-2', display_name: 'Sarah Kim', email: 'sarah@example.com', is_private: true },
  { id: 'user-3', display_name: 'Alex Lee', email: 'alex@example.com', is_private: false },
  { id: 'user-4', display_name: 'Maya Roberts', email: 'maya@example.com', is_private: true },
  { id: 'user-5', display_name: 'Tom Nguyen', email: 'tom@example.com', is_private: false },
]

// Follow requests (for private accounts)
const mockFollowRequests = [
  { id: 'req-1', requester_id: 'user-5', target_id: 'user-2' }, // user-5 requested to follow user-2 (private)
  { id: 'req-2', requester_id: 'user-1', target_id: 'user-4' }, // user-1 requested to follow user-4 (private)
]

// Following relationships: follower_id -> following_id
const mockFollows = [
  { id: 'follow-1', follower_id: 'user-1', following_id: 'user-2' },
  { id: 'follow-2', follower_id: 'user-1', following_id: 'user-3' },
  { id: 'follow-3', follower_id: 'user-1', following_id: 'user-4' },
  { id: 'follow-4', follower_id: 'user-2', following_id: 'user-1' },
  { id: 'follow-5', follower_id: 'user-2', following_id: 'user-3' },
  { id: 'follow-6', follower_id: 'user-3', following_id: 'user-1' },
]

const mockReviews = [
  {
    id: 'review-1',
    user_id: 'user-1',
    restaurant_id: 'restaurant-1',
    value_rating: 8,
    taste_rating: 9,
  },
  {
    id: 'review-2',
    user_id: 'user-2',
    restaurant_id: 'restaurant-1',
    value_rating: 7,
    taste_rating: 8,
  },
  {
    id: 'review-3',
    user_id: 'user-3',
    restaurant_id: 'restaurant-2',
    value_rating: 6,
    taste_rating: 7,
  },
  {
    id: 'review-4',
    user_id: 'user-4',
    restaurant_id: 'restaurant-2',
    value_rating: 9,
    taste_rating: 8,
  },
  {
    id: 'review-5',
    user_id: 'user-5',
    restaurant_id: 'restaurant-3',
    value_rating: 5,
    taste_rating: 6,
  },
]

/**
 * Get list of user IDs that a user is following
 */
function getFollowingIds(
  follows: typeof mockFollows,
  userId: string
): string[] {
  return follows
    .filter((f) => f.follower_id === userId)
    .map((f) => f.following_id)
}

/**
 * Get list of user IDs that follow a user
 */
function getFollowerIds(follows: typeof mockFollows, userId: string): string[] {
  return follows
    .filter((f) => f.following_id === userId)
    .map((f) => f.follower_id)
}

/**
 * Check if user A is following user B
 */
function isFollowing(
  follows: typeof mockFollows,
  followerId: string,
  targetId: string
): boolean {
  return follows.some(
    (f) => f.follower_id === followerId && f.following_id === targetId
  )
}

/**
 * Get follower count
 */
function getFollowerCount(follows: typeof mockFollows, userId: string): number {
  return follows.filter((f) => f.following_id === userId).length
}

/**
 * Get following count
 */
function getFollowingCount(
  follows: typeof mockFollows,
  userId: string
): number {
  return follows.filter((f) => f.follower_id === userId).length
}

/**
 * Filter reviews by followed users only
 */
function filterByFollowing(
  reviews: typeof mockReviews,
  follows: typeof mockFollows,
  currentUserId: string
): typeof mockReviews {
  const followingIds = getFollowingIds(follows, currentUserId)
  return reviews.filter((r) => followingIds.includes(r.user_id))
}

/**
 * Filter reviews by followers only
 */
function filterByFollowers(
  reviews: typeof mockReviews,
  follows: typeof mockFollows,
  currentUserId: string
): typeof mockReviews {
  const followerIds = getFollowerIds(follows, currentUserId)
  return reviews.filter((r) => followerIds.includes(r.user_id))
}

/**
 * Simulate following a user
 */
function followUser(
  follows: typeof mockFollows,
  followerId: string,
  targetId: string
): typeof mockFollows {
  // Can't follow yourself
  if (followerId === targetId) return follows

  // Already following
  if (isFollowing(follows, followerId, targetId)) return follows

  return [
    ...follows,
    {
      id: `follow-new-${Date.now()}`,
      follower_id: followerId,
      following_id: targetId,
    },
  ]
}

/**
 * Simulate unfollowing a user
 */
function unfollowUser(
  follows: typeof mockFollows,
  followerId: string,
  targetId: string
): typeof mockFollows {
  return follows.filter(
    (f) => !(f.follower_id === followerId && f.following_id === targetId)
  )
}

describe('User Following', () => {
  describe('Following relationships', () => {
    it('gets users that a user is following', () => {
      const following = getFollowingIds(mockFollows, 'user-1')

      expect(following).toHaveLength(3)
      expect(following).toContain('user-2')
      expect(following).toContain('user-3')
      expect(following).toContain('user-4')
      expect(following).not.toContain('user-5')
    })

    it('gets users that follow a user', () => {
      const followers = getFollowerIds(mockFollows, 'user-1')

      expect(followers).toHaveLength(2)
      expect(followers).toContain('user-2')
      expect(followers).toContain('user-3')
    })

    it('checks if user is following another', () => {
      expect(isFollowing(mockFollows, 'user-1', 'user-2')).toBe(true)
      expect(isFollowing(mockFollows, 'user-1', 'user-5')).toBe(false)
    })

    it('handles users with no following', () => {
      const following = getFollowingIds(mockFollows, 'user-5')
      expect(following).toHaveLength(0)
    })

    it('handles users with no followers', () => {
      const followers = getFollowerIds(mockFollows, 'user-5')
      expect(followers).toHaveLength(0)
    })
  })

  describe('Follower/Following counts', () => {
    it('counts followers correctly', () => {
      expect(getFollowerCount(mockFollows, 'user-1')).toBe(2)
      expect(getFollowerCount(mockFollows, 'user-2')).toBe(1)
      expect(getFollowerCount(mockFollows, 'user-3')).toBe(2)
      expect(getFollowerCount(mockFollows, 'user-4')).toBe(1)
      expect(getFollowerCount(mockFollows, 'user-5')).toBe(0)
    })

    it('counts following correctly', () => {
      expect(getFollowingCount(mockFollows, 'user-1')).toBe(3)
      expect(getFollowingCount(mockFollows, 'user-2')).toBe(2)
      expect(getFollowingCount(mockFollows, 'user-3')).toBe(1)
      expect(getFollowingCount(mockFollows, 'user-4')).toBe(0)
      expect(getFollowingCount(mockFollows, 'user-5')).toBe(0)
    })
  })

  describe('Following actions', () => {
    it('can follow a user', () => {
      const newFollows = followUser(mockFollows, 'user-5', 'user-1')

      expect(newFollows.length).toBe(mockFollows.length + 1)
      expect(isFollowing(newFollows, 'user-5', 'user-1')).toBe(true)
    })

    it('cannot follow yourself', () => {
      const newFollows = followUser(mockFollows, 'user-1', 'user-1')

      expect(newFollows.length).toBe(mockFollows.length)
      expect(isFollowing(newFollows, 'user-1', 'user-1')).toBe(false)
    })

    it('does not duplicate follows', () => {
      const newFollows = followUser(mockFollows, 'user-1', 'user-2')

      // user-1 already follows user-2
      expect(newFollows.length).toBe(mockFollows.length)
    })

    it('can unfollow a user', () => {
      const newFollows = unfollowUser(mockFollows, 'user-1', 'user-2')

      expect(newFollows.length).toBe(mockFollows.length - 1)
      expect(isFollowing(newFollows, 'user-1', 'user-2')).toBe(false)
    })

    it('unfollowing non-followed user does nothing', () => {
      const newFollows = unfollowUser(mockFollows, 'user-1', 'user-5')

      expect(newFollows.length).toBe(mockFollows.length)
    })
  })

  describe('Filter reviews by following', () => {
    it('shows only reviews from followed users', () => {
      // user-1 follows user-2, user-3, user-4
      const filtered = filterByFollowing(mockReviews, mockFollows, 'user-1')

      expect(filtered).toHaveLength(3)
      expect(filtered.map((r) => r.user_id)).toContain('user-2')
      expect(filtered.map((r) => r.user_id)).toContain('user-3')
      expect(filtered.map((r) => r.user_id)).toContain('user-4')
      expect(filtered.map((r) => r.user_id)).not.toContain('user-1') // Own reviews not included
      expect(filtered.map((r) => r.user_id)).not.toContain('user-5')
    })

    it('returns empty when user follows no one', () => {
      const filtered = filterByFollowing(mockReviews, mockFollows, 'user-5')

      expect(filtered).toHaveLength(0)
    })

    it('excludes own reviews from following filter', () => {
      // user-2 follows user-1 and user-3
      const filtered = filterByFollowing(mockReviews, mockFollows, 'user-2')

      expect(filtered.map((r) => r.user_id)).not.toContain('user-2')
    })
  })

  describe('Filter reviews by followers', () => {
    it('shows only reviews from users who follow me', () => {
      // user-1 is followed by user-2 and user-3
      const filtered = filterByFollowers(mockReviews, mockFollows, 'user-1')

      expect(filtered).toHaveLength(2)
      expect(filtered.map((r) => r.user_id)).toContain('user-2')
      expect(filtered.map((r) => r.user_id)).toContain('user-3')
      expect(filtered.map((r) => r.user_id)).not.toContain('user-1') // Own reviews not included
      expect(filtered.map((r) => r.user_id)).not.toContain('user-4')
      expect(filtered.map((r) => r.user_id)).not.toContain('user-5')
    })

    it('returns empty when user has no followers', () => {
      const filtered = filterByFollowers(mockReviews, mockFollows, 'user-5')

      expect(filtered).toHaveLength(0)
    })

    it('excludes own reviews from followers filter', () => {
      // user-3 is followed by user-1 and user-2
      const filtered = filterByFollowers(mockReviews, mockFollows, 'user-3')

      expect(filtered.map((r) => r.user_id)).not.toContain('user-3')
    })
  })

  describe('Private accounts and follow requests', () => {
    /**
     * Check if a user has a private account
     */
    function isPrivateAccount(userId: string): boolean {
      const user = mockUsers.find((u) => u.id === userId)
      return user?.is_private ?? false
    }

    /**
     * Check if there's a pending follow request
     */
    function hasPendingRequest(
      requests: typeof mockFollowRequests,
      requesterId: string,
      targetId: string
    ): boolean {
      return requests.some(
        (r) => r.requester_id === requesterId && r.target_id === targetId
      )
    }

    /**
     * Get incoming requests for a user (people who want to follow them)
     */
    function getIncomingRequests(
      requests: typeof mockFollowRequests,
      userId: string
    ): typeof mockFollowRequests {
      return requests.filter((r) => r.target_id === userId)
    }

    /**
     * Get outgoing requests for a user (people they want to follow)
     */
    function getOutgoingRequests(
      requests: typeof mockFollowRequests,
      userId: string
    ): typeof mockFollowRequests {
      return requests.filter((r) => r.requester_id === userId)
    }

    /**
     * Simulate requesting to follow a private account
     */
    function requestToFollow(
      requests: typeof mockFollowRequests,
      requesterId: string,
      targetId: string
    ): typeof mockFollowRequests {
      // Can only request to follow private accounts
      if (!isPrivateAccount(targetId)) return requests
      // Already has pending request
      if (hasPendingRequest(requests, requesterId, targetId)) return requests
      // Already following
      if (isFollowing(mockFollows, requesterId, targetId)) return requests

      return [
        ...requests,
        {
          id: `req-new-${Date.now()}`,
          requester_id: requesterId,
          target_id: targetId,
        },
      ]
    }

    /**
     * Simulate accepting a follow request
     */
    function acceptFollowRequest(
      follows: typeof mockFollows,
      requests: typeof mockFollowRequests,
      requestId: string
    ): { follows: typeof mockFollows; requests: typeof mockFollowRequests } {
      const request = requests.find((r) => r.id === requestId)
      if (!request) return { follows, requests }

      // Add the follow relationship
      const newFollows = [
        ...follows,
        {
          id: `follow-new-${Date.now()}`,
          follower_id: request.requester_id,
          following_id: request.target_id,
        },
      ]

      // Remove the request
      const newRequests = requests.filter((r) => r.id !== requestId)

      return { follows: newFollows, requests: newRequests }
    }

    /**
     * Simulate declining a follow request
     */
    function declineFollowRequest(
      requests: typeof mockFollowRequests,
      requestId: string
    ): typeof mockFollowRequests {
      return requests.filter((r) => r.id !== requestId)
    }

    it('identifies private accounts correctly', () => {
      expect(isPrivateAccount('user-1')).toBe(false)
      expect(isPrivateAccount('user-2')).toBe(true)
      expect(isPrivateAccount('user-4')).toBe(true)
      expect(isPrivateAccount('user-5')).toBe(false)
    })

    it('can request to follow a private account', () => {
      // user-3 wants to follow user-2 (private)
      const newRequests = requestToFollow(mockFollowRequests, 'user-3', 'user-2')

      expect(newRequests.length).toBe(mockFollowRequests.length + 1)
      expect(hasPendingRequest(newRequests, 'user-3', 'user-2')).toBe(true)
    })

    it('cannot request to follow a public account', () => {
      // user-2 wants to follow user-1 (public)
      const newRequests = requestToFollow(mockFollowRequests, 'user-2', 'user-1')

      // No request created - should follow directly
      expect(newRequests.length).toBe(mockFollowRequests.length)
    })

    it('cannot duplicate follow requests', () => {
      // user-5 already has a pending request to user-2
      const newRequests = requestToFollow(mockFollowRequests, 'user-5', 'user-2')

      expect(newRequests.length).toBe(mockFollowRequests.length)
    })

    it('gets incoming follow requests for private accounts', () => {
      const incoming = getIncomingRequests(mockFollowRequests, 'user-2')

      expect(incoming).toHaveLength(1)
      expect(incoming[0].requester_id).toBe('user-5')
    })

    it('gets outgoing follow requests', () => {
      const outgoing = getOutgoingRequests(mockFollowRequests, 'user-1')

      expect(outgoing).toHaveLength(1)
      expect(outgoing[0].target_id).toBe('user-4')
    })

    it('can accept a follow request', () => {
      const { follows, requests } = acceptFollowRequest(
        mockFollows,
        mockFollowRequests,
        'req-1' // user-5 wants to follow user-2
      )

      // Request should be removed
      expect(requests.length).toBe(mockFollowRequests.length - 1)
      expect(hasPendingRequest(requests, 'user-5', 'user-2')).toBe(false)

      // Follow relationship should be created
      expect(isFollowing(follows, 'user-5', 'user-2')).toBe(true)
    })

    it('can decline a follow request', () => {
      const newRequests = declineFollowRequest(mockFollowRequests, 'req-1')

      // Request should be removed
      expect(newRequests.length).toBe(mockFollowRequests.length - 1)
      expect(hasPendingRequest(newRequests, 'user-5', 'user-2')).toBe(false)

      // Follow relationship should NOT be created
      expect(isFollowing(mockFollows, 'user-5', 'user-2')).toBe(false)
    })

    it('follow action depends on account privacy', () => {
      // For public account: direct follow
      const publicTarget = mockUsers.find((u) => u.id === 'user-1')
      expect(publicTarget?.is_private).toBe(false)

      // For private account: must request
      const privateTarget = mockUsers.find((u) => u.id === 'user-2')
      expect(privateTarget?.is_private).toBe(true)

      // Simulate the decision logic
      const shouldCreateRequest = (targetId: string) => {
        const target = mockUsers.find((u) => u.id === targetId)
        return target?.is_private ?? false
      }

      expect(shouldCreateRequest('user-1')).toBe(false) // direct follow
      expect(shouldCreateRequest('user-2')).toBe(true)  // create request
    })
  })

  describe('Mutual following', () => {
    it('detects mutual follows', () => {
      // user-1 and user-2 follow each other
      expect(isFollowing(mockFollows, 'user-1', 'user-2')).toBe(true)
      expect(isFollowing(mockFollows, 'user-2', 'user-1')).toBe(true)

      // user-1 and user-3 follow each other
      expect(isFollowing(mockFollows, 'user-1', 'user-3')).toBe(true)
      expect(isFollowing(mockFollows, 'user-3', 'user-1')).toBe(true)
    })

    it('detects one-way follows', () => {
      // user-1 follows user-4, but user-4 doesn't follow back
      expect(isFollowing(mockFollows, 'user-1', 'user-4')).toBe(true)
      expect(isFollowing(mockFollows, 'user-4', 'user-1')).toBe(false)
    })
  })
})
