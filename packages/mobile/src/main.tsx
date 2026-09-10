import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { initConfig } from '@tastefull/shared/lib/config'
import '@tastefull/shared/styles/global.css'

// Initialize config with Vite env vars
initConfig({
  authUrl: import.meta.env.VITE_AUTH_URL || '',
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
