import type { APIRoute } from 'astro'
import { createAuth } from '../../../lib/auth'

export const prerender = false

export const ALL: APIRoute = async (context) => {
  const env = context.locals.runtime.env
  const auth = createAuth({
    DATABASE_URL: env.DATABASE_URL,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    APPLE_CLIENT_ID: env.APPLE_CLIENT_ID,
    APPLE_CLIENT_SECRET: env.APPLE_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  })

  return auth.handler(context.request)
}
