import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Organisation, OrganisationInvite, OrganisationRequest, Profile, OrganisationWithMembership } from '../lib/database.types'
import type { User } from '@supabase/supabase-js'
import { TopNav } from './TopNav'

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
  const [isPrivate, setIsPrivate] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Organisation[]>([])
  const [searching, setSearching] = useState(false)

  // Create org state
  const [newOrgName, setNewOrgName] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return

    // Fetch user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, is_private, avatar_url')
      .eq('id', user.id)
      .single()

    if (profile) {
      setDisplayName(profile.display_name || '')
      setIsPrivate(profile.is_private || false)
      setAvatarUrl(profile.avatar_url || null)
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

  const handleTogglePrivacy = async () => {
    if (!user) return

    setSavingPrivacy(true)
    setError(null)
    setSuccess(null)

    const newValue = !isPrivate

    const { error } = await supabase
      .from('profiles')
      .update({ is_private: newValue })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
    } else {
      setIsPrivate(newValue)
      setSuccess(newValue ? 'Account set to private' : 'Account set to public')
    }
    setSavingPrivacy(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB')
      return
    }

    setUploadingAvatar(true)
    setError(null)
    setSuccess(null)

    try {
      // Get file extension
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filePath = `${user.id}/avatar.${ext}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile with avatar URL (add cache buster)
      const avatarUrlWithCache = `${publicUrl}?t=${Date.now()}`
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrlWithCache })
        .eq('id', user.id)

      if (updateError) {
        throw updateError
      }

      setAvatarUrl(avatarUrlWithCache)
      setSuccess('Profile picture updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploadingAvatar(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user || !avatarUrl) return

    setUploadingAvatar(true)
    setError(null)
    setSuccess(null)

    try {
      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)

      if (updateError) {
        throw updateError
      }

      setAvatarUrl(null)
      setSuccess('Profile picture removed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove image')
    } finally {
      setUploadingAvatar(false)
    }
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

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newOrgName.trim()) return

    setCreatingOrg(true)
    setError(null)
    setSuccess(null)

    // Generate slug from name
    const slug = newOrgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Create the organisation
    const { data: newOrg, error: orgError } = await supabase
      .from('organisations')
      .insert({ name: newOrgName.trim(), slug })
      .select()
      .single()

    if (orgError) {
      setError(orgError.message)
      setCreatingOrg(false)
      return
    }

    // Add current user as admin
    const { error: memberError } = await supabase
      .from('organisation_members')
      .insert({
        organisation_id: newOrg.id,
        user_id: user.id,
        role: 'admin',
      })

    if (memberError) {
      setError(memberError.message)
      setCreatingOrg(false)
      return
    }

    setSuccess(`Created ${newOrgName} — <a href="/org/${slug}/admin" style="color: var(--great); text-decoration: underline;">Go to settings</a>`)
    setNewOrgName('')
    setCreatingOrg(false)
    fetchData()
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

  // Convert orgs to format TopNav expects
  const userOrgsForNav: OrganisationWithMembership[] = orgs.map(o => ({
    ...o,
    role: o.role,
  }))

  return (
    <div>
      <TopNav user={user} userOrgs={userOrgsForNav} />

      <div className="container settings-container" style={{ paddingTop: '140px', paddingBottom: '80px', maxWidth: '900px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 400, marginBottom: '48px' }}>Settings</h1>

        {error && (
          <div style={{ padding: '16px', background: '#fdf2f2', border: '1px solid var(--poor)', marginBottom: '24px', color: 'var(--poor)' }}>
            {error}
          </div>
        )}

        {success && (
          <div
            style={{ padding: '16px', background: '#f0fdf4', border: '1px solid var(--great)', marginBottom: '24px', color: 'var(--great)' }}
            dangerouslySetInnerHTML={{ __html: success }}
          />
        )}

        {/* Profile Picture */}
        <div className="settings-row">
          <div className="settings-label">
            <h2>Profile Picture</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Shown on your network page
            </p>
          </div>
          <div className="settings-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              {/* Avatar preview */}
              <div style={{
                width: '80px',
                height: '80px',
                background: avatarUrl ? 'transparent' : 'var(--accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 500,
                color: 'var(--accent)',
                fontSize: '24px',
                overflow: 'hidden',
              }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  (displayName || user.email || '?').slice(0, 2).toUpperCase()
                )}
              </div>

              {/* Upload controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label
                  style={{
                    display: 'inline-block',
                    padding: '10px 20px',
                    fontSize: '11px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    border: '1px solid var(--border)',
                    cursor: uploadingAvatar ? 'wait' : 'pointer',
                    opacity: uploadingAvatar ? 0.5 : 1,
                  }}
                >
                  {uploadingAvatar ? 'Uploading...' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    style={{ display: 'none' }}
                  />
                </label>
                {avatarUrl && (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="btn"
                    style={{ padding: '10px 20px', color: 'var(--text-muted)' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
              Max 2MB. JPG, PNG, or GIF.
            </p>
          </div>
        </div>

        {/* Account info */}
        <div className="settings-row">
          <div className="settings-label">
            <h2>Account</h2>
          </div>
          <div className="settings-content">
            <form onSubmit={handleUpdateName}>
              <div className="settings-form-row" style={{ marginBottom: '20px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    style={{ width: '100%', maxWidth: '280px' }}
                  />
                </div>
                <button type="submit" disabled={saving} className="btn settings-form-btn">
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

        {/* Privacy settings */}
        <div className="settings-row">
          <div className="settings-label">
            <h2>Privacy</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Control who can see your reviews
            </p>
          </div>
          <div className="settings-content">
            <div className="settings-form-row settings-form-row-top">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Private account
                  {isPrivate && <span style={{ fontSize: '14px' }}>🔒</span>}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  {isPrivate
                    ? 'Your reviews are hidden from non-followers. People must request to follow you and be approved before they can see your ratings and comments.'
                    : 'Anyone can follow you and see your reviews (ratings and comments) without approval.'
                  }
                </p>
                {isPrivate && (
                  <p style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '8px' }}>
                    Manage follow requests in your <a href="/network" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Network</a> page.
                  </p>
                )}
              </div>
              <button
                onClick={handleTogglePrivacy}
                disabled={savingPrivacy}
                className="btn settings-form-btn"
                style={{
                  background: isPrivate ? 'var(--accent)' : 'transparent',
                  borderColor: isPrivate ? 'var(--accent)' : 'var(--border)',
                  color: isPrivate ? 'white' : 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                {savingPrivacy ? '...' : isPrivate ? 'Private' : 'Public'}
              </button>
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
                <div key={invite.id} className="settings-list-item" style={{
                  paddingTop: i > 0 ? '16px' : 0,
                  marginTop: i > 0 ? '16px' : 0,
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 500 }}>{invite.organisation?.name}</span>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      Invited by {invite.inviter?.display_name || 'someone'}
                    </p>
                  </div>
                  <div className="settings-btn-group">
                    <button
                      onClick={() => handleAcceptInvite(invite)}
                      className="btn btn-accent settings-form-btn"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineInvite(invite.id)}
                      className="btn settings-form-btn"
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
                  <div key={org.id} className="settings-list-item" style={{
                    paddingTop: i > 0 ? '16px' : 0,
                    marginTop: i > 0 ? '16px' : 0,
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
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
                      className="btn settings-form-btn"
                    >
                      Leave
                    </button>
                  </div>
                ))}
                {pendingRequests.map((request, i) => (
                  <div key={request.id} className="settings-list-item settings-list-item-pending" style={{
                    marginTop: (orgs.length > 0 || i > 0) ? '16px' : 0,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 500 }}>{request.organisation?.name}</span>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginLeft: '12px' }}>
                        pending
                      </span>
                    </div>
                    <button
                      onClick={() => handleCancelRequest(request.id, request.organisation?.name || '')}
                      className="btn settings-form-btn"
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
            <div className="settings-form-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Search by name
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Organisation name..."
                  style={{ width: '100%', maxWidth: '280px' }}
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="btn settings-form-btn"
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                {searchResults.map((org, i) => (
                  <div
                    key={org.id}
                    className="settings-list-item"
                    style={{
                      paddingTop: i > 0 ? '12px' : 0,
                      marginTop: i > 0 ? '12px' : 0,
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none'
                    }}
                  >
                    <span style={{ fontWeight: 500, flex: 1, minWidth: 0 }}>{org.name}</span>
                    <button
                      onClick={() => handleRequestJoin(org)}
                      className="btn btn-accent settings-form-btn"
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

        {/* Create organisation */}
        <div className="settings-row">
          <div className="settings-label">
            <h2>Create</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Start a new organisation
            </p>
          </div>
          <div className="settings-content">
            <form onSubmit={handleCreateOrg} className="settings-form-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Organisation name
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="My Company"
                  required
                  style={{ width: '100%', maxWidth: '280px' }}
                />
              </div>
              <button
                type="submit"
                disabled={creatingOrg || !newOrgName.trim()}
                className="btn btn-accent settings-form-btn"
              >
                {creatingOrg ? '...' : 'Create'}
              </button>
            </form>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
              You'll be the admin and can invite others to join.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
