import { Network } from '@capacitor/network'
import { Preferences } from '@capacitor/preferences'

const CACHE_KEY = 'tastefull_cached_data'

export interface CachedData {
  restaurants: unknown[]
  reviews: unknown[]
  timestamp: number
}

export async function getCachedData(): Promise<CachedData | null> {
  const { value } = await Preferences.get({ key: CACHE_KEY })
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export async function setCachedData(data: Omit<CachedData, 'timestamp'>) {
  await Preferences.set({
    key: CACHE_KEY,
    value: JSON.stringify({ ...data, timestamp: Date.now() }),
  })
}

export function onNetworkChange(callback: (connected: boolean) => void) {
  Network.addListener('networkStatusChange', (status) => {
    callback(status.connected)
  })
}

export async function isOnline(): Promise<boolean> {
  const status = await Network.getStatus()
  return status.connected
}
