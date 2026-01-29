import type { OrganisationWithMembership } from '../lib/database.types'

interface OrganisationSelectorProps {
  currentOrgSlug?: string | null
  userOrgs: OrganisationWithMembership[]
}

export function OrganisationSelector({ currentOrgSlug, userOrgs }: OrganisationSelectorProps): JSX.Element {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === '') {
      window.location.href = '/'
    } else {
      window.location.href = `/org/${value}`
    }
  }

  return (
    <select
      value={currentOrgSlug || ''}
      onChange={handleChange}
      style={{
        background: 'transparent',
        border: 'none',
        fontSize: '14px',
        fontWeight: 500,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: 'var(--text)',
        cursor: 'pointer',
        appearance: 'none',
        paddingRight: '20px',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right center',
      }}
    >
      <option value="">All</option>
      {userOrgs.map((org) => (
        <option key={org.id} value={org.slug}>
          {org.name}
        </option>
      ))}
    </select>
  )
}
