import { useState, useEffect } from 'react'
import * as api from '../lib/api'
import { getUser, type AuthUser } from '../lib/auth-client'
import type { Organisation, OrganisationInvite, Profile } from '../lib/database.types'

interface AcceptInviteProps {
  token: string
}

interface InviteWithDetails extends OrganisationInvite {
  organisation?: Organisation | null
  inviter?: Profile | null
}

export function AcceptInvite({ token }: AcceptInviteProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [invite, setInvite] = useState<InviteWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Check auth state
    getUser().then((user) => {
      setUser(user)
    })
  }, [])

  useEffect(() => {
    // Fetch invite details
    const fetchInvite = async () => {
      let inviteData: api.OrgInvite
      try {
        inviteData = await api.getInviteByToken(token)
      } catch {
        setError('This invite link is invalid or has expired.')
        setLoading(false)
        return
      }

      // Check if expired
      if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
        setError('This invite has expired.')
        setLoading(false)
        return
      }

      // Fetch inviter profile
      let inviterProfile: Profile | null = null
      try {
        inviterProfile = await api.getProfile(inviteData.invited_by) as Profile
      } catch {
        inviterProfile = null
      }

      setInvite({
        ...inviteData,
        organisation: inviteData.organisation as Organisation | null,
        inviter: inviterProfile,
      })
      setLoading(false)
    }

    fetchInvite()
  }, [token])

  const handleAccept = async () => {
    if (!user || !invite) return

    // Check if email matches
    if (user.email !== invite.email) {
      setError(`This invite was sent to ${invite.email}. Please sign in with that email address.`)
      return
    }

    setProcessing(true)
    setError(null)

    // Add user as member
    try {
      await api.addOrgMember({
        organisation_id: invite.organisation_id,
        user_id: user.id,
        role: 'member',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join organisation.'
      if (message.includes('duplicate')) {
        setError('You are already a member of this organisation.')
      } else {
        setError(message)
      }
      setProcessing(false)
      return
    }

    // Delete the invite (best-effort — membership already succeeded)
    try {
      await api.deleteInvite(invite.id)
    } catch {
      // ignore
    }

    // Note: Review visibility is now derived from org membership,
    // so user's reviews are automatically visible to this org

    setSuccess(true)
    setProcessing(false)

    // Redirect after 2 seconds
    setTimeout(() => {
      window.location.href = `/org/${invite.organisation?.slug}`
    }, 2000)
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="container" style={{ paddingTop: '120px', textAlign: 'center' }}>
        <h1>Invalid Invite</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>
          {error}
        </p>
        <a href="/" className="btn" style={{ marginTop: '24px' }}>
          Go to home
        </a>
      </div>
    )
  }

  if (success) {
    return (
      <div className="container" style={{ paddingTop: '120px', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--great)' }}>Welcome!</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>
          You've joined {invite?.organisation?.name}. Redirecting...
        </p>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '120px', textAlign: 'center', maxWidth: '500px' }}>
      <h1 style={{ marginBottom: '24px' }}>You're Invited</h1>

      <div style={{ padding: '32px', background: 'white', border: '1px solid var(--border)', marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '8px' }}>{invite?.organisation?.name}</h2>
        {invite?.organisation?.tagline && (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
            {invite.organisation.tagline}
          </p>
        )}
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          {invite?.inviter?.display_name || 'Someone'} invited you to join this organisation
        </p>
      </div>

      {error && (
        <div style={{ padding: '16px', background: '#fdf2f2', border: '1px solid var(--poor)', marginBottom: '24px', color: 'var(--poor)' }}>
          {error}
        </div>
      )}

      {!user ? (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Sign in or create an account to accept this invite
          </p>
          <a href={`/login?redirect=/invite/${token}`} className="btn btn-accent">
            Sign in to accept
          </a>
        </>
      ) : user.email !== invite?.email ? (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            This invite was sent to <strong>{invite?.email}</strong>
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            You're signed in as {user.email}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <a href="/login" className="btn btn-accent">
              Sign in with different account
            </a>
            <a href="/" className="btn">
              Cancel
            </a>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            onClick={handleAccept}
            disabled={processing}
            className="btn btn-accent"
          >
            {processing ? 'Joining...' : 'Accept Invite'}
          </button>
          <a href="/" className="btn">
            Decline
          </a>
        </div>
      )}
    </div>
  )
}
