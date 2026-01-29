import { describe, it, expect } from 'vitest'

/**
 * Workflow tests for multi-organisation features
 * These test the business logic and permission rules
 */

// Mock user types
type User = {
  id: string
  email: string
}

type OrgMembership = {
  organisation_id: string
  user_id: string
  role: 'admin' | 'member'
}

type Organisation = {
  id: string
  name: string
  slug: string
  tagline: string | null
  office_location: { lat: number; lng: number } | null
}

type Invite = {
  id: string
  organisation_id: string
  email: string
  invited_by: string
  expires_at: string
}

// Permission check functions (matching application logic)
function canViewOrgMembers(userId: string, memberships: OrgMembership[], orgId: string): boolean {
  return memberships.some(m => m.user_id === userId && m.organisation_id === orgId)
}

function canManageOrgMembers(userId: string, memberships: OrgMembership[], orgId: string): boolean {
  return memberships.some(
    m => m.user_id === userId && m.organisation_id === orgId && m.role === 'admin'
  )
}

function canUpdateOrganisation(userId: string, memberships: OrgMembership[], orgId: string): boolean {
  return memberships.some(
    m => m.user_id === userId && m.organisation_id === orgId && m.role === 'admin'
  )
}

function canCreateInvite(userId: string, memberships: OrgMembership[], orgId: string): boolean {
  return memberships.some(
    m => m.user_id === userId && m.organisation_id === orgId && m.role === 'admin'
  )
}

function canAcceptInvite(user: User, invite: Invite): boolean {
  // User can accept if their email matches the invite email
  return user.email.toLowerCase() === invite.email.toLowerCase()
}

function canLeaveOrganisation(
  userId: string,
  memberships: OrgMembership[],
  orgId: string
): { allowed: boolean; reason?: string } {
  const membership = memberships.find(m => m.user_id === userId && m.organisation_id === orgId)

  if (!membership) {
    return { allowed: false, reason: 'Not a member' }
  }

  // Check if user is the only admin
  if (membership.role === 'admin') {
    const orgAdmins = memberships.filter(
      m => m.organisation_id === orgId && m.role === 'admin'
    )
    if (orgAdmins.length === 1) {
      return { allowed: false, reason: 'Cannot leave as sole admin. Transfer admin role first.' }
    }
  }

  return { allowed: true }
}

function isInviteExpired(invite: Invite): boolean {
  return new Date(invite.expires_at) < new Date()
}

function getUserOrganisations(userId: string, memberships: OrgMembership[], orgs: Organisation[]): Organisation[] {
  const userOrgIds = memberships
    .filter(m => m.user_id === userId)
    .map(m => m.organisation_id)
  return orgs.filter(org => userOrgIds.includes(org.id))
}

// Test data
const mockUsers: User[] = [
  { id: 'admin-user', email: 'admin@stackone.com' },
  { id: 'member-user', email: 'member@stackone.com' },
  { id: 'other-user', email: 'other@acme.com' },
  { id: 'unaffiliated-user', email: 'random@example.com' },
]

const mockOrgs: Organisation[] = [
  { id: 'stackone-org', name: 'StackOne', slug: 'stackone', tagline: 'Runway East, London Bridge', office_location: { lat: 51.5047, lng: -0.0886 } },
  { id: 'acme-org', name: 'Acme Corp', slug: 'acme', tagline: 'Central London', office_location: { lat: 51.5074, lng: -0.1278 } },
]

const mockMemberships: OrgMembership[] = [
  { organisation_id: 'stackone-org', user_id: 'admin-user', role: 'admin' },
  { organisation_id: 'stackone-org', user_id: 'member-user', role: 'member' },
  { organisation_id: 'acme-org', user_id: 'other-user', role: 'admin' },
]

const mockInvites: Invite[] = [
  {
    id: 'invite-1',
    organisation_id: 'stackone-org',
    email: 'newbie@example.com',
    invited_by: 'admin-user',
    expires_at: '2027-01-15T00:00:00Z',
  },
  {
    id: 'invite-expired',
    organisation_id: 'stackone-org',
    email: 'expired@example.com',
    invited_by: 'admin-user',
    expires_at: '2020-01-01T00:00:00Z',
  },
]

