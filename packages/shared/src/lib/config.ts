export interface AppConfig {
  authUrl: string
  googleMapsApiKey: string
}

let _config: AppConfig | null = null

export function initConfig(config: AppConfig) {
  _config = config
}

export function getConfig(): AppConfig {
  if (_config) return _config
  return {
    authUrl: import.meta.env.PUBLIC_AUTH_URL || import.meta.env.VITE_AUTH_URL || '',
    googleMapsApiKey: import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  }
}
