import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Dashboard } from './Dashboard'
import { LandingPage } from './LandingPage'

export function HomePage() {
  const [viewState, setViewState] = useState<'loading' | 'landing' | 'dashboard'>('loading')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setViewState(session?.user ? 'dashboard' : 'landing')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setViewState(session?.user ? 'dashboard' : 'landing')
    })

    return () => subscription.unsubscribe()
  }, [])

  if (viewState === 'loading') {
    return (
      <div className="loading" data-testid="app-loading">
        <div className="spinner" />
      </div>
    )
  }

  if (viewState === 'dashboard') {
    return <div data-testid="dashboard-view"><Dashboard /></div>
  }

  return <div data-testid="landing-view"><LandingPage /></div>
}
