import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@tastefull/shared/lib/supabase'

export async function registerPushNotifications(userId: string) {
  if (!Capacitor.isNativePlatform()) return

  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') return

  await PushNotifications.register()

  PushNotifications.addListener('registration', async ({ value: token }) => {
    // Save token to Supabase
    await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Capacitor.getPlatform() as 'ios' | 'android',
      },
      { onConflict: 'user_id,token' },
    )
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    const data = notification.notification.data
    if (data?.restaurantId) {
      // Navigate to restaurant — will be handled by the app's navigation
      window.location.href = '/'
    }
  })
}

export async function unregisterPushNotifications(userId: string) {
  if (!Capacitor.isNativePlatform()) return

  // Remove all tokens for this user
  await supabase.from('push_tokens').delete().eq('user_id', userId)
}
