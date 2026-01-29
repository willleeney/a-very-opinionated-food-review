import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Organisation, OrganisationMember, OrganisationInvite, OrganisationRequest, Profile } from '../lib/database.types'
import type { User } from '@supabase/supabase-js'

interface OrganisationAdminProps {
  organisationSlug: string
}

interface MemberWithProfile extends OrganisationMember {
  profile?: Profile | null
}

interface InviteWithInviter extends OrganisationInvite {
  inviter?: Profile | null
}

interface RequestWithProfile extends OrganisationRequest {
  profile?: Profile | null
}

export function OrganisationAdmin({ organisationSlug }: OrganisationAdminProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [org, setOrg] = useState<Organisation | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [invites, setInvites] = useState<InviteWithInviter[]>([])
  const [requests, setRequests] = useState<RequestWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Form states
  const [orgName, setOrgName] = useState('')
  const [officeName, setOfficeName] = useState('')
  const [officeLocation, setOfficeLocation] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    // Fetch organisation
    const { data: orgData, error: orgError } = await supabase
      .from('organisations')
      .select('*')
      .eq('slug', organisationSlug)
      .single()

    if (orgError || !orgData) {
      setError('Organisation not found')
      setLoading(false)
      return
    }

    setOrg(orgData)
    setOrgName(orgData.name)
    // Parse tagline into office name and location (separated by comma)
    const taglineParts = (orgData.tagline || '').split(', ')
    setOfficeName(taglineParts[0] || '')
    setOfficeLocation(taglineParts[1] || '')

    // Fetch members with profiles
    const { data: membersData } = await supabase
      .from('organisation_members')
      .select('*')
      .eq('organisation_id', orgData.id)

    if (membersData) {
      // Fetch profiles for members
      const userIds = membersData.map(m => m.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      const membersWithProfiles = membersData.map(m => ({
        ...m,
        profile: profiles?.find(p => p.id === m.user_id) || null
      }))
      setMembers(membersWithProfiles)

      // Check if current user is admin
      const currentUserMembership = membersData.find(m => m.user_id === user?.id)
      setIsAdmin(currentUserMembership?.role === 'admin')
    }

    // Fetch invites
    const { data: invitesData } = await supabase
      .from('organisation_invites')
      .select('*')
      .eq('organisation_id', orgData.id)

    if (invitesData) {
      // Fetch profiles for inviters
      const inviterIds = invitesData.map(i => i.invited_by)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', inviterIds)

      const invitesWithInviters = invitesData.map(i => ({
        ...i,
        inviter: profiles?.find(p => p.id === i.invited_by) || null
      }))
      setInvites(invitesWithInviters)
    }

    // Fetch join requests
    const { data: requestsData } = await supabase
      .from('organisation_requests')
      .select('*')
      .eq('organisation_id', orgData.id)

    if (requestsData) {
      // Fetch profiles for requesters
      const requesterIds = requestsData.map(r => r.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', requesterIds)

      const requestsWithProfiles = requestsData.map(r => ({
        ...r,
        profile: profiles?.find(p => p.id === r.user_id) || null
      }))
      setRequests(requestsWithProfiles)
    }

    setLoading(false)
  }, [organisationSlug, user?.id])

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

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    // Combine office name and location into tagline
    const tagline = [officeName, officeLocation].filter(Boolean).join(', ') || null

    const { error } = await supabase
      .from('organisations')
      .update({ name: orgName, tagline })
      .eq('id', org.id)

    if (error) {
      setError(error.message)
    } else {
      setSuccess('Organisation details updated')
      fetchData()
    }
    setSaving(false)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org || !user) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('organisation_invites')
      .insert({
        organisation_id: org.id,
        email: inviteEmail,
        invited_by: user.id
      })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      fetchData()
    }
    setSaving(false)
  }

  const handleCancelInvite = async (inviteId: string) => {
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('organisation_invites')
      .delete()
      .eq('id', inviteId)

    if (error) {
      setError(error.message)
    } else {
      fetchData()
    }
  }

  const handleAcceptRequest = async (request: RequestWithProfile) => {
    if (!org) return

    setError(null)
    setSuccess(null)

    // Add user as member
    const { error: memberError } = await supabase
      .from('organisation_members')
      .insert({
        organisation_id: org.id,
        user_id: request.user_id,
        role: 'member',
      })

    if (memberError) {
      setError(memberError.message)
      return
    }

    // Delete the request
    await supabase
      .from('organisation_requests')
      .delete()
      .eq('id', request.id)

    // Make the user's existing reviews visible to this org
    const { data: userReviews } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', request.user_id)

    if (userReviews && userReviews.length > 0) {
      const visibilityEntries = userReviews.map(review => ({
        review_id: review.id,
        organisation_id: org.id,
      }))
      // Insert visibility entries, ignore conflicts (review might already be visible)
      await supabase
        .from('review_visibility')
        .upsert(visibilityEntries, { onConflict: 'review_id,organisation_id' })
    }

    setSuccess(`${request.profile?.display_name || 'User'} has been added as a member`)
    fetchData()
  }

  const handleRejectRequest = async (requestId: string) => {
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('organisation_requests')
      .delete()
      .eq('id', requestId)

    if (error) {
      setError(error.message)
    } else {
      fetchData()
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
    const { error: promoteError } = await supabase
      .from('organisation_members')
      .update({ role: 'admin' })
      .eq('id', targetMember.id)

    if (promoteError) {
      setError(promoteError.message)
      setSaving(false)
      return
    }

    // Demote current user to member
    const currentMember = members.find(m => m.user_id === user.id)
    if (currentMember) {
      const { error: demoteError } = await supabase
        .from('organisation_members')
        .update({ role: 'member' })
        .eq('id', currentMember.id)

      if (demoteError) {
        setError(demoteError.message)
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

    const { error } = await supabase
      .from('organisation_members')
      .delete()
      .eq('id', memberId)

    if (error) {
      setError(error.message)
    } else {
      setSuccess('Member removed')
      fetchData()
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

  if (!isAdmin) {
    return (
      <div className="container" style={{ paddingTop: '120px', textAlign: 'center' }}>
        <h1>Access denied</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          You need to be an admin to access this page.
        </p>
        <a href={`/org/${organisationSlug}`} className="btn" style={{ marginTop: '24px' }}>
          Back to {org.name}
        </a>
      </div>
    )
  }

  return (
    <div>
      {/* Navigation */}
      <nav>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <a href={`/org/${organisationSlug}`} style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ← Back to {org.name}
            </a>
          </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <h1 style={{ marginBottom: '8px' }}>Organisation Settings</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '48px' }}>
          Manage {org.name}
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

        {/* Organisation details */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>Organisation Details</h2>
          <form onSubmit={handleUpdateDetails} style={{ maxWidth: '400px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Office
              </label>
              <input
                type="text"
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                placeholder="e.g. Runway East"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Location
              </label>
              <input
                type="text"
                value={officeLocation}
                onChange={(e) => setOfficeLocation(e.target.value)}
                placeholder="e.g. London Bridge"
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" disabled={saving} className="btn btn-accent" style={{ padding: '12px 24px' }}>
              {saving ? '...' : 'Update'}
            </button>
          </form>

          {/* Transfer admin */}
          {members.filter(m => m.user_id !== user?.id).length > 0 && (
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)', maxWidth: '400px' }}>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Transfer Admin Rights
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  style={{ flex: 1 }}
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
                <button
                  type="button"
                  onClick={handleTransferAdmin}
                  disabled={!transferTo || saving}
                  className="btn"
                  style={{ padding: '10px 20px' }}
                >
                  Transfer
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Invite member */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>Invite Member</h2>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', maxWidth: '400px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Email address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                placeholder="colleague@example.com"
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" disabled={saving} className="btn btn-accent" style={{ padding: '12px 24px' }}>
              {saving ? '...' : 'Send Invite'}
            </button>
          </form>
        </section>

        {/* Members */}
        <section>
          <h2 style={{ marginBottom: '16px' }}>
            Members ({members.length}
            {invites.length > 0 ? ` + ${invites.length} invited` : ''}
            {requests.length > 0 ? ` + ${requests.length} requested` : ''})
          </h2>
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
        </section>
      </div>
    </div>
  )
}
