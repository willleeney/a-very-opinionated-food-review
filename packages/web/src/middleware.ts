import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next()

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  )
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )

  const isDev = import.meta.env.DEV
  const connectSrc = isDev
    ? "connect-src 'self' http://127.0.0.1:* http://localhost:* https://*.supabase.co https://nominatim.openstreetmap.org https://places.googleapis.com"
    : "connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org https://places.googleapis.com"
  const imgSrc = isDev
    ? "img-src 'self' data: blob: http://127.0.0.1:* http://localhost:* https://*.basemaps.cartocdn.com https://*.supabase.co https://unpkg.com"
    : "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.supabase.co https://unpkg.com"

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com",
      imgSrc,
      connectSrc,
      "frame-ancestors 'none'",
    ].join('; ')
  )

  return response
})
