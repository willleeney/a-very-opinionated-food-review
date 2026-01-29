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

/**
 * Review Visibility Workflows
 *
 * NEW MODEL: Visibility is derived from org membership
 * - Org view: Show comments from reviewers who are members of the current org
 * - Global view: Show comments from reviewers who share any org with the viewer
 * - Not signed in: Only ratings visible, no comments or reviewer names
 */
describe('Review Visibility Workflows', () => {
  // Types for review visibility
  type Review = {
    id: string
    restaurant_id: string
    user_id: string  // The reviewer
    rating: number
    comment: string | null
  }

  type ReviewVisibility = {
    rating: boolean
    reviewerName: boolean
    comment: boolean
  }

  // Helper to get all org IDs a user belongs to
  function getUserOrgIds(userId: string, memberships: OrgMembership[]): string[] {
    return memberships
      .filter(m => m.user_id === userId)
      .map(m => m.organisation_id)
  }

  // Helper to get all member user IDs for a set of orgs
  function getOrgMemberIds(orgIds: string[], memberships: OrgMembership[]): string[] {
    return [...new Set(
      memberships
        .filter(m => orgIds.includes(m.organisation_id))
        .map(m => m.user_id)
    )]
  }

  // Function to determine what parts of a review are visible
  // This matches the application logic:
  // - Org view: visibleMemberIds = members of current org
  // - Global view: visibleMemberIds = members of any org the viewer is in
  function getReviewVisibility(
    review: Review,
    visibleMemberIds: string[],
    isSignedIn: boolean
  ): ReviewVisibility {
    // Rating is always visible to everyone
    const ratingVisible = true

    // Comment and reviewer name only visible if:
    // 1. User is signed in
    // 2. The reviewer is in the visible members list
    const canSeeDetails = isSignedIn && visibleMemberIds.includes(review.user_id)

    return {
      rating: ratingVisible,
      reviewerName: canSeeDetails,
      comment: canSeeDetails && review.comment !== null,
    }
  }

  // Mock reviews from different users
  const mockReviews: Review[] = [
    {
      id: 'review-1',
      restaurant_id: 'restaurant-1',
      user_id: 'member-user',  // StackOne member
      rating: 8,
      comment: 'Great food!',
    },
    {
      id: 'review-2',
      restaurant_id: 'restaurant-2',
      user_id: 'other-user',  // Acme member
      rating: 6,
      comment: 'Decent place',
    },
    {
      id: 'review-3',
      restaurant_id: 'restaurant-3',
      user_id: 'admin-user',  // Both StackOne admin
      rating: 9,
      comment: 'Amazing!',
    },
    {
      id: 'review-4',
      restaurant_id: 'restaurant-4',
      user_id: 'unaffiliated-user',  // No org membership
      rating: 5,
      comment: 'Random thoughts',
    },
  ]

  // Extended memberships including unaffiliated user (who has no memberships)
  const extendedMemberships: OrgMembership[] = [
    ...mockMemberships,
    // unaffiliated-user has no membership entries
  ]

  describe('Org view: StackOne page', () => {
    // When viewing /org/stackone, visible members are StackOne members
    const stackOneMemberIds = getOrgMemberIds(['stackone-org'], mockMemberships)

    it('shows comments from StackOne members', () => {
      const review = mockReviews.find(r => r.user_id === 'member-user')!
      const visibility = getReviewVisibility(review, stackOneMemberIds, true)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(true)
      expect(visibility.comment).toBe(true)
    })

    it('hides comments from Acme-only members', () => {
      const review = mockReviews.find(r => r.user_id === 'other-user')!
      const visibility = getReviewVisibility(review, stackOneMemberIds, true)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(false)
      expect(visibility.comment).toBe(false)
    })

    it('shows comments from admin (who is StackOne member)', () => {
      const review = mockReviews.find(r => r.user_id === 'admin-user')!
      const visibility = getReviewVisibility(review, stackOneMemberIds, true)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(true)
      expect(visibility.comment).toBe(true)
    })

    it('hides comments from unaffiliated users', () => {
      const review = mockReviews.find(r => r.user_id === 'unaffiliated-user')!
      const visibility = getReviewVisibility(review, stackOneMemberIds, true)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(false)
      expect(visibility.comment).toBe(false)
    })
  })

  describe('Org view: Acme page', () => {
    const acmeMemberIds = getOrgMemberIds(['acme-org'], mockMemberships)

    it('shows comments from Acme members', () => {
      const review = mockReviews.find(r => r.user_id === 'other-user')!
      const visibility = getReviewVisibility(review, acmeMemberIds, true)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(true)
      expect(visibility.comment).toBe(true)
    })

    it('hides comments from StackOne-only members', () => {
      const review = mockReviews.find(r => r.user_id === 'member-user')!
      const visibility = getReviewVisibility(review, acmeMemberIds, true)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(false)
      expect(visibility.comment).toBe(false)
    })
  })

  describe('Global view: Signed in StackOne member', () => {
    // In global view, get members of all orgs the viewer belongs to
    const viewerOrgIds = getUserOrgIds('member-user', mockMemberships) // ['stackone-org']
    const visibleMemberIds = getOrgMemberIds(viewerOrgIds, mockMemberships)

    it('shows comments from fellow StackOne members', () => {
      const review = mockReviews.find(r => r.user_id === 'member-user')!
      const visibility = getReviewVisibility(review, visibleMemberIds, true)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(true)
      expect(visibility.comment).toBe(true)
    })

    it('hides comments from users in other orgs only', () => {
      const review = mockReviews.find(r => r.user_id === 'other-user')!
      const visibility = getReviewVisibility(review, visibleMemberIds, true)

      expect(visibility.rating).toBe(true)
      expect(visibility.reviewerName).toBe(false)
      expect(visibility.comment).toBe(false)
    })
  })

  describe('Global view: Multi-org user', () => {
    // User who is member of both StackOne and Acme
    const multiOrgMemberships: OrgMembership[] = [
      ...mockMemberships,
      { organisation_id: 'acme-org', user_id: 'multi-user', role: 'member' },
      { organisation_id: 'stackone-org', user_id: 'multi-user', role: 'member' },
    ]
    const viewerOrgIds = getUserOrgIds('multi-user', multiOrgMemberships)
    const visibleMemberIds = getOrgMemberIds(viewerOrgIds, multiOrgMemberships)

    it('can see comments from both StackOne and Acme members', () => {
      const stackOneReview = mockReviews.find(r => r.user_id === 'member-user')!
      const acmeReview = mockReviews.find(r => r.user_id === 'other-user')!

      expect(getReviewVisibility(stackOneReview, visibleMemberIds, true).comment).toBe(true)
      expect(getReviewVisibility(acmeReview, visibleMemberIds, true).comment).toBe(true)
    })

    it('still cannot see comments from unaffiliated users', () => {
      const review = mockReviews.find(r => r.user_id === 'unaffiliated-user')!
      const visibility = getReviewVisibility(review, visibleMemberIds, true)

      expect(visibility.rating).toBe(true)
      expect(visibility.comment).toBe(false)
    })
  })

  describe('Not signed in', () => {
    it('can only see ratings, no comments or reviewer names', () => {
      const anyMemberIds = getOrgMemberIds(['stackone-org', 'acme-org'], mockMemberships)

      for (const review of mockReviews) {
        const visibility = getReviewVisibility(review, anyMemberIds, false)
        expect(visibility.rating).toBe(true)
        expect(visibility.reviewerName).toBe(false)
        expect(visibility.comment).toBe(false)
      }
    })
  })

  describe('Map popup visibility', () => {
    it('hides review comments in map popup when not signed in', () => {
      const memberIds = getOrgMemberIds(['stackone-org'], mockMemberships)
      const review = mockReviews.find(r => r.user_id === 'member-user')!

      const visibility = getReviewVisibility(review, memberIds, false)
      expect(visibility.rating).toBe(true)
      expect(visibility.comment).toBe(false)
    })

    it('shows review comments in map popup when signed in and reviewer is org member', () => {
      const memberIds = getOrgMemberIds(['stackone-org'], mockMemberships)
      const review = mockReviews.find(r => r.user_id === 'member-user')!

      const visibility = getReviewVisibility(review, memberIds, true)
      expect(visibility.rating).toBe(true)
      expect(visibility.comment).toBe(true)
    })
  })

  describe('User joins org - reviews become visible', () => {
    it('reviews become visible to org after user joins', () => {
      // Before: user is not in any org
      const beforeMemberships: OrgMembership[] = [...mockMemberships]
      const visibleBefore = getOrgMemberIds(['stackone-org'], beforeMemberships)

      // New user's review (not yet a member)
      const newUserReview: Review = {
        id: 'new-user-review',
        restaurant_id: 'restaurant-5',
        user_id: 'new-user',
        rating: 7,
        comment: 'Nice spot!',
      }

      expect(getReviewVisibility(newUserReview, visibleBefore, true).comment).toBe(false)

      // After: user joins StackOne
      const afterMemberships: OrgMembership[] = [
        ...mockMemberships,
        { organisation_id: 'stackone-org', user_id: 'new-user', role: 'member' },
      ]
      const visibleAfter = getOrgMemberIds(['stackone-org'], afterMemberships)

      expect(getReviewVisibility(newUserReview, visibleAfter, true).comment).toBe(true)
    })
  })
})
