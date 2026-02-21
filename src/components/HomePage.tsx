import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Dashboard } from './Dashboard'
import { LandingPage } from './LandingPage'

export function HomePage(): JSX.Element {
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
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  if (viewState === 'dashboard') {
    return <Dashboard />
  }

  return <LandingPage />
}