describe('Admin Permissions', () => {
  describe('Organisation management', () => {
    it('admin can update organisation details', () => {
      const admin = mockUsers.find(u => u.id === 'admin-user')!
      const canUpdate = canUpdateOrganisation(admin.id, mockMemberships, 'stackone-org')
      expect(canUpdate).toBe(true)
    })

    it('member cannot update organisation details', () => {
      const member = mockUsers.find(u => u.id === 'member-user')!
      const canUpdate = canUpdateOrganisation(member.id, mockMemberships, 'stackone-org')
      expect(canUpdate).toBe(false)
    })

    it('non-member cannot update organisation details', () => {
      const outsider = mockUsers.find(u => u.id === 'other-user')!
      const canUpdate = canUpdateOrganisation(outsider.id, mockMemberships, 'stackone-org')
      expect(canUpdate).toBe(false)
    })
  })

  describe('Member management', () => {
    it('admin can manage org members', () => {
      const admin = mockUsers.find(u => u.id === 'admin-user')!
      const canManage = canManageOrgMembers(admin.id, mockMemberships, 'stackone-org')
      expect(canManage).toBe(true)
    })

    it('member cannot manage org members', () => {
      const member = mockUsers.find(u => u.id === 'member-user')!
      const canManage = canManageOrgMembers(member.id, mockMemberships, 'stackone-org')
      expect(canManage).toBe(false)
    })

    it('admin of one org cannot manage another org', () => {
      const acmeAdmin = mockUsers.find(u => u.id === 'other-user')!
      const canManage = canManageOrgMembers(acmeAdmin.id, mockMemberships, 'stackone-org')
      expect(canManage).toBe(false)
    })
  })

  describe('Invite management', () => {
    it('admin can create invites', () => {
      const admin = mockUsers.find(u => u.id === 'admin-user')!
      const canInvite = canCreateInvite(admin.id, mockMemberships, 'stackone-org')
      expect(canInvite).toBe(true)
    })

    it('member cannot create invites', () => {
      const member = mockUsers.find(u => u.id === 'member-user')!
      const canInvite = canCreateInvite(member.id, mockMemberships, 'stackone-org')
      expect(canInvite).toBe(false)
    })
  })
})

describe('Membership Workflows', () => {
  describe('Viewing members', () => {
    it('org member can view other members', () => {
      const member = mockUsers.find(u => u.id === 'member-user')!
      const canView = canViewOrgMembers(member.id, mockMemberships, 'stackone-org')
      expect(canView).toBe(true)
    })

    it('non-member cannot view org members', () => {
      const outsider = mockUsers.find(u => u.id === 'other-user')!
      const canView = canViewOrgMembers(outsider.id, mockMemberships, 'stackone-org')
      expect(canView).toBe(false)
    })
  })

  describe('Leaving organisation', () => {
    it('member can leave organisation', () => {
      const member = mockUsers.find(u => u.id === 'member-user')!
      const result = canLeaveOrganisation(member.id, mockMemberships, 'stackone-org')
      expect(result.allowed).toBe(true)
    })

    it('sole admin cannot leave organisation', () => {
      const admin = mockUsers.find(u => u.id === 'admin-user')!
      const result = canLeaveOrganisation(admin.id, mockMemberships, 'stackone-org')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('sole admin')
    })

    it('admin can leave if another admin exists', () => {
      const membershipsWithTwoAdmins: OrgMembership[] = [
        { organisation_id: 'stackone-org', user_id: 'admin-user', role: 'admin' },
        { organisation_id: 'stackone-org', user_id: 'admin-user-2', role: 'admin' },
        { organisation_id: 'stackone-org', user_id: 'member-user', role: 'member' },
      ]

      const admin = mockUsers.find(u => u.id === 'admin-user')!
      const result = canLeaveOrganisation(admin.id, membershipsWithTwoAdmins, 'stackone-org')
      expect(result.allowed).toBe(true)
    })

    it('non-member cannot leave organisation', () => {
      const outsider = mockUsers.find(u => u.id === 'unaffiliated-user')!
      const result = canLeaveOrganisation(outsider.id, mockMemberships, 'stackone-org')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Not a member')
    })
  })

  describe('User organisations', () => {
    it('returns orgs user is member of', () => {
      const admin = mockUsers.find(u => u.id === 'admin-user')!
      const userOrgs = getUserOrganisations(admin.id, mockMemberships, mockOrgs)

      expect(userOrgs).toHaveLength(1)
      expect(userOrgs[0].slug).toBe('stackone')
    })

    it('returns empty array for unaffiliated user', () => {
      const outsider = mockUsers.find(u => u.id === 'unaffiliated-user')!
      const userOrgs = getUserOrganisations(outsider.id, mockMemberships, mockOrgs)

      expect(userOrgs).toHaveLength(0)
    })

    it('user can be member of multiple orgs', () => {
      const multiOrgMemberships: OrgMembership[] = [
        ...mockMemberships,
        { organisation_id: 'acme-org', user_id: 'admin-user', role: 'member' },
      ]

      const admin = mockUsers.find(u => u.id === 'admin-user')!
      const userOrgs = getUserOrganisations(admin.id, multiOrgMemberships, mockOrgs)

      expect(userOrgs).toHaveLength(2)
      expect(userOrgs.map(o => o.slug).sort()).toEqual(['acme', 'stackone'])
    })
  })
})

