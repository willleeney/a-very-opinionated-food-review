import type { APIRoute } from 'astro'
import type { Pool } from '@neondatabase/serverless'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

const PROFILE_COLUMNS = 'id, display_name, email, is_private, avatar_url'

/** Most ids we will look up in one batch, to stop the endpoint being an email dump. */
const MAX_IDS = 200

type ProfileRow = { id: string; email: string | null }

/**
 * Emails are only visible to the subject themselves or to someone who shares an
 * organisation with them. Every other row gets its email nulled out.
 */
async function maskEmails<T extends ProfileRow>(
  pool: Pool,
  viewerId: string,
  rows: T[]
): Promise<T[]> {
  const otherIds = rows.map((r) => r.id).filter((id) => id !== viewerId)

  let sharedOrg = new Set<string>()
  if (otherIds.length > 0) {
    const { rows: shared } = await pool.query(
      `SELECT DISTINCT b.user_id
       FROM organisation_members a
       JOIN organisation_members b ON a.organisation_id = b.organisation_id
       WHERE a.user_id = $1 AND b.user_id = ANY($2)`,
      [viewerId, otherIds]
    )
    sharedOrg = new Set(shared.map((r) => r.user_id as string))
  }

  return rows.map((row) =>
    row.id === viewerId || sharedOrg.has(row.id) ? row : { ...row, email: null }
  )
}

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, params, body }) => {
      const method = context.request.method

      if (method === 'GET') {
        const ids = params.get('ids')
        const id = params.get('id')

        if (ids) {
          if (!user) return error('Unauthorized', 401)
          const idList = ids
            .split(',')
            .map((i) => i.trim())
            .slice(0, MAX_IDS)
          const { rows } = await pool.query(
            `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = ANY($1)`,
            [idList]
          )
          return json(await maskEmails(pool, user.id, rows as ProfileRow[]))
        }

        if (id) {
          if (!user) return error('Unauthorized', 401)
          const { rows } = await pool.query(
            `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = $1`,
            [id]
          )
          if (rows.length === 0) return json(null)
          const [masked] = await maskEmails(pool, user.id, rows as ProfileRow[])
          return json(masked)
        }

        // Directory listing for the "Find people" tab. Signed-in only, since it
        // enumerates users; the caller is excluded from their own results.
        if (params.get('exclude') !== null) {
          if (!user) return error('Unauthorized', 401)
          const limit = Math.min(Number(params.get('limit')) || 100, 100)
          const { rows } = await pool.query(
            `SELECT ${PROFILE_COLUMNS}
             FROM profiles WHERE id <> $1 LIMIT $2`,
            [user.id, limit]
          )
          return json(await maskEmails(pool, user.id, rows as ProfileRow[]))
        }

        return error('id or ids parameter is required')
      }

      if (method === 'PUT') {
        if (!user) return error('Unauthorized', 401)

        const updates: string[] = []
        const values: unknown[] = []
        let idx = 1

        if (body?.display_name !== undefined) {
          updates.push(`display_name = $${idx++}`)
          values.push(body.display_name)
        }
        if (body?.is_private !== undefined) {
          updates.push(`is_private = $${idx++}`)
          values.push(body.is_private)
        }
        if (body?.avatar_url !== undefined) {
          updates.push(`avatar_url = $${idx++}`)
          values.push(body.avatar_url)
        }

        if (updates.length === 0) return error('No fields to update')

        values.push(user.id)
        const { rows } = await pool.query(
          `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
          values
        )
        if (rows.length === 0) return error('Profile not found', 404)
        return json(rows[0])
      }

      if (method === 'DELETE') {
        if (!user) return error('Unauthorized', 401)

        const { rowCount } = await pool.query('DELETE FROM profiles WHERE id = $1', [user.id])
        if (rowCount === 0) return error('Profile not found', 404)
        return json({ success: true })
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
