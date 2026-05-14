export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  googleMapsApiKey: string
}

let _config: AppConfig | null = null

export function initConfig(config: AppConfig) {
  _config = config
}

export function getConfig(): AppConfig {
  if (_config) return _config
  return {
    supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    googleMapsApiKey: import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  }
}
