import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'

// The mobile app is not served from the same origin as the API, so requests
// need an absolute base URL — same mechanism as the Better Auth client.
const API_BASE = import.meta.env.VITE_AUTH_URL || import.meta.env.VITE_API_URL || ''

async function savePushToken(token: string, platform: 'ios' | 'android') {
  const res = await fetch(`${API_BASE}/api/data/push-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, platform }),
  })
  if (!res.ok) throw new Error(await res.text())
}

async function deletePushTokens() {
  const res = await fetch(`${API_BASE}/api/data/push-tokens`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function registerPushNotifications() {
  if (!Capacitor.isNativePlatform()) return

  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') return

  await PushNotifications.register()

  PushNotifications.addListener('registration', async ({ value: token }) => {
    await savePushToken(token, Capacitor.getPlatform() as 'ios' | 'android')
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    const data = notification.notification.data
    if (data?.restaurantId) {
      // Navigate to restaurant — will be handled by the app's navigation
      window.location.href = '/'
    }
  })
}

export async function unregisterPushNotifications() {
  if (!Capacitor.isNativePlatform()) return

  // Remove all tokens for this user
  await deletePushTokens()
}
