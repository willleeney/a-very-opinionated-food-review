// Client-side API module — replaces all supabase.from() calls
// Every fetch includes credentials: 'include' for Better Auth cookie sessions

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Restaurant = {
  id: string
  name: string
  cuisine: string
  categories: string[]
  latitude: number | null
  longitude: number | null
  address: string | null
  created_by: string | null
  created_at: string | null
  reviews: Review[]
}

export type Review = {
  id: string
  restaurant_id: string
  user_id: string
  rating: number
  value_rating: number | null
  taste_rating: number | null
  comment: string | null
  dish: string | null
  photo_url: string | null
  organisation_id: string | null
  created_at: string | null
}

export type Profile = {
  id: string
  email: string | null
  display_name: string | null
  is_private: boolean
  avatar_url: string | null
  created_at: string | null
}

export type Organisation = {
  id: string
  name: string
  slug: string
  office_location: unknown | null
  tagline: string | null
  created_at: string | null
}

export type OrgMember = {
  id: string
  organisation_id: string
  user_id: string
  role: 'admin' | 'member'
  created_at: string | null
}

export type OrgMemberWithOrg = OrgMember & { organisation?: Organisation }

export type OrgInvite = {
  id: string
  organisation_id: string
  email: string
  /**
   * The join secret. Only returned when creating an invite or looking one up by
   * token — the listing endpoints deliberately withhold it, so treat it as absent.
   */
  token?: string
  invited_by: string
  created_at: string | null
  expires_at: string | null
  organisation?: Organisation
}

export type OrgRequest = {
  id: string
  organisation_id: string
  user_id: string
  created_at: string | null
  organisation?: Organisation
  /** Joined by the ?org_id= branch for org admins only. */
  requester_display_name?: string | null
  requester_email?: string | null
  requester_avatar_url?: string | null
}

export type Tag = { id: string; name: string; created_at: string | null }

export type ReviewTag = { review_id: string; tag_id: string; tag_name: string }

export type UserFollow = {
  id: string
  follower_id: string
  following_id: string
  created_at: string | null
}

