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

/**
 * Build a Better Auth instance for the current request.
 *
 * Must NOT be memoised across requests. The instance owns a Neon pool, and a
 * Workers isolate is reused between requests while its connections are not —
 * sharing one throws "Cannot perform I/O on behalf of a different request"
 * (Cloudflare error 1101). See the note in ./db.ts.
 */
export function createAuth(env: AuthEnv) {
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
