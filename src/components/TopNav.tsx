import type { User } from '@supabase/supabase-js'
import type { OrganisationWithMembership } from '../lib/database.types'
import { supabase } from '../lib/supabase'

interface TopNavProps {
  user: User | null
  currentOrgSlug?: string | null
  userOrgs: OrganisationWithMembership[]
}

export function TopNav({ user, currentOrgSlug, userOrgs }: TopNavProps): JSX.Element {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Determine org link - only show if user is admin of at least one org
  const adminOrgs = userOrgs.filter(o => o.role === 'admin')
  const orgLink = currentOrgSlug && adminOrgs.some(o => o.slug === currentOrgSlug)
    ? `/org/${currentOrgSlug}/admin`
    : adminOrgs.length > 0
      ? `/org/${adminOrgs[0].slug}/admin`
      : null

  const showOrgLink = adminOrgs.length > 0

  return (
    <nav className="top-nav">
      <div className="container">
        <div className="top-nav-inner">
          <a href="/" className="top-nav-logo">
            Tastefull
          </a>

          {user ? (
            <div className="top-nav-links">
              <a href="/" className="top-nav-link">
                <svg className="top-nav-icon" viewBox="0 0 24 24">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                <span className="top-nav-label">Home</span>
              </a>

              <a href="/network" className="top-nav-link">
                <svg className="top-nav-icon" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span className="top-nav-label">Network</span>
              </a>

              {showOrgLink && orgLink && (
                <a href={orgLink} className="top-nav-link">
                  <svg className="top-nav-icon" viewBox="0 0 24 24">
                    <path d="M3 21h18"></path>
                    <path d="M5 21V7l8-4v18"></path>
                    <path d="M19 21V11l-6-4"></path>
                    <path d="M9 9v.01"></path>
                    <path d="M9 12v.01"></path>
                    <path d="M9 15v.01"></path>
                    <path d="M9 18v.01"></path>
                  </svg>
                  <span className="top-nav-label">Organisation</span>
                </a>
              )}

              <a href="/settings" className="top-nav-link">
                <svg className="top-nav-icon" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                <span className="top-nav-label">Settings</span>
              </a>

              <span className="top-nav-divider"></span>

              <button onClick={handleSignOut} className="top-nav-signout" title="Sign out">
                <svg className="top-nav-icon" viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span className="top-nav-label">Sign out</span>
              </button>
            </div>
          ) : (
            <a href="/login" className="top-nav-link">
              <svg className="top-nav-icon" viewBox="0 0 24 24">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span className="top-nav-label">Sign in</span>
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