export type FollowRequest = {
  id: string
  requester_id: string
  target_id: string
  created_at: string | null
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function get<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (params)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { credentials: 'include' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function del<T = void>(
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(await res.text())
  // Some DELETE endpoints return 204 with no body
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// ---------------------------------------------------------------------------
// Restaurants
// ---------------------------------------------------------------------------

export function getRestaurants(): Promise<Restaurant[]> {
  return get<Restaurant[]>('/api/data/restaurants')
}

export function searchRestaurantByName(
  name: string,
): Promise<Restaurant | null> {
  return get<Restaurant | null>('/api/data/restaurants', { name })
}

export function createRestaurant(data: {
  name: string
  cuisine: string
  categories: string[]
  latitude?: number | null
  longitude?: number | null
  address?: string | null
}): Promise<Restaurant> {
  return post<Restaurant>('/api/data/restaurants', data)
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export function getReviewsByUserIds(
  userIds: string[],
): Promise<Review[]> {
  return get<Review[]>('/api/data/reviews', {
    user_ids: userIds.join(','),
  })
}

export function createReview(data: {
  restaurant_id: string
  rating: number
  value_rating?: number | null
  taste_rating?: number | null
  comment?: string | null
  dish?: string | null
  photo_url?: string | null
  organisation_id?: string | null
}): Promise<Review> {
  return post<Review>('/api/data/reviews', data)
}

export function updateReview(data: {
  id: string
  rating?: number
  value_rating?: number | null
  taste_rating?: number | null
  comment?: string | null
  dish?: string | null
  photo_url?: string | null
  organisation_id?: string | null
}): Promise<Review> {
  return put<Review>('/api/data/reviews', data)
}

export function updateReviewPhoto(
  id: string,
  photoUrl: string,
): Promise<void> {
  return patch<void>('/api/data/reviews', { id, photo_url: photoUrl })
}

export function deleteReview(id: string): Promise<void> {
  return del('/api/data/reviews', { id })
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export function getTags(): Promise<Tag[]> {
  return get<Tag[]>('/api/data/tags')
}

export function createTag(name: string): Promise<Tag> {
  return post<Tag>('/api/data/tags', { name })
}

// ---------------------------------------------------------------------------
// Review Tags
// ---------------------------------------------------------------------------

export function getReviewTags(): Promise<ReviewTag[]> {
  return get<ReviewTag[]>('/api/data/review-tags')
}

export function createReviewTags(
  items: { review_id: string; tag_id: string }[],
): Promise<void> {
  return post<void>('/api/data/review-tags', { items })
}

export function deleteReviewTags(reviewId: string): Promise<void> {
  return del('/api/data/review-tags', { review_id: reviewId })
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export function getProfiles(ids: string[]): Promise<Profile[]> {
  return get<Profile[]>('/api/data/profiles', { ids: ids.join(',') })
}

export function getProfile(id: string): Promise<Profile> {
  return get<Profile>('/api/data/profiles', { id })
}

/** Directory listing for the "Find people" tab. Excludes the current user. */
export function listProfiles(limit = 100): Promise<Profile[]> {
  return get<Profile[]>('/api/data/profiles', {
    exclude: 'self',
    limit: String(limit),
  })
}

export function updateProfile(data: Partial<Profile>): Promise<void> {
  return put<void>('/api/data/profiles', data)
}

export function deleteProfile(): Promise<void> {
  return del('/api/data/profiles')
}

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

export function getOrgBySlug(slug: string): Promise<Organisation> {
  return get<Organisation>('/api/data/organisations', { slug })
}

export function getOrgsByIds(ids: string[]): Promise<Organisation[]> {
  return get<Organisation[]>('/api/data/organisations', {
    ids: ids.join(','),
  })
}

export function searchOrgs(query: string): Promise<Organisation[]> {
  return get<Organisation[]>('/api/data/organisations', { search: query })
}

export function createOrg(data: {
  name: string
  slug: string
}): Promise<Organisation> {
  return post<Organisation>('/api/data/organisations', data)
}

export function updateOrg(
  id: string,
  data: { name: string },
): Promise<void> {
  return put<void>('/api/data/organisations', { id, ...data })
}

export function deleteOrg(id: string): Promise<void> {
  return del('/api/data/organisations', { id })
}

// ---------------------------------------------------------------------------
// Org Members
// ---------------------------------------------------------------------------

export function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  return get<OrgMember[]>('/api/data/org-members', { org_id: orgId })
}

export function getUserMemberships(
  userId: string,
  includeOrgs?: boolean,
): Promise<OrgMemberWithOrg[]> {
  const params: Record<string, string> = { user_id: userId }
  if (includeOrgs) params.include_orgs = 'true'
  return get<OrgMemberWithOrg[]>('/api/data/org-members', params)
}

export function addOrgMember(data: {
  organisation_id: string
  user_id: string
  role: string
}): Promise<OrgMember> {
  return post<OrgMember>('/api/data/org-members', data)
}

export function updateOrgMember(
  id: string,
  role: string,
): Promise<void> {
  return put<void>('/api/data/org-members', { id, role })
}

export function removeOrgMember(id: string): Promise<void> {
  return del('/api/data/org-members', { id })
}

// ---------------------------------------------------------------------------
// Org Invites
// ---------------------------------------------------------------------------

export function getOrgInvites(orgId: string): Promise<OrgInvite[]> {
  return get<OrgInvite[]>('/api/data/org-invites', { org_id: orgId })
}

export function getInvitesForEmail(
  email: string,
): Promise<OrgInvite[]> {
  return get<OrgInvite[]>('/api/data/org-invites', { email })
}

export function getInviteByToken(token: string): Promise<OrgInvite> {
  return get<OrgInvite>('/api/data/org-invites', { token })
}

export function createInvite(data: {
  organisation_id: string
  email: string
}): Promise<OrgInvite> {
  return post<OrgInvite>('/api/data/org-invites', data)
}

export function deleteInvite(id: string): Promise<void> {
  return del('/api/data/org-invites', { id })
}

// ---------------------------------------------------------------------------
// Org Requests
// ---------------------------------------------------------------------------

export function getOrgRequests(orgId: string): Promise<OrgRequest[]> {
  return get<OrgRequest[]>('/api/data/org-requests', { org_id: orgId })
}

export function getUserRequests(
  userId: string,
): Promise<OrgRequest[]> {
  return get<OrgRequest[]>('/api/data/org-requests', { user_id: userId })
}

export function createOrgRequest(
  organisationId: string,
): Promise<OrgRequest> {
  return post<OrgRequest>('/api/data/org-requests', {
    organisation_id: organisationId,
  })
}

export function deleteOrgRequest(id: string): Promise<void> {
  return del('/api/data/org-requests', { id })
}

// ---------------------------------------------------------------------------
// User Follows
// ---------------------------------------------------------------------------

export function getFollowing(
  userId: string,
): Promise<{ following_id: string }[]> {
  return get<{ following_id: string }[]>('/api/data/user-follows', {
    follower_id: userId,
  })
}

export function getFollowers(
  userId: string,
): Promise<{ follower_id: string }[]> {
  return get<{ follower_id: string }[]>('/api/data/user-follows', {
    following_id: userId,
  })
}

export function follow(
  followingId: string,
  followerId: string,
): Promise<void> {
  return post<void>('/api/data/user-follows', {
    following_id: followingId,
    follower_id: followerId,
  })
}

export function unfollow(
  followerId: string,
  followingId: string,
): Promise<void> {
  return del('/api/data/user-follows', {
    follower_id: followerId,
    following_id: followingId,
  })
}

// ---------------------------------------------------------------------------
// Follow Requests
// ---------------------------------------------------------------------------

export function getIncomingFollowRequests(
  targetId: string,
): Promise<FollowRequest[]> {
  return get<FollowRequest[]>('/api/data/follow-requests', {
    target_id: targetId,
  })
}

export function getOutgoingFollowRequests(
  requesterId: string,
): Promise<{ target_id: string }[]> {
  return get<{ target_id: string }[]>('/api/data/follow-requests', {
    requester_id: requesterId,
  })
}

export function sendFollowRequest(
  targetId: string,
  requesterId: string,
): Promise<void> {
  return post<void>('/api/data/follow-requests', {
    target_id: targetId,
    requester_id: requesterId,
  })
}

export function acceptFollowRequest(
  requesterId: string,
): Promise<void> {
  return post<void>('/api/data/follow-requests', {
    requester_id: requesterId,
    action: 'accept',
  })
}

export function deleteFollowRequest(
  requesterId: string,
  targetId: string,
): Promise<void> {
  return del('/api/data/follow-requests', {
    requester_id: requesterId,
    target_id: targetId,
  })
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export function deleteAccount(): Promise<void> {
  return post<void>('/api/data/delete-account', {})
}
