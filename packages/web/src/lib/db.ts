import { Pool } from '@neondatabase/serverless'

/**
 * A Neon pool for the current request.
 *
 * Deliberately NOT cached at module scope. A Workers isolate is reused across
 * requests, but a connection opened during one request cannot be used by
 * another — doing so throws "Cannot perform I/O on behalf of a different
 * request" and surfaces as an intermittent 500 (Cloudflare error 1101). Caching
 * here made roughly one request in five fail in production while working fine
 * under Miniflare locally, which is far more permissive.
 *
 * Constructing a Pool is cheap: it opens no socket until the first query, and
 * DATABASE_URL points at Neon's pooled (-pooler) endpoint, so PgBouncer absorbs
 * the per-request connections.
 */
export function getPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl })
}

export type QueryResult<T = Record<string, unknown>> = {
  rows: T[]
  rowCount: number
}

export async function query<T = Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const result = await pool.query(sql, params)
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 }
}
