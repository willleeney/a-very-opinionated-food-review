import { useEffect } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { setNavigate, setGetOrigin } from '@tastefull/shared/lib/navigation'
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
    }

    // Native-only setup
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Light }).catch(() => {})
      StatusBar.setBackgroundColor({ color: '#faf8f5' }).catch(() => {})
      SplashScreen.hide().catch(() => {})

      // Handle deep links (OAuth callback, etc.)
      CapApp.addListener('appUrlOpen', ({ url }) => {
        if (url.includes('callback')) {
          window.location.href = '/'
        }
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
