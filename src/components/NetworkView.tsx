import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { OrganisationWithMembership, Organisation } from '../lib/database.types'
import { TopNav } from './TopNav'

type TabType = 'following' | 'followers' | 'requests' | 'find'

interface UserWithStats {
  id: string
  name: string
  email: string | null
  isPrivate: boolean
  reviewCount: number
  avgRating: number | null
  lowestRating: number | null
  highestRating: number | null
  isFollowing: boolean
  isFollower: boolean
  hasRequestedToFollow: boolean
  hasPendingRequest: boolean // They requested to follow me
}

interface FollowRequest {
  id: string
  requester_id: string
  target_id: string
  created_at: string | null
}

function getRatingClass(rating: number): string {
  if (rating >= 8) return 'rating-great'
  if (rating >= 6) return 'rating-good'
  return 'rating-poor'
}

export function NetworkView(): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [userOrgs, setUserOrgs] = useState<OrganisationWithMembership[]>([])
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('following')
  const [searchQuery, setSearchQuery] = useState('')

  // Data
  const [followingUsers, setFollowingUsers] = useState<UserWithStats[]>([])
  const [followerUsers, setFollowerUsers] = useState<UserWithStats[]>([])
  const [pendingRequests, setPendingRequests] = useState<UserWithStats[]>([])
  const [allUsers, setAllUsers] = useState<UserWithStats[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set())
  const [outgoingRequestIds, setOutgoingRequestIds] = useState<Set<string>>(new Set())
  const [incomingRequests, setIncomingRequests] = useState<FollowRequest[]>([])

  // Fetch user stats (reviews, ratings)
  const fetchUserStats = useCallback(async (userIds: string[]): Promise<Map<string, { reviewCount: number; avgRating: number | null; lowestRating: number | null; highestRating: number | null }>> => {
    const stats = new Map<string, { reviewCount: number; avgRating: number | null; lowestRating: number | null; highestRating: number | null }>()

    if (userIds.length === 0) return stats

    const { data: reviews } = await supabase
      .from('reviews')
      .select('user_id, rating')
      .in('user_id', userIds)

    if (reviews) {
      // Group reviews by user
      const reviewsByUser = new Map<string, number[]>()
      for (const review of reviews) {
        if (!review.user_id || review.rating === null) continue
        if (!reviewsByUser.has(review.user_id)) {
          reviewsByUser.set(review.user_id, [])
        }
        reviewsByUser.get(review.user_id)!.push(review.rating)
      }

      // Calculate stats
      for (const userId of userIds) {
        const ratings = reviewsByUser.get(userId) || []
        stats.set(userId, {
          reviewCount: ratings.length,
          avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
          lowestRating: ratings.length > 0 ? Math.min(...ratings) : null,
          highestRating: ratings.length > 0 ? Math.max(...ratings) : null,
        })
      }
    }

    return stats
  }, [])

  // Fetch following list
  const fetchFollowing = useCallback(async (userId: string) => {
    const { data: follows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)

    if (follows && follows.length > 0) {
      const ids = follows.map(f => f.following_id)
      setFollowingIds(new Set(ids))

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email, is_private')
        .in('id', ids)

      if (profiles) {
        const stats = await fetchUserStats(ids)
        const users: UserWithStats[] = profiles.map(p => ({
          id: p.id,
          name: p.display_name || p.email?.split('@')[0] || p.id.slice(0, 8),
          email: p.email,
          isPrivate: p.is_private || false,
          ...stats.get(p.id) || { reviewCount: 0, avgRating: null, lowestRating: null, highestRating: null },
          isFollowing: true,
          isFollower: false,
          hasRequestedToFollow: false,
          hasPendingRequest: false,
        }))
        setFollowingUsers(users)
      }
    } else {
      setFollowingIds(new Set())
      setFollowingUsers([])
    }
  }, [fetchUserStats])

  // Fetch followers list (needs followingIds to check if we follow them back)
  const fetchFollowers = useCallback(async (userId: string, currentFollowingIds: Set<string>, currentOutgoingRequestIds: Set<string>) => {
    const { data: follows } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('following_id', userId)

    if (follows && follows.length > 0) {
      const ids = follows.map(f => f.follower_id)
      setFollowerIds(new Set(ids))

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email, is_private')
        .in('id', ids)

      if (profiles) {
        const stats = await fetchUserStats(ids)
        const users: UserWithStats[] = profiles.map(p => ({
          id: p.id,
          name: p.display_name || p.email?.split('@')[0] || p.id.slice(0, 8),
          email: p.email,
          isPrivate: p.is_private || false,
          ...stats.get(p.id) || { reviewCount: 0, avgRating: null, lowestRating: null, highestRating: null },
          isFollowing: currentFollowingIds.has(p.id),
          isFollower: true,
          hasRequestedToFollow: currentOutgoingRequestIds.has(p.id),
          hasPendingRequest: false,
        }))
        setFollowerUsers(users)
      }
    } else {
      setFollowerIds(new Set())
      setFollowerUsers([])
    }
  }, [fetchUserStats])

  // Fetch pending follow requests (people who want to follow me)
  const fetchIncomingRequests = useCallback(async (userId: string) => {
    const { data: requests } = await supabase
      .from('follow_requests')
      .select('*')
      .eq('target_id', userId)

    if (requests && requests.length > 0) {
      setIncomingRequests(requests)
      const ids = requests.map(r => r.requester_id)

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email, is_private')
        .in('id', ids)

      if (profiles) {
        const stats = await fetchUserStats(ids)
        const users: UserWithStats[] = profiles.map(p => ({
          id: p.id,
          name: p.display_name || p.email?.split('@')[0] || p.id.slice(0, 8),
          email: p.email,
          isPrivate: p.is_private || false,
          ...stats.get(p.id) || { reviewCount: 0, avgRating: null, lowestRating: null, highestRating: null },
          isFollowing: false,
          isFollower: false,
          hasRequestedToFollow: false,
          hasPendingRequest: true,
        }))
        setPendingRequests(users)
      }
    } else {
      setIncomingRequests([])
      setPendingRequests([])
    }
  }, [fetchUserStats])

  // Fetch outgoing requests (people I've requested to follow)
  const fetchOutgoingRequests = useCallback(async (userId: string) => {
    const { data: requests } = await supabase
      .from('follow_requests')
      .select('target_id')
      .eq('requester_id', userId)

    if (requests && requests.length > 0) {
      setOutgoingRequestIds(new Set(requests.map(r => r.target_id)))
    } else {
      setOutgoingRequestIds(new Set())
    }
  }, [])

  // Fetch all users for "Find" tab
  const fetchAllUsers = useCallback(async (currentUserId: string, followingSet: Set<string>, outgoingSet: Set<string>) => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email, is_private')
      .neq('id', currentUserId)
      .limit(100)

    if (profiles) {
      const ids = profiles.map(p => p.id)
      const stats = await fetchUserStats(ids)
      const users: UserWithStats[] = profiles.map(p => ({
        id: p.id,
        name: p.display_name || p.email?.split('@')[0] || p.id.slice(0, 8),
        email: p.email,
        isPrivate: p.is_private || false,
        ...stats.get(p.id) || { reviewCount: 0, avgRating: null, lowestRating: null, highestRating: null },
        isFollowing: followingSet.has(p.id),
        isFollower: false,
        hasRequestedToFollow: outgoingSet.has(p.id),
        hasPendingRequest: false,
      }))
      setAllUsers(users)
    }
  }, [fetchUserStats])

  // Follow a user (direct follow for open accounts)
  const handleFollow = async (targetUserId: string, targetIsPrivate: boolean) => {
    if (!user) return

    try {
      if (targetIsPrivate) {
        // Send follow request for private accounts
        const { error } = await supabase
          .from('follow_requests')
          .insert({ requester_id: user.id, target_id: targetUserId })

        if (error) throw error

        // Update local state
        setOutgoingRequestIds(prev => new Set([...prev, targetUserId]))
        setAllUsers(prev => prev.map(u =>
          u.id === targetUserId ? { ...u, hasRequestedToFollow: true } : u
        ))
        setFollowerUsers(prev => prev.map(u =>
          u.id === targetUserId ? { ...u, hasRequestedToFollow: true } : u
        ))
      } else {
        // Direct follow for open accounts
        const { error } = await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: targetUserId })

        if (error) throw error

        // Update local state
        setFollowingIds(prev => new Set([...prev, targetUserId]))
        setAllUsers(prev => prev.map(u =>
          u.id === targetUserId ? { ...u, isFollowing: true } : u
        ))
        setFollowerUsers(prev => prev.map(u =>
          u.id === targetUserId ? { ...u, isFollowing: true } : u
        ))

        // Add to following list
        const targetUser = allUsers.find(u => u.id === targetUserId) || followerUsers.find(u => u.id === targetUserId)
        if (targetUser) {
          setFollowingUsers(prev => [...prev, { ...targetUser, isFollowing: true }])
        }
      }
    } catch (err) {
      console.error('Failed to follow user:', err)
    }
  }

  // Cancel follow request
  const handleCancelRequest = async (targetUserId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', user.id)
        .eq('target_id', targetUserId)

      if (error) throw error

      // Update local state
      setOutgoingRequestIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(targetUserId)
        return newSet
      })
      setAllUsers(prev => prev.map(u =>
        u.id === targetUserId ? { ...u, hasRequestedToFollow: false } : u
      ))
      setFollowerUsers(prev => prev.map(u =>
        u.id === targetUserId ? { ...u, hasRequestedToFollow: false } : u
      ))
    } catch (err) {
      console.error('Failed to cancel request:', err)
    }
  }

  // Accept follow request
  const handleAcceptRequest = async (requesterId: string) => {
    if (!user) return

    try {
      // Use the database function to accept (bypasses RLS)
      const { data, error } = await supabase.rpc('accept_follow_request', {
        requester: requesterId
      })

      if (error) throw error
      if (!data) throw new Error('Request not found')

      // Update local state
      setIncomingRequests(prev => prev.filter(r => r.requester_id !== requesterId))
      setPendingRequests(prev => prev.filter(u => u.id !== requesterId))
      setFollowerIds(prev => new Set([...prev, requesterId]))

      // Add to followers list
      const requesterUser = pendingRequests.find(u => u.id === requesterId)
      if (requesterUser) {
        setFollowerUsers(prev => [...prev, { ...requesterUser, isFollower: true, hasPendingRequest: false }])
      }
    } catch (err) {
      console.error('Failed to accept request:', err)
    }
  }

  // Decline follow request
  const handleDeclineRequest = async (requesterId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', requesterId)
        .eq('target_id', user.id)

      if (error) throw error

      // Update local state
      setIncomingRequests(prev => prev.filter(r => r.requester_id !== requesterId))
      setPendingRequests(prev => prev.filter(u => u.id !== requesterId))
    } catch (err) {
      console.error('Failed to decline request:', err)
    }
  }

  // Unfollow a user
  const handleUnfollow = async (targetUserId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)

      if (error) throw error

      // Update local state
      setFollowingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(targetUserId)
        return newSet
      })

      // Update user lists
      setFollowingUsers(prev => prev.filter(u => u.id !== targetUserId))
      setAllUsers(prev => prev.map(u =>
        u.id === targetUserId ? { ...u, isFollowing: false } : u
      ))
      setFollowerUsers(prev => prev.map(u =>
        u.id === targetUserId ? { ...u, isFollowing: false } : u
      ))
    } catch (err) {
      console.error('Failed to unfollow user:', err)
    }
  }

  // Remove a follower (they unfollow you)
  const handleRemoveFollower = async (followerId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', user.id)

      if (error) throw error

      // Update local state
      setFollowerIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(followerId)
        return newSet
      })

      // Remove from followers list
      setFollowerUsers(prev => prev.filter(u => u.id !== followerId))
    } catch (err) {
      console.error('Failed to remove follower:', err)
    }
  }

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      const { data } = await supabase.auth.getUser()
      if (!isMounted) return

      if (data.user) {
        setUser(data.user)

        // Fetch user's privacy setting
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_private')
          .eq('id', data.user.id)
          .single()

        if (profile) {
          setIsPrivate(profile.is_private || false)
        }

        // First fetch following and outgoing requests (needed for followers)
        const [followingResult, outgoingResult] = await Promise.all([
          supabase.from('user_follows').select('following_id').eq('follower_id', data.user.id),
          supabase.from('follow_requests').select('target_id').eq('requester_id', data.user.id),
        ])

        const currentFollowingIds = new Set<string>(
          followingResult.data?.map(f => f.following_id) || []
        )
        const currentOutgoingRequestIds = new Set<string>(
          outgoingResult.data?.map(r => r.target_id) || []
        )

        // Update state
        setFollowingIds(currentFollowingIds)
        setOutgoingRequestIds(currentOutgoingRequestIds)

        // Now fetch all lists (fetchFollowing will re-fetch but that's ok for now)
        await Promise.all([
          fetchFollowing(data.user.id),
          fetchFollowers(data.user.id, currentFollowingIds, currentOutgoingRequestIds),
          fetchIncomingRequests(data.user.id),
        ])

        // Fetch user's orgs for TopNav
        const { data: memberships } = await supabase
          .from('organisation_members')
          .select('role, organisations(*)')
          .eq('user_id', data.user.id)

        if (memberships) {
          const orgs: OrganisationWithMembership[] = memberships.map((m) => ({
            ...(m.organisations as Organisation),
            role: m.role as 'admin' | 'member',
          }))
          setUserOrgs(orgs)
        }
      }
      setLoading(false)
    }

    init()

    return () => { isMounted = false }
  }, [fetchFollowing, fetchFollowers, fetchIncomingRequests])

  // Fetch all users when switching to Find tab
  useEffect(() => {
    if (activeTab === 'find' && user && allUsers.length === 0) {
      fetchAllUsers(user.id, followingIds, outgoingRequestIds)
    }
  }, [activeTab, user, allUsers.length, followingIds, outgoingRequestIds, fetchAllUsers])

  // Update allUsers when followingIds/outgoingRequestIds changes
  useEffect(() => {
    if (allUsers.length > 0) {
      setAllUsers(prev => prev.map(u => ({
        ...u,
        isFollowing: followingIds.has(u.id),
        hasRequestedToFollow: outgoingRequestIds.has(u.id),
      })))
    }
  }, [followingIds, outgoingRequestIds])

  // Update followerUsers when followingIds changes
  useEffect(() => {
    if (followerUsers.length > 0) {
      setFollowerUsers(prev => prev.map(u => ({
        ...u,
        isFollowing: followingIds.has(u.id),
        hasRequestedToFollow: outgoingRequestIds.has(u.id),
      })))
    }
  }, [followingIds, outgoingRequestIds])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ padding: '120px 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '2.5rem', marginBottom: '16px' }}>
            Network
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Sign in to see your followers and who you follow
          </p>
          <a href="/login" className="btn btn-accent">Sign in</a>
        </div>
      </div>
    )
  }

  // Filter users based on search
  const filterUsers = (users: UserWithStats[]) => {
    if (!searchQuery) return users
    const query = searchQuery.toLowerCase()
    return users.filter(u =>
      u.name.toLowerCase().includes(query) ||
      (u.email && u.email.toLowerCase().includes(query))
    )
  }

  const displayUsers = activeTab === 'following'
    ? filterUsers(followingUsers)
    : activeTab === 'followers'
      ? filterUsers(followerUsers)
      : activeTab === 'requests'
        ? filterUsers(pendingRequests)
        : filterUsers(allUsers.filter(u => !followingIds.has(u.id) && !outgoingRequestIds.has(u.id)))

  const requestCount = pendingRequests.length

  return (
    <div>
      <TopNav user={user} userOrgs={userOrgs} />

      {/* Header */}
      <section style={{ paddingTop: '140px', paddingBottom: '40px' }}>
        <div className="container">
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 400, marginBottom: '8px' }}>
            Your Network
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            People you follow and people following you
            {isPrivate && (
              <span style={{ marginLeft: '12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', background: 'var(--bg-warm)', padding: '4px 8px' }}>
                Private account
              </span>
            )}
          </p>
        </div>
      </section>

      {/* Tabs */}
      <div className="container">
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '32px' }}>
          <button
            onClick={() => setActiveTab('following')}
            style={{
              padding: '16px 32px',
              fontSize: '13px',
              fontWeight: 500,
              color: activeTab === 'following' ? 'var(--text)' : 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            Following
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              {followingUsers.length}
            </span>
            {activeTab === 'following' && (
              <span style={{ position: 'absolute', bottom: '-1px', left: 0, right: 0, height: '2px', background: 'var(--accent)' }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            style={{
              padding: '16px 32px',
              fontSize: '13px',
              fontWeight: 500,
              color: activeTab === 'followers' ? 'var(--text)' : 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            Followers
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              {followerUsers.length}
            </span>
            {activeTab === 'followers' && (
              <span style={{ position: 'absolute', bottom: '-1px', left: 0, right: 0, height: '2px', background: 'var(--accent)' }} />
            )}
          </button>
          {isPrivate && (
            <button
              onClick={() => setActiveTab('requests')}
              style={{
                padding: '16px 32px',
                fontSize: '13px',
                fontWeight: 500,
                color: activeTab === 'requests' ? 'var(--text)' : 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              Requests
              {requestCount > 0 && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  color: 'white',
                  background: 'var(--accent)',
                  padding: '2px 6px',
                  marginLeft: '8px',
                }}>
                  {requestCount}
                </span>
              )}
              {activeTab === 'requests' && (
                <span style={{ position: 'absolute', bottom: '-1px', left: 0, right: 0, height: '2px', background: 'var(--accent)' }} />
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('find')}
            style={{
              padding: '16px 32px',
              fontSize: '13px',
              fontWeight: 500,
              color: activeTab === 'find' ? 'var(--text)' : 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            Find
            {activeTab === 'find' && (
              <span style={{ position: 'absolute', bottom: '-1px', left: 0, right: 0, height: '2px', background: 'var(--accent)' }} />
            )}
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === 'following' ? 'following' : activeTab === 'followers' ? 'followers' : activeTab === 'requests' ? 'requests' : 'people'}...`}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              padding: '12px 0',
              fontSize: '14px',
              fontFamily: 'inherit',
              color: 'var(--text)',
              width: '100%',
              maxWidth: '300px',
              outline: 'none',
            }}
          />
        </div>

        {/* Table */}
        {displayUsers.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Person</th>
                <th style={{ width: '10%' }}>Reviews</th>
                <th style={{ width: '12%' }}>Avg Rating</th>
                <th style={{ width: '12%' }}>Lowest</th>
                <th style={{ width: '12%' }}>Highest</th>
                <th style={{ width: '24%' }}></th>
              </tr>
            </thead>
            <tbody>
              {displayUsers.map((person) => (
                <tr key={person.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        background: 'var(--accent-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 500,
                        color: 'var(--accent)',
                        fontSize: '14px',
                      }}>
                        {person.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {person.name}
                          {person.isPrivate && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }} title="Private account">
                              🔒
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="mono">{person.reviewCount}</span>
                  </td>
                  <td>
                    {person.avgRating !== null ? (
                      <span className={`mono ${getRatingClass(person.avgRating)}`}>
                        {person.avgRating.toFixed(1)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {person.lowestRating !== null ? (
                      <span className={`mono ${getRatingClass(person.lowestRating)}`}>
                        {person.lowestRating}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {person.highestRating !== null ? (
                      <span className={`mono ${getRatingClass(person.highestRating)}`}>
                        {person.highestRating}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                    {activeTab === 'following' ? (
                      <button
                        onClick={() => handleUnfollow(person.id)}
                        className="btn"
                        style={{
                          padding: '6px 14px',
                          fontSize: '10px',
                          borderColor: 'var(--border)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Unfollow
                      </button>
                    ) : activeTab === 'followers' ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {person.isFollowing ? (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Following
                          </span>
                        ) : person.hasRequestedToFollow ? (
                          <button
                            onClick={() => handleCancelRequest(person.id)}
                            className="btn"
                            style={{ padding: '6px 14px', fontSize: '10px', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                          >
                            Requested
                          </button>
                        ) : (
                          <button
                            onClick={() => handleFollow(person.id, person.isPrivate)}
                            className="btn btn-accent"
                            style={{ padding: '6px 14px', fontSize: '10px' }}
                          >
                            {person.isPrivate ? 'Request' : 'Follow back'}
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveFollower(person.id)}
                          className="btn"
                          style={{ padding: '6px 14px', fontSize: '10px', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                          title="Remove this follower"
                        >
                          Remove
                        </button>
                      </div>
                    ) : activeTab === 'requests' ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleAcceptRequest(person.id)}
                          className="btn btn-accent"
                          style={{ padding: '6px 14px', fontSize: '10px' }}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(person.id)}
                          className="btn"
                          style={{ padding: '6px 14px', fontSize: '10px', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      person.hasRequestedToFollow ? (
                        <button
                          onClick={() => handleCancelRequest(person.id)}
                          className="btn"
                          style={{ padding: '6px 14px', fontSize: '10px', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        >
                          Requested
                        </button>
                      ) : (
                        <button
                          onClick={() => handleFollow(person.id, person.isPrivate)}
                          className="btn btn-accent"
                          style={{ padding: '6px 14px', fontSize: '10px' }}
                        >
                          {person.isPrivate ? 'Request' : 'Follow'}
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            {activeTab === 'following' && searchQuery ? (
              <p>No following matching "{searchQuery}"</p>
            ) : activeTab === 'following' ? (
              <>
                <p style={{ marginBottom: '16px' }}>You're not following anyone yet</p>
                <button onClick={() => setActiveTab('find')} className="btn btn-accent">
                  Find people to follow
                </button>
              </>
            ) : activeTab === 'followers' && searchQuery ? (
              <p>No followers matching "{searchQuery}"</p>
            ) : activeTab === 'followers' ? (
              <p>No followers yet</p>
            ) : activeTab === 'requests' && searchQuery ? (
              <p>No requests matching "{searchQuery}"</p>
            ) : activeTab === 'requests' ? (
              <p>No pending follow requests</p>
            ) : searchQuery ? (
              <p>No people matching "{searchQuery}"</p>
            ) : (
              <p>No more people to discover</p>
            )}
          </div>
        )}
      </div>

      {/* Footer spacing */}
      <div style={{ height: '80px' }} />
    </div>
  )
}
