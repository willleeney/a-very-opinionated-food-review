import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Auth(): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`
      })
      if (error) {
        setError(error.message)
      } else {
        setError('Check your email for the password reset link!')
      }
    } else {
      const { error } = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

      if (error) {
        setError(error.message)
      } else if (mode === 'signup') {
        setError('Check your email for the confirmation link!')
      } else {
        window.location.href = '/'
      }
    }

    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ marginBottom: '48px', textAlign: 'center' }}>
          <a href="/" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
            ← Back to reviews
          </a>
        </div>

        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', marginBottom: '16px' }}>
            {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Join us' : 'Reset password'}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {mode === 'login'
              ? 'Sign in to rate your lunch spots'
              : mode === 'signup'
              ? 'Create an account to start reviewing'
              : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                style={{ width: '100%' }}
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {error && (
              <p style={{
                fontSize: '14px',
                color: error.includes('Check') ? 'var(--great)' : 'var(--poor)'
              }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn btn-accent" style={{ width: '100%' }}>
              {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(null) }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  width: '100%',
                  textAlign: 'center'
                }}
              >
                Forgot your password?
              </button>
            )}
          </div>
        </form>

        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {mode === 'forgot' ? (
              <button
                onClick={() => { setMode('login'); setError(null) }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  fontSize: '14px'
                }}
              >
                ← Back to sign in
              </button>
            ) : (
              <>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    fontSize: '14px'
                  }}
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
