import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { OrganisationWithMembership } from '../lib/database.types'

interface BurgerMenuProps {
  user: User
  currentOrgSlug?: string | null
  userOrgs: OrganisationWithMembership[]
}

export function BurgerMenu({ user: _user, currentOrgSlug: _currentOrgSlug, userOrgs }: BurgerMenuProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Only show orgs where user is admin
  const adminOrgs = userOrgs.filter(org => org.role === 'admin')

  return (
    <div ref={menuRef} className="burger-menu">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        aria-label="Menu"
        aria-expanded={isOpen}
        className={`burger-button ${isOpen ? 'active' : ''}`}
      >
        <span className="burger-line" />
        <span className="burger-line" />
        <span className="burger-line" />
      </button>

      {isOpen && (
        <div
          className="category-dropdown burger-dropdown-position"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="dropdown-header">
            <span className="dropdown-title">Menu</span>
          </div>
          <div className="dropdown-list">
            {adminOrgs.map((org) => (
              <a
                key={org.id}
                href={`/org/${org.slug}/admin`}
                className="dropdown-item"
              >
                <span className="item-check"></span>
                <span className="item-label">{org.name}</span>
              </a>
            ))}

            <a href="/settings" className="dropdown-item">
              <span className="item-check"></span>
              <span className="item-label">Settings</span>
            </a>

            <button onClick={handleSignOut} className="dropdown-item" style={{ width: '100%', textAlign: 'left' }}>
              <span className="item-check"></span>
              <span className="item-label" style={{ color: 'var(--text-muted)' }}>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
