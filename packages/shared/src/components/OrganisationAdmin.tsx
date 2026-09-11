import { useState, useEffect, useCallback } from 'react'
import * as api from '../lib/api'
import type { OrganisationMember, OrganisationInvite, OrganisationRequest, OrganisationWithMembership, OfficeLocation } from '../lib/database.types'
import { getUser, type AuthUser } from '../lib/auth-client'
import { TopNav } from './TopNav'

interface OrganisationAdminProps {
  organisationSlug: string
}

interface HomebaseResult {
  placeId: string
  name: string
  address: string
}

interface MemberWithProfile extends OrganisationMember {
  profile?: api.Profile | null
}

interface InviteWithInviter extends OrganisationInvite {
  inviter?: api.Profile | null
}

interface RequestWithProfile extends OrganisationRequest {
  profile?: api.Profile | null
}

interface UserOrg {
  id: string
  name: string
  slug: string
  role: 'admin' | 'member'
}

export function OrganisationAdmin({ organisationSlug }: OrganisationAdminProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [org, setOrg] = useState<api.Organisation | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [invites, setInvites] = useState<InviteWithInviter[]>([])
  const [requests, setRequests] = useState<RequestWithProfile[]>([])
  const [userOrgs, setUserOrgs] = useState<UserOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Form states
  const [orgName, setOrgName] = useState('')
  // Homebase: the org's base address. Distances in the table are measured from
  // here, so it is stored as coordinates, looked up via Google Places.
  const [homebaseQuery, setHomebaseQuery] = useState('')
  const [homebaseResults, setHomebaseResults] = useState<HomebaseResult[]>([])
  const [homebaseLookup, setHomebaseLookup] = useState(false)
  const [homebase, setHomebase] = useState<OfficeLocation | null>(null)
  const [savingHomebase, setSavingHomebase] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    // Fetch organisation
    let orgData: api.Organisation | null = null
    try {
      orgData = await api.getOrgBySlug(organisationSlug)
    } catch {
      orgData = null
    }

    if (!orgData) {
      setError('Organisation not found')
      setLoading(false)
      return
    }

    setOrg(orgData)
    setOrgName(orgData.name)
    setHomebase((orgData.office_location as OfficeLocation | null) ?? null)

    // Fetch members with profiles
    try {
      const membersData = await api.getOrgMembers(orgData.id)

      // Fetch profiles for members
      const userIds = membersData.map(m => m.user_id)
      const profiles = userIds.length > 0 ? await api.getProfiles(userIds) : []

      const membersWithProfiles = membersData.map(m => ({
        ...m,
        profile: profiles.find(p => p.id === m.user_id) || null
      }))
      setMembers(membersWithProfiles)

      // Check if current user is admin
      const currentUserMembership = membersData.find(m => m.user_id === user?.id)
      setIsAdmin(currentUserMembership?.role === 'admin')
    } catch (err) {
      console.error('Failed to fetch members:', err)
    }

    // Fetch invites
    try {
      const invitesData = await api.getOrgInvites(orgData.id)

      // Fetch profiles for inviters
      const inviterIds = invitesData.map(i => i.invited_by)
      const profiles = inviterIds.length > 0 ? await api.getProfiles(inviterIds) : []

      const invitesWithInviters = invitesData.map(i => ({
        ...i,
        inviter: profiles.find(p => p.id === i.invited_by) || null
      }))
      setInvites(invitesWithInviters)
    } catch (err) {
      console.error('Failed to fetch invites:', err)
    }

    // Fetch join requests
    try {
      const requestsData = await api.getOrgRequests(orgData.id)

      // The endpoint joins the requester's profile for org admins — a separate
      // /api/data/profiles lookup would come back with the email masked, since
      // a requester shares no org with the admin yet.
      const requestsWithProfiles = requestsData.map(r => ({
        ...r,
        profile: {
          id: r.user_id,
          display_name: r.requester_display_name ?? null,
          email: r.requester_email ?? null,
          avatar_url: r.requester_avatar_url ?? null,
          is_private: false,
          created_at: null,
        },
      }))
      setRequests(requestsWithProfiles)
    } catch (err) {
      console.error('Failed to fetch join requests:', err)
    }

    setLoading(false)
  }, [organisationSlug, user?.id])

  const fetchUserOrgs = useCallback(async (userId: string) => {
    try {
      const memberships = await api.getUserMemberships(userId, true)

      const orgs: UserOrg[] = memberships
        .filter(m => m.organisation)
        .map((m) => ({
          id: m.organisation!.id,
          name: m.organisation!.name,
          slug: m.organisation!.slug,
          role: m.role as 'admin' | 'member',
        }))
      setUserOrgs(orgs)
    } catch (err) {
      console.error('Failed to fetch user orgs:', err)
    }
  }, [])

  useEffect(() => {
    getUser().then((u) => {
      setUser(u)
    })
  }, [])

  useEffect(() => {
    if (user) {
      fetchData()
      fetchUserOrgs(user.id)
    }
  }, [user, fetchData, fetchUserOrgs])

  // Debounced address lookup. Unlike Add Place this is not restricted to food
  // venues — a homebase is usually an office or a street address.
  useEffect(() => {
    if (!homebaseQuery.trim() || homebaseQuery.trim().length < 3) {
      setHomebaseResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) return

      setHomebaseLookup(true)
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
          body: JSON.stringify({ input: homebaseQuery }),
        })
        if (!res.ok) { setHomebaseResults([]); return }
        const data = await res.json()
        setHomebaseResults(
          (data.suggestions ?? [])
            .filter((s: { placePrediction?: unknown }) => s.placePrediction)
            .slice(0, 5)
            .map((s: { placePrediction: { placeId: string; structuredFormat?: { mainText?: { text?: string }, secondaryText?: { text?: string } }, text?: { text?: string } } }) => ({
              placeId: s.placePrediction.placeId,
              name: s.placePrediction.structuredFormat?.mainText?.text ?? s.placePrediction.text?.text ?? '',
              address: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
            }))
        )
      } catch {
        setHomebaseResults([])
      } finally {
        setHomebaseLookup(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [homebaseQuery])

  const selectHomebase = async (result: HomebaseResult) => {
    if (!org) return
    const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY

    setSavingHomebase(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${result.placeId}?fields=location`,
        { headers: { 'X-Goog-Api-Key': apiKey } }
      )
      if (!res.ok) throw new Error('Could not look up that address')
      const data = await res.json()
      if (!data.location) throw new Error('That place has no location')

      const loc: OfficeLocation = {
        lat: data.location.latitude,
        lng: data.location.longitude,
        name: result.name,
        address: result.address,
      }
      await api.updateOrg(org.id, {
        office_location: { lat: loc.lat, lng: loc.lng, name: result.name, address: result.address },
      })
      setHomebase(loc)
      setHomebaseQuery('')
      setHomebaseResults([])
      setSuccess(`Homebase set to ${result.name}`)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set homebase')
    }
    setSavingHomebase(false)
  }

  const clearHomebase = async () => {
    if (!org) return
    setSavingHomebase(true)
    setError(null)
    setSuccess(null)
    try {
      await api.updateOrg(org.id, { office_location: null })
      setHomebase(null)
      setSuccess('Homebase cleared')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear homebase')
    }
    setSavingHomebase(false)
  }

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await api.updateOrg(org.id, { name: orgName })
      setSuccess('Organisation details updated')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organisation')
    }
    setSaving(false)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org || !user) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await api.createInvite({
        organisation_id: org.id,
        email: inviteEmail
      })
      setSuccess(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    }
    setSaving(false)
  }

  const handleCancelInvite = async (inviteId: string) => {
    setError(null)
    setSuccess(null)

    try {
      await api.deleteInvite(inviteId)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invite')
    }
  }

  const handleAcceptRequest = async (request: RequestWithProfile) => {
    if (!org) return

    setError(null)
    setSuccess(null)

    // Add user as member
    try {
      await api.addOrgMember({
        organisation_id: org.id,
        user_id: request.user_id,
        role: 'member',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member')
      return
    }

    // Delete the request
    try {
      await api.deleteOrgRequest(request.id)
    } catch (err) {
      console.error('Failed to delete join request:', err)
    }

    // Note: Review visibility is now derived from org membership,
    // so user's reviews are automatically visible to this org

    setSuccess(`${request.profile?.display_name || 'User'} has been added as a member`)
    fetchData()
  }

  const handleRejectRequest = async (requestId: string) => {
    setError(null)
    setSuccess(null)

    try {
      await api.deleteOrgRequest(requestId)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request')
    }
  }

  const handleTransferAdmin = async () => {
    if (!transferTo || !user) return

    const targetMember = members.find(m => m.user_id === transferTo)
    if (!targetMember) return

    if (!confirm(`Transfer admin rights to ${targetMember.profile?.display_name || targetMember.profile?.email}? You will remain as a member.`)) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    // Make the target user an admin
    try {
      await api.updateOrgMember(targetMember.id, 'admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer admin rights')
      setSaving(false)
      return
    }

    // Demote current user to member
    const currentMember = members.find(m => m.user_id === user.id)
    if (currentMember) {
      try {
        await api.updateOrgMember(currentMember.id, 'member')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to transfer admin rights')
        setSaving(false)
        return
      }
    }

    setSuccess(`Admin rights transferred to ${targetMember.profile?.display_name || targetMember.profile?.email}`)
    setTransferTo('')
    setSaving(false)
    // Redirect since user is no longer admin
    window.location.href = `/org/${organisationSlug}`
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    setError(null)
    setSuccess(null)

    try {
      await api.removeOrgMember(memberId)
      setSuccess('Member removed')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handleDeleteOrg = async () => {
    if (!org) return

    const confirmText = prompt(`Type "${org.name}" to confirm deletion:`)
    if (confirmText !== org.name) {
      if (confirmText !== null) {
        setError('Organisation name did not match')
      }
      return
    }

    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      await api.deleteOrg(org.id)
      // Redirect to home after deletion
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organisation')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="container" style={{ paddingTop: '120px', textAlign: 'center' }}>
        <h1>Organisation not found</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          This organisation doesn't exist or you don't have access.
        </p>
        <a href="/" className="btn" style={{ marginTop: '24px' }}>
          Back to home
        </a>
      </div>
    )
  }

  // Redirect non-admins to home
  if (!isAdmin) {
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  // Convert userOrgs to format TopNav expects
  const userOrgsForNav: OrganisationWithMembership[] = userOrgs.map(o => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    office_location: null,
    tagline: null,
    created_at: null,
    role: o.role,
  }))

  return (
    <div>
      <TopNav user={user} userOrgs={userOrgsForNav} currentOrgSlug={organisationSlug} />

      <div className="container settings-container" style={{ paddingTop: '140px', paddingBottom: '80px', maxWidth: '900px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 400, marginBottom: '8px' }}>Organisation</h1>

        {/* Organisation switcher tabs */}
        {userOrgs.filter(o => o.role === 'admin').length > 0 && (
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '32px', marginTop: '24px' }}>
            {userOrgs.filter(o => o.role === 'admin').map((userOrg) => (
              <a
                key={userOrg.id}
                href={`/org/${userOrg.slug}/admin`}
                style={{
                  padding: '16px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: userOrg.slug === organisationSlug ? 'var(--text)' : 'var(--text-muted)',
                  position: 'relative',
                }}
              >
                {userOrg.name}
                {userOrg.slug === organisationSlug && (
                  <span style={{
                    position: 'absolute',
                    bottom: '-1px',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'var(--accent)',
                  }} />
                )}
              </a>
            ))}
          </div>
        )}

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

        {/* Organisation details */}
        <div className="settings-row">
          <div className="settings-label">
            <h2>Organisation</h2>
          </div>
          <div className="settings-content">
            <form onSubmit={handleUpdateDetails}>
              <div className="settings-form-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    style={{ width: '100%', maxWidth: '280px' }}
                  />
                </div>
                <button type="submit" disabled={saving} className="btn settings-form-btn">
                  {saving ? '...' : 'Update'}
                </button>
              </div>
            </form>

            {/* Homebase — distances in the table are measured from here */}
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Homebase
              </label>

              {homebase ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px' }}>
                    {homebase.name || 'Set'}
                    {homebase.address && (
                      <span style={{ color: 'var(--text-muted)' }}> · {homebase.address}</span>
                    )}
                    <span className="mono" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {homebase.lat.toFixed(6)}, {homebase.lng.toFixed(6)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={clearHomebase}
                    disabled={savingHomebase}
                    className="btn"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Not set — walking distances are hidden until you choose one.
                </p>
              )}

              <div style={{ position: 'relative', maxWidth: '280px' }}>
                <input
                  type="text"
                  value={homebaseQuery}
                  onChange={(e) => setHomebaseQuery(e.target.value)}
                  placeholder={homebase ? 'Search to change…' : 'Search for an address…'}
                  disabled={savingHomebase}
                  style={{ width: '100%' }}
                  data-testid="homebase-search"
                />

                {(homebaseLookup || homebaseResults.length > 0) && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-warm)', border: '1px solid var(--border)', marginTop: '4px' }}>
                    {homebaseLookup && homebaseResults.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>Searching…</div>
                    ) : (
                      homebaseResults.map((r) => (
                        <button
                          key={r.placeId}
                          type="button"
                          onClick={() => selectHomebase(r)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        >
                          <div style={{ fontSize: '14px' }}>{r.name}</div>
                          {r.address && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.address}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Transfer admin */}
            {members.filter(m => m.user_id !== user?.id).length > 0 && (
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                <div className="settings-form-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Transfer Admin Rights
                    </label>
                    <select
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      style={{ width: '100%', maxWidth: '280px' }}
                    >
                      <option value="">Select member...</option>
                      {members
                        .filter(m => m.user_id !== user?.id)
                        .map((m) => (
                          <option key={m.id} value={m.user_id}>
                            {m.profile?.display_name || m.profile?.email || 'Unknown'}
                          </option>
                        ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleTransferAdmin}
                    disabled={!transferTo || saving}
                    className="btn settings-form-btn"
                  >
                    Transfer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Invite member */}
        <div className="settings-row">
          <div className="settings-label">
            <h2>Invite</h2>
          </div>
          <div className="settings-content">
            <form onSubmit={handleInvite} className="settings-form-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="colleague@example.com"
                  style={{ width: '100%', maxWidth: '280px' }}
                />
              </div>
              <button type="submit" disabled={saving} className="btn btn-accent settings-form-btn">
                {saving ? '...' : 'Invite'}
              </button>
            </form>
          </div>
        </div>

        {/* Members */}
        <div className="settings-row">
          <div className="settings-label">
            <h2>Team</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {members.length} member{members.length !== 1 ? 's' : ''}
              {invites.length > 0 ? `, ${invites.length} invited` : ''}
              {requests.length > 0 ? `, ${requests.length} pending` : ''}
            </p>
          </div>
          <div className="settings-content">
            <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td style={{ fontWeight: 500 }}>
                    {member.profile?.display_name || 'Unknown'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {member.profile?.email || '—'}
                  </td>
                  <td>
                    <span style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: member.role === 'admin' ? 'var(--accent)' : 'var(--text-muted)'
                    }}>
                      {member.role}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {member.user_id !== user?.id && member.role !== 'admin' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--poor)' }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invites.map((invite) => (
                <tr key={`invite-${invite.id}`} style={{ opacity: 0.7 }}>
                  <td style={{ fontWeight: 500, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    {invite.email.split('@')[0]}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {invite.email}
                  </td>
                  <td>
                    <span style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--text-muted)'
                    }}>
                      invited
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--poor)' }}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
              {requests.map((request) => (
                <tr key={`request-${request.id}`} style={{ background: 'var(--bg-warm)' }}>
                  <td style={{ fontWeight: 500 }}>
                    {request.profile?.display_name || 'Unknown'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {request.profile?.email || '—'}
                  </td>
                  <td>
                    <span style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--accent)'
                    }}>
                      requested
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleAcceptRequest(request)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--great)' }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--poor)' }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Danger zone */}
        <div className="settings-row" style={{ marginTop: '48px', paddingTop: '48px', borderTop: '1px solid var(--border)' }}>
          <div className="settings-label">
            <h2 style={{ color: 'var(--poor)' }}>Danger Zone</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Irreversible actions
            </p>
          </div>
          <div className="settings-content">
            <div className="settings-form-row settings-form-row-top">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                  Delete organisation
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Permanently delete {org.name} and remove all members. This cannot be undone.
                </p>
              </div>
              <button
                onClick={handleDeleteOrg}
                disabled={saving}
                className="btn settings-form-btn"
                style={{
                  borderColor: 'var(--poor)',
                  color: 'var(--poor)',
                  flexShrink: 0,
                }}
              >
                {saving ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
