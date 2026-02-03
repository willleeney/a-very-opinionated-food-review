import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Organisation, OrganisationInvite, OrganisationRequest, Profile } from '../lib/database.types'
import type { User } from '@supabase/supabase-js'

interface OrgWithRole extends Organisation {
  role: 'admin' | 'member'
  membershipId: string
}

interface InviteWithOrg extends OrganisationInvite {
  organisation?: Organisation | null
  inviter?: Profile | null
}

interface RequestWithOrg extends OrganisationRequest {
  organisation?: Organisation | null
}

export function PersonalSettings(): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [orgs, setOrgs] = useState<OrgWithRole[]>([])
  const [invites, setInvites] = useState<InviteWithOrg[]>([])
  const [pendingRequests, setPendingRequests] = useState<RequestWithOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Organisation[]>([])
  const [searching, setSearching] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return

    // Fetch user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    if (profile) {
      setDisplayName(profile.display_name || '')
    }

    // Fetch user's organisations
    const { data: memberships } = await supabase
      .from('organisation_members')
      .select('id, role, organisation_id, organisations(*)')
      .eq('user_id', user.id)

    if (memberships) {
      const userOrgs: OrgWithRole[] = memberships.map((m) => ({
        ...(m.organisations as Organisation),
        role: m.role as 'admin' | 'member',
        membershipId: m.id,
      }))
      setOrgs(userOrgs)
    }

    // Fetch pending invites for user's email
    const { data: invitesData } = await supabase
      .from('organisation_invites')
      .select('*, organisations(*)')
      .eq('email', user.email)

    if (invitesData) {
      // Fetch inviter profiles
      const inviterIds = invitesData.map(i => i.invited_by)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', inviterIds)

      const invitesWithOrgs: InviteWithOrg[] = invitesData.map((i) => ({
        ...i,
        organisation: i.organisations as Organisation | null,
        inviter: profiles?.find(p => p.id === i.invited_by) || null,
      }))
      setInvites(invitesWithOrgs)
    }

    // Fetch pending join requests
    const { data: requestsData } = await supabase
      .from('organisation_requests')
      .select('*, organisations(*)')
      .eq('user_id', user.id)

    if (requestsData) {
      const requestsWithOrgs: RequestWithOrg[] = requestsData.map((r) => ({
        ...r,
        organisation: r.organisations as Organisation | null,
      }))
      setPendingRequests(requestsWithOrgs)
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user, fetchData])

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
    } else {
      setSuccess('Name updated')
    }
    setSaving(false)
  }

  const handleLeaveOrg = async (membershipId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to leave ${orgName}?`)) return

    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('organisation_members')
      .delete()
      .eq('id', membershipId)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(`Left ${orgName}`)
      fetchData()
    }
  }

  const handleAcceptInvite = async (invite: InviteWithOrg) => {
    if (!user) return

    setError(null)
    setSuccess(null)

    // Add user as member
    const { error: memberError } = await supabase
      .from('organisation_members')
      .insert({
        organisation_id: invite.organisation_id,
        user_id: user.id,
        role: 'member',
      })

    if (memberError) {
      setError(memberError.message)
      return
    }

    // Delete the invite
    await supabase
      .from('organisation_invites')
      .delete()
      .eq('id', invite.id)

    // Note: Review visibility is now derived from org membership,
    // so user's reviews are automatically visible to this org

    setSuccess(`Joined ${invite.organisation?.name}`)
    fetchData()
  }

  const handleDeclineInvite = async (inviteId: string) => {
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('organisation_invites')
      .delete()
      .eq('id', inviteId)

    if (error) {
      setError(error.message)
    } else {
      setSuccess('Invite declined')
      fetchData()
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    setError(null)

    const { data, error: searchError } = await supabase
      .from('organisations')
      .select('*')
      .ilike('name', `%${searchQuery}%`)
      .limit(10)

    if (searchError) {
      setError(searchError.message)
    } else if (data) {
      // Filter out orgs user is already a member of or has pending request for
      const orgIds = new Set(orgs.map(o => o.id))
      const requestOrgIds = new Set(pendingRequests.map(r => r.organisation_id))
      const filtered = data.filter(o => !orgIds.has(o.id) && !requestOrgIds.has(o.id))
      setSearchResults(filtered)
    }

    setSearching(false)
  }

  const handleRequestJoin = async (org: Organisation) => {
    if (!user) return

    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('organisation_requests')
      .insert({
        organisation_id: org.id,
        user_id: user.id,
      })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(`Requested to join ${org.name}`)
      setSearchResults(searchResults.filter(o => o.id !== org.id))
      fetchData()
    }
  }

  const handleCancelRequest = async (requestId: string, orgName: string) => {
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('organisation_requests')
      .delete()
      .eq('id', requestId)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(`Cancelled request to join ${orgName}`)
      fetchData()
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: '120px', textAlign: 'center' }}>
        <h1>Sign in required</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Please sign in to view your settings.
        </p>
        <a href="/login" className="btn btn-accent" style={{ marginTop: '24px' }}>
          Sign in
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      {/* Navigation */}
      <nav>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <a href="/" style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ← Back
            </a>
            <button
              onClick={handleSignOut}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: '120px', paddingBottom: '80px', maxWidth: '900px' }}>
        <h1 style={{ marginBottom: '48px' }}>Settings</h1>

        {error && (
          <div style={{ padding: '16px', background: '#fdf2f2', border: '1px solid var(--poor)', marginBottom: '24px', color: 'var(--poor)' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid var(--great)', marginBottom: '24px', color: 'var(--great)' }}>
            {success}
          </div>
        )}

        {/* Account info */}
        <div className="settings-row">
          <div className="settings-label">
            <h2>Account</h2>
          </div>
          <div className="settings-content">
            <form onSubmit={handleUpdateName}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    style={{ width: '280px' }}
                  />
                </div>
                <button type="submit" disabled={saving} className="btn" style={{ padding: '10px 20px', width: '120px' }}>
                  {saving ? '...' : 'Update'}
                </button>
              </div>
            </form>
            <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Email
              </label>
              <span className="mono" style={{ fontSize: '14px' }}>{user.email}</span>
            </div>
          </div>
        </div>

        {/* Pending invites */}
        {invites.length > 0 && (
          <div className="settings-row">
            <div className="settings-label">
              <h2>Invites</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {invites.length} pending
              </p>
            </div>
            <div className="settings-content">
              {invites.map((invite, i) => (
                <div key={invite.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: i > 0 ? '16px' : 0,
                  marginTop: i > 0 ? '16px' : 0,
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none'
                }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{invite.organisation?.name}</span>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      Invited by {invite.inviter?.display_name || 'someone'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleAcceptInvite(invite)}
                      className="btn btn-accent"
                      style={{ padding: '10px 20px', width: '120px' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineInvite(invite.id)}
                      className="btn"
                      style={{ padding: '10px 20px', width: '120px' }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organisations */}
        <div className="settings-row">
          <div className="settings-label">
            <h2>Organisations</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {orgs.length} joined
              {pendingRequests.length > 0 ? `, ${pendingRequests.length} pending` : ''}
            </p>
          </div>
          <div className="settings-content">
            {orgs.length === 0 && pendingRequests.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>
                You're not a member of any organisations yet.
              </p>
            ) : (
              <>
                {orgs.map((org, i) => (
                  <div key={org.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: i > 0 ? '16px' : 0,
                    marginTop: i > 0 ? '16px' : 0,
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none'
                  }}>
                    <div>
                      <a href={`/org/${org.slug}`} style={{ fontWeight: 500 }}>
                        {org.name}
                      </a>
                      <span style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: org.role === 'admin' ? 'var(--accent)' : 'var(--text-muted)',
                        marginLeft: '12px'
                      }}>
                        {org.role}
                      </span>
                    </div>
                    <button
                      onClick={() => handleLeaveOrg(org.membershipId, org.name)}
                      className="btn"
                      style={{ padding: '10px 20px', width: '120px' }}
                    >
                      Leave
                    </button>
                  </div>
                ))}
                {pendingRequests.map((request, i) => (
                  <div key={request.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '16px',
                    marginTop: '16px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--bg-warm)',
                    margin: (orgs.length > 0 || i > 0) ? '16px -24px 0' : '0 -24px',
                    padding: '16px 24px'
                  }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{request.organisation?.name}</span>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginLeft: '12px' }}>
                        pending
                      </span>
                    </div>
                    <button
                      onClick={() => handleCancelRequest(request.id, request.organisation?.name || '')}
                      className="btn"
                      style={{ padding: '10px 20px', width: '120px' }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Search for organisations */}
        <div className="settings-row">
          <div className="settings-label">
            <h2>Join</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Find an organisation
            </p>
          </div>
          <div className="settings-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Search by name
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Organisation name..."
                  style={{ width: '280px' }}
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="btn"
                style={{ padding: '10px 20px', width: '120px' }}
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                {searchResults.map((org, i) => (
                  <div
                    key={org.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: i > 0 ? '12px' : 0,
                      marginTop: i > 0 ? '12px' : 0,
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none'
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{org.name}</span>
                    <button
                      onClick={() => handleRequestJoin(org)}
                      className="btn btn-accent"
                      style={{ padding: '10px 20px', width: '120px' }}
                    >
                      Request
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !searching && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px' }}>
                No organisations found matching "{searchQuery}"
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
