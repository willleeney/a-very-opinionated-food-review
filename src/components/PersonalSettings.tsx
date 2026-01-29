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

      <div className="container" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <h1 style={{ marginBottom: '8px' }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '48px' }}>
          Manage your account and organisations
        </p>

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
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>Account</h2>
          <form onSubmit={handleUpdateName} style={{ maxWidth: '400px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Name
              </label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  style={{ flex: 1 }}
                />
                <button type="submit" disabled={saving} className="btn btn-accent" style={{ padding: '10px 20px' }}>
                  {saving ? '...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Email</span>
            <span className="mono" style={{ fontSize: '14px' }}>{user.email}</span>
          </div>
        </section>

        {/* Pending invites */}
        {invites.length > 0 && (
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ marginBottom: '16px' }}>Pending Invites</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {invites.map((invite) => (
                <div key={invite.id} style={{ padding: '20px', background: 'white', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ marginBottom: '8px' }}>{invite.organisation?.name}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        Invited by {invite.inviter?.name || 'someone'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => handleAcceptInvite(invite)}
                        className="btn btn-accent"
                        style={{ padding: '8px 16px' }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(invite.id)}
                        className="btn"
                        style={{ padding: '8px 16px' }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Organisations */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>Your Organisations ({orgs.length})</h2>
          {orgs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              You're not a member of any organisations yet.
            </p>
          ) : (
            <table style={{ maxWidth: '500px', marginBottom: '24px' }}>
              <thead>
                <tr>
                  <th style={{ width: '60%' }}>Organisation</th>
                  <th style={{ width: '25%' }}>Role</th>
                  <th style={{ width: '15%' }}></th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td>
                      <a href={`/org/${org.slug}`} style={{ fontWeight: 500 }}>
                        {org.name}
                      </a>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: org.role === 'admin' ? 'var(--accent)' : 'var(--text-muted)'
                      }}>
                        {org.role}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleLeaveOrg(org.membershipId, org.name)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--poor)' }}
                      >
                        Leave
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pending requests */}
          {pendingRequests.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>Pending Requests</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingRequests.map((request) => (
                  <div key={request.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-warm)', border: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 500 }}>{request.organisation?.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                        pending
                      </span>
                      <button
                        onClick={() => handleCancelRequest(request.id, request.organisation?.name || '')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--poor)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search for organisations */}
          <div style={{ maxWidth: '500px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>Find an Organisation</h3>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name..."
                style={{ flex: 1 }}
              />
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="btn"
                style={{ padding: '10px 20px' }}
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div style={{ border: '1px solid var(--border)' }}>
                {searchResults.map((org, i) => (
                  <div
                    key={org.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500 }}>{org.name}</span>
                      {org.tagline && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '12px' }}>
                          {org.tagline}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRequestJoin(org)}
                      className="btn btn-accent"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Request to Join
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !searching && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                No organisations found matching "{searchQuery}"
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
