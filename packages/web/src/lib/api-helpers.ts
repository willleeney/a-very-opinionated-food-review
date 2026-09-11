import type { APIContext } from 'astro'
import { getPool } from './db'
import { getSessionUser, type SessionUser } from './session'
import type { Pool } from '@neondatabase/serverless'

export type ApiContext = {
  pool: Pool
  user: SessionUser | null
  params: URLSearchParams
  body: Record<string, unknown> | null
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function error(message: string, status = 400) {
  return json({ error: message }, status)
}

export async function withApi(
  context: APIContext,
  handler: (ctx: ApiContext) => Promise<Response>,
  { requireAuth = false } = {}
): Promise<Response> {
  const env = context.locals.runtime.env
  const pool = getPool(env.DATABASE_URL)
  const user = await getSessionUser(context.request, env)

  if (requireAuth && !user) {
    return error('Unauthorized', 401)
  }

  const url = new URL(context.request.url)
  let body: Record<string, unknown> | null = null
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(context.request.method)) {
    try {
      body = await context.request.json()
    } catch {
      body = null
    }
  }

  return handler({ pool, user, params: url.searchParams, body })
}
