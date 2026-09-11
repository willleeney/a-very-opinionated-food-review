import { useSession } from '../lib/auth-client'
import { Dashboard } from './Dashboard'
import { LandingPage } from './LandingPage'

export function HomePage() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="loading" data-testid="app-loading">
        <div className="spinner" />
      </div>
    )
  }

  if (session?.user) {
    return <div data-testid="dashboard-view"><Dashboard /></div>
  }

  return <div data-testid="landing-view"><LandingPage /></div>
}