describe('Invite Workflows', () => {
  describe('Invite validity', () => {
    it('valid invite is not expired', () => {
      const validInvite = mockInvites.find(i => i.id === 'invite-1')!
      expect(isInviteExpired(validInvite)).toBe(false)
    })

    it('old invite is expired', () => {
      const expiredInvite = mockInvites.find(i => i.id === 'invite-expired')!
      expect(isInviteExpired(expiredInvite)).toBe(true)
    })
  })

  describe('Accepting invites', () => {
    it('user can accept invite sent to their email', () => {
      const newUser: User = { id: 'new-user', email: 'newbie@example.com' }
      const invite = mockInvites.find(i => i.email === 'newbie@example.com')!

      expect(canAcceptInvite(newUser, invite)).toBe(true)
    })

    it('user cannot accept invite sent to different email', () => {
      const wrongUser: User = { id: 'wrong-user', email: 'wrong@example.com' }
      const invite = mockInvites.find(i => i.email === 'newbie@example.com')!

      expect(canAcceptInvite(wrongUser, invite)).toBe(false)
    })

    it('email matching is case-insensitive', () => {
      const newUser: User = { id: 'new-user', email: 'NEWBIE@EXAMPLE.COM' }
      const invite = mockInvites.find(i => i.email === 'newbie@example.com')!

      expect(canAcceptInvite(newUser, invite)).toBe(true)
    })
  })
})

describe('Burger Menu Visibility', () => {
  function getAdminOrgs(userId: string, memberships: OrgMembership[], orgs: Organisation[]): Organisation[] {
    const adminOrgIds = memberships
      .filter(m => m.user_id === userId && m.role === 'admin')
      .map(m => m.organisation_id)
    return orgs.filter(org => adminOrgIds.includes(org.id))
  }

  it('admin sees their org in settings menu', () => {
    const admin = mockUsers.find(u => u.id === 'admin-user')!
    const adminOrgs = getAdminOrgs(admin.id, mockMemberships, mockOrgs)

    expect(adminOrgs).toHaveLength(1)
    expect(adminOrgs[0].slug).toBe('stackone')
  })

  it('member does not see org settings in menu', () => {
    const member = mockUsers.find(u => u.id === 'member-user')!
    const adminOrgs = getAdminOrgs(member.id, mockMemberships, mockOrgs)

    expect(adminOrgs).toHaveLength(0)
  })

  it('multi-org admin sees all their admin orgs', () => {
    const multiOrgMemberships: OrgMembership[] = [
      { organisation_id: 'stackone-org', user_id: 'admin-user', role: 'admin' },
      { organisation_id: 'acme-org', user_id: 'admin-user', role: 'admin' },
    ]

    const admin = mockUsers.find(u => u.id === 'admin-user')!
    const adminOrgs = getAdminOrgs(admin.id, multiOrgMemberships, mockOrgs)

    expect(adminOrgs).toHaveLength(2)
  })
})

describe('Office Location & Distance', () => {
  function hasOfficeLocation(org: Organisation): boolean {
    return org.office_location !== null
  }

  function shouldShowDistanceColumn(org: Organisation | null): boolean {
    return org !== null && hasOfficeLocation(org)
  }

  it('org with office location shows distance column', () => {
    const stackone = mockOrgs.find(o => o.slug === 'stackone')!
    expect(shouldShowDistanceColumn(stackone)).toBe(true)
  })

  it('global view (no org) hides distance column', () => {
    expect(shouldShowDistanceColumn(null)).toBe(false)
  })

  it('org without office location hides distance column', () => {
    const orgNoOffice: Organisation = {
      id: 'no-office-org',
      name: 'Remote Org',
      slug: 'remote',
      tagline: 'Fully remote',
      office_location: null,
    }
    expect(shouldShowDistanceColumn(orgNoOffice)).toBe(false)
  })
})

