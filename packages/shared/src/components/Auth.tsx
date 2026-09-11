import { useState } from 'react'
import { signIn, signUp, requestPasswordReset, resetPassword } from '../lib/auth-client'
import { getOrigin, openExternal, isNativePlatform } from '../lib/navigation'

// Password reset links land back here with ?token=... in the query string.
function getResetToken(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('token')
}

export function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetToken] = useState(getResetToken)
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>(
    resetToken ? 'reset' : 'login'
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'forgot') {
      const { error } = await requestPasswordReset({
        email,
        redirectTo: `${getOrigin()}/login`,
      })
      if (error) {
        setError(error.message ?? 'Could not send the reset link')
      } else {
        setError('Check your email for the password reset link!')
      }
    } else if (mode === 'reset') {
      const { error } = await resetPassword({
        newPassword: password,
        token: resetToken || '',
      })
      if (error) {
        setError(error.message ?? 'Could not update your password')
      } else {
        setError('Password updated successfully!')
        setTimeout(() => { window.location.href = '/' }, 1500)
      }
    } else if (mode === 'signup') {
      const { error } = await signUp.email({
        email,
        password,
        name: name || email.split('@')[0],
      })
      if (error) {
        setError(error.message ?? 'Could not create your account')
      } else {
        window.location.href = '/'
      }
    } else {
      const { error } = await signIn.email({ email, password })
      if (error) {
        setError(error.message ?? 'Could not sign you in')
      } else {
        window.location.href = '/'
      }
    }

    setLoading(false)
  }

  const handleSocialSignIn = async (provider: 'apple' | 'google') => {
    const { data, error: oauthError } = await signIn.social({
      provider,
      callbackURL: `${getOrigin()}/`,
    })
    if (data?.url && isNativePlatform()) {
      await openExternal(data.url)
    }
    if (oauthError) setError(oauthError.message ?? 'Could not sign you in')
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
            {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Join us' : mode === 'reset' ? 'Set new password' : 'Reset password'}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {mode === 'login'
              ? 'Sign in to rate your lunch spots'
              : mode === 'signup'
              ? 'Create an account to start reviewing'
              : mode === 'reset'
              ? 'Enter your new password below'
              : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '24px' }}>
            {mode !== 'reset' && (
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
                  data-testid="auth-email"
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={{ width: '100%' }}
                  data-testid="auth-name"
                />
              </div>
            )}

            {(mode !== 'forgot') && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {mode === 'reset' ? 'New Password' : 'Password'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  style={{ width: '100%' }}
                  data-testid="auth-password"
                />
              </div>
            )}

            {error && (
              <p style={{
                fontSize: '14px',
                color: (error.includes('Check') || error.includes('successfully')) ? 'var(--great)' : 'var(--poor)'
              }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn btn-accent" style={{ width: '100%' }} data-testid="auth-submit">
              {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Update Password' : 'Send Reset Link'}
            </button>

            {mode === 'login' && (
              <>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '8px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                </div>

                <button
                  type="button"
                  onClick={() => handleSocialSignIn('apple')}
                  className="btn"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#000', color: '#fff', borderColor: '#000' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continue with Apple
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialSignIn('google')}
                  className="btn"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </>
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
