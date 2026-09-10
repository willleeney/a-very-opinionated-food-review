import { betterAuth } from 'better-auth'
import { Pool } from '@neondatabase/serverless'
import { getPool } from './db'

type AuthEnv = {
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  APPLE_CLIENT_ID?: string
  APPLE_CLIENT_SECRET?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}

// Every request resolves a session, so building a fresh betterAuth instance (and
// with it a fresh, never-closed Neon Pool) per request leaked connections.
// Memoised on the isolate, keyed by the settings that affect the instance.
const cache = new Map<string, ReturnType<typeof buildAuth>>()

export function createAuth(env: AuthEnv) {
  const key = [env.DATABASE_URL, env.BETTER_AUTH_URL, env.GOOGLE_CLIENT_ID ?? '', env.APPLE_CLIENT_ID ?? ''].join('|')
  let instance = cache.get(key)
  if (!instance) {
    instance = buildAuth(env)
    cache.set(key, instance)
  }
  return instance
}

function buildAuth(env: AuthEnv) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: getPool(env.DATABASE_URL) as unknown as Pool,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
    },
    socialProviders: {
      ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET ? {
        apple: {
          clientId: env.APPLE_CLIENT_ID,
          clientSecret: env.APPLE_CLIENT_SECRET,
        },
      } : {}),
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      } : {}),
    },
    // No additionalFields on `user`: the app's editable display name lives in
    // `profiles.display_name`, which the /api/data/profiles route owns. Declaring
    // a `displayName` field here made Better Auth expect a column that does not
    // exist and fail its schema check on every request.
  })
}

export type Auth = ReturnType<typeof createAuth>