describe('Review Visibility Workflows', () => {
  // Types for review visibility
  type Review = {
    id: string
    restaurant_id: string
    user_id: string
    rating: number
    comment: string | null
    visibleToOrgs: string[] // Which orgs can see the comment
  }

  type ReviewVisibility = {
    rating: boolean
    reviewerName: boolean
    comment: boolean
  }

  // Mock reviews with different visibility settings
  const mockReviews: Review[] = [
    {
      id: 'review-1',
      restaurant_id: 'restaurant-1',
      user_id: 'member-user',
      rating: 8,
      comment: 'Great food!',
      visibleToOrgs: ['stackone-org'], // Only StackOne can see
    },
    {
      id: 'review-2',
      restaurant_id: 'restaurant-2',
      user_id: 'other-user',
      rating: 6,
      comment: 'Decent place',
      visibleToOrgs: ['acme-org'], // Only Acme can see
    },
    {
      id: 'review-3',
      restaurant_id: 'restaurant-3',
      user_id: 'admin-user',
      rating: 9,
      comment: 'Amazing!',
      visibleToOrgs: ['stackone-org', 'acme-org'], // Both orgs can see
    },
    {
      id: 'review-4',
      restaurant_id: 'restaurant-4',
      user_id: 'member-user',
      rating: 5,
      comment: 'Private thoughts about this place',
      visibleToOrgs: [], // No org can see - private review
    },
  ]

  // Function to determine what parts of a review are visible to a user
  function getReviewVisibility(
    review: Review,
    userOrgIds: string[]
  ): ReviewVisibility {
    // Rating is always visible to everyone
    const ratingVisible = true

    // Comment and reviewer name are only visible if the review is shared with an org the user belongs to
    const hasOrgAccess = review.visibleToOrgs.some(orgId => userOrgIds.includes(orgId))

    return {
      rating: ratingVisible,
      reviewerName: hasOrgAccess,
      comment: hasOrgAccess && review.comment !== null,
    }
  }

  // Helper to get user's org IDs
  function getUserOrgIds(userId: string, memberships: OrgMembership[]): string[] {
    return memberships
      .filter(m => m.user_id === userId)
      .map(m => m.organisation_id)
  }

  describe('Review visibility for StackOne member', () => {
    const stackOneUserOrgIds = getUserOrgIds('member-user', mockMemberships)

    it('can see full details of StackOne-visible review', () => {
      const review = mockReviews.find(r => r.id === 'review-1')!
      const visibility = getReviewVisibility(review, stackOneUserOrgIds)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(true)
      expect(visibility.comment).toBe(true)
    })

    it('can only see rating of Acme-visible review', () => {
      const review = mockReviews.find(r => r.id === 'review-2')!
      const visibility = getReviewVisibility(review, stackOneUserOrgIds)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(false)
      expect(visibility.comment).toBe(false)
    })

    it('can see full details of multi-org visible review', () => {
      const review = mockReviews.find(r => r.id === 'review-3')!
      const visibility = getReviewVisibility(review, stackOneUserOrgIds)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(true)
      expect(visibility.comment).toBe(true)
    })

    it('can only see rating of private review (no orgs selected)', () => {
      const review = mockReviews.find(r => r.id === 'review-4')!
      const visibility = getReviewVisibility(review, stackOneUserOrgIds)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(false)
      expect(visibility.comment).toBe(false)
    })
  })

  describe('Review visibility for Acme member', () => {
    const acmeUserOrgIds = getUserOrgIds('other-user', mockMemberships)

    it('can only see rating of StackOne-visible review', () => {
      const review = mockReviews.find(r => r.id === 'review-1')!
      const visibility = getReviewVisibility(review, acmeUserOrgIds)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(false)
      expect(visibility.comment).toBe(false)
    })

    it('can see full details of Acme-visible review', () => {
      const review = mockReviews.find(r => r.id === 'review-2')!
      const visibility = getReviewVisibility(review, acmeUserOrgIds)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(true)
      expect(visibility.comment).toBe(true)
    })

    it('can see full details of multi-org visible review', () => {
      const review = mockReviews.find(r => r.id === 'review-3')!
      const visibility = getReviewVisibility(review, acmeUserOrgIds)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(true)
      expect(visibility.comment).toBe(true)
    })
  })

  describe('Review visibility for unaffiliated user', () => {
    const unaffiliatedUserOrgIds: string[] = []

    it('can only see rating - no comment or name', () => {
      const review = mockReviews.find(r => r.id === 'review-1')!
      const visibility = getReviewVisibility(review, unaffiliatedUserOrgIds)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(false)
      expect(visibility.comment).toBe(false)
    })

    it('cannot see any comments regardless of review', () => {
      for (const review of mockReviews) {
        const visibility = getReviewVisibility(review, unaffiliatedUserOrgIds)
        expect(visibility.rating).toBe(true)
        expect(visibility.reviewerName).toBe(false)
        expect(visibility.comment).toBe(false)
      }
    })
  })

  describe('Review visibility for multi-org user', () => {
    // User who is member of both orgs
    const multiOrgMemberships: OrgMembership[] = [
      { organisation_id: 'stackone-org', user_id: 'multi-user', role: 'member' },
      { organisation_id: 'acme-org', user_id: 'multi-user', role: 'member' },
    ]
    const multiOrgUserOrgIds = getUserOrgIds('multi-user', multiOrgMemberships)

    it('can see all reviews shared with either org', () => {
      for (const review of mockReviews.filter(r => r.visibleToOrgs.length > 0)) {
        const visibility = getReviewVisibility(review, multiOrgUserOrgIds)
        expect(visibility.rating).toBe(true)
        expect(visibility.reviewerName).toBe(true)
        expect(visibility.comment).toBe(true)
      }
    })

    it('still cannot see private reviews', () => {
      const privateReview = mockReviews.find(r => r.id === 'review-4')!
      const visibility = getReviewVisibility(privateReview, multiOrgUserOrgIds)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(false)
      expect(visibility.comment).toBe(false)
    })
  })

  describe('User story: Adding a review with visibility options', () => {
    it('user can create review visible to their org', () => {
      const userId = 'member-user'
      const userOrgIds = getUserOrgIds(userId, mockMemberships)

      // User creates review, selects StackOne as visible org
      const newReview: Review = {
        id: 'new-review',
        restaurant_id: 'restaurant-5',
        user_id: userId,
        rating: 7,
        comment: 'Nice lunch spot',
        visibleToOrgs: ['stackone-org'],
      }

      // StackOne member can see it
      const stackOneVisibility = getReviewVisibility(newReview, userOrgIds)
      expect(stackOneVisibility.comment).toBe(true)

      // Acme member cannot see comment
      const acmeUserOrgIds = getUserOrgIds('other-user', mockMemberships)
      const acmeVisibility = getReviewVisibility(newReview, acmeUserOrgIds)
      expect(acmeVisibility.rating).toBe(true)
      expect(acmeVisibility.comment).toBe(false)
    })

    it('user can create private review (visible to no orgs)', () => {
      const userId = 'member-user'

      // User creates review with no orgs selected
      const privateReview: Review = {
        id: 'private-review',
        restaurant_id: 'restaurant-5',
        user_id: userId,
        rating: 3,
        comment: 'Terrible experience but dont want to share publicly',
        visibleToOrgs: [],
      }

      // Even the user's own org cannot see the comment
      const stackOneUserOrgIds = getUserOrgIds('member-user', mockMemberships)
      const visibility = getReviewVisibility(privateReview, stackOneUserOrgIds)

      expect(visibility.rating).toBe(true)
      expect(visibility.comment).toBe(false)
    })

    it('multi-org user can share review with multiple orgs', () => {
      const multiOrgMemberships: OrgMembership[] = [
        { organisation_id: 'stackone-org', user_id: 'multi-user', role: 'member' },
        { organisation_id: 'acme-org', user_id: 'multi-user', role: 'member' },
      ]

      // User shares review with both their orgs
      const sharedReview: Review = {
        id: 'shared-review',
        restaurant_id: 'restaurant-5',
        user_id: 'multi-user',
        rating: 8,
        comment: 'Great for team lunches!',
        visibleToOrgs: ['stackone-org', 'acme-org'],
      }

      // Both StackOne and Acme members can see it
      const stackOneUserOrgIds = getUserOrgIds('member-user', mockMemberships)
      const acmeUserOrgIds = getUserOrgIds('other-user', mockMemberships)

      expect(getReviewVisibility(sharedReview, stackOneUserOrgIds).comment).toBe(true)
      expect(getReviewVisibility(sharedReview, acmeUserOrgIds).comment).toBe(true)
    })
  })
})
