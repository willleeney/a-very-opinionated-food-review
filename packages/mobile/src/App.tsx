import { useEffect } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { setNavigate, setGetOrigin, setOpenExternal } from '@tastefull/shared/lib/navigation'
import { authClient } from '@tastefull/shared/lib/auth-client'
import { setPlatformInfo } from '@tastefull/shared/hooks/usePlatform'
import { MobileShell } from './MobileShell'

// Shared components
import { HomePage } from '@tastefull/shared/components/HomePage'
import { Auth } from '@tastefull/shared/components/Auth'
import { PersonalSettings } from '@tastefull/shared/components/PersonalSettings'
import { NetworkView } from '@tastefull/shared/components/NetworkView'
import { Dashboard } from '@tastefull/shared/components/Dashboard'
import { OrganisationAdmin } from '@tastefull/shared/components/OrganisationAdmin'
import { AcceptInvite } from '@tastefull/shared/components/AcceptInvite'

function NavigationBridge() {
  const nav = useNavigate()

  useEffect(() => {
    setNavigate((path: string) => nav(path))
  }, [nav])

  return null
}

function OrgPage() {
  const { slug } = useParams()
  return <Dashboard organisationSlug={slug} />
}

function OrgAdminPage() {
  const { slug } = useParams()
  return <OrganisationAdmin organisationSlug={slug!} />
}

function InvitePage() {
  const { token } = useParams()
  return <AcceptInvite token={token!} />
}

export function App() {
  useEffect(() => {
    // Set platform info for shared components
    setPlatformInfo(
      Capacitor.isNativePlatform(),
      Capacitor.getPlatform(),
    )

    // On native, OAuth redirects should use the custom URL scheme
    if (Capacitor.isNativePlatform()) {
      setGetOrigin(() => 'com.tastefull.app:/')
      setOpenExternal((url: string) => Browser.open({ url }))
    }

    // Native-only setup
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Light }).catch(() => {})
      StatusBar.setBackgroundColor({ color: '#faf8f5' }).catch(() => {})
      SplashScreen.hide().catch(() => {})

      // Handle deep links (OAuth callback, etc.)
      // Better Auth uses httpOnly cookie sessions — there are no access/refresh
      // tokens to install client-side. The session cookie is already set by the
      // server during the OAuth round-trip, so all we do here is close the
      // in-app browser, re-read the session, and navigate into the app.
      //
      // TODO: Native OAuth on Capacitor should use Better Auth's ID-token
      // sign-in (`signIn.social({ provider, idToken: { token } })`) with a token
      // obtained from the native Google/Apple SDKs. That native SDK integration
      // is out of scope here, so the current flow relies on the system browser
      // round-trip and the cookie it sets.
      CapApp.addListener('appUrlOpen', async () => {
        Browser.close().catch(() => {})
        await authClient.getSession({ query: { disableCookieCache: true } }).catch(() => {})
        window.location.href = '/'
      })

      // Handle Android back button
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          CapApp.exitApp()
        }
      })
    }
  }, [])

  return (
    <MobileShell>
      <NavigationBridge />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/settings" element={<PersonalSettings />} />
        <Route path="/network" element={<NetworkView />} />
        <Route path="/org/:slug" element={<OrgPage />} />
        <Route path="/org/:slug/admin" element={<OrgAdminPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
      </Routes>
    </MobileShell>
  )
}
