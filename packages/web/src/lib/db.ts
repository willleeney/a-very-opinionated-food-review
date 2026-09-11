import { Pool } from '@neondatabase/serverless'

let pool: Pool | null = null

export function getPool(databaseUrl: string): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl })
  }
  return pool
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
