import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, params, body }) => {
      const method = context.request.method

      if (method === 'GET') {
        const orgId = params.get('org_id')
        const userId = params.get('user_id')

        if (orgId) {
          if (!user) return error('Unauthorized', 401)

          const { rows: admin } = await pool.query(
            'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2 AND role = $3',
            [orgId, user.id, 'admin']
          )
          if (admin.length === 0) return error('Not an admin of this organisation', 403)

          // Join the requester's profile here rather than letting the client
          // fetch it separately: a join requester by definition shares no org
          // with the admin yet, so /api/data/profiles masks their email. Admin
          // rights on this org are already proven above, and the email is the
          // main signal for deciding whether to approve.
          const { rows } = await pool.query(
            `SELECT r.*, p.display_name AS requester_display_name,
                    p.email AS requester_email, p.avatar_url AS requester_avatar_url
             FROM organisation_requests r
             LEFT JOIN profiles p ON p.id = r.user_id
             WHERE r.organisation_id = $1`,
            [orgId]
          )
          return json(rows)
        }

        if (userId) {
          if (!user) return error('Unauthorized', 401)
          if (userId !== user.id) {
            return error('Can only read your own join requests', 403)
          }

          const { rows } = await pool.query(
            `SELECT orq.*, row_to_json(o.*) as organisation
             FROM organisation_requests orq
             JOIN organisations o ON o.id = orq.organisation_id
             WHERE orq.user_id = $1`,
            [userId]
          )
          return json(rows)
        }

        return error('org_id or user_id parameter is required')
      }

      if (method === 'POST') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.organisation_id) return error('organisation_id is required')

        const { rows } = await pool.query(
          `INSERT INTO organisation_requests (organisation_id, user_id)
           VALUES ($1, $2)
           RETURNING *`,
          [body.organisation_id, user.id]
        )
        return json(rows[0], 201)
      }

      if (method === 'DELETE') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.id) return error('id is required')

        const { rows: existing } = await pool.query(
          'SELECT organisation_id, user_id FROM organisation_requests WHERE id = $1',
          [body.id]
        )
        if (existing.length === 0) return error('Request not found', 404)

        // The requester may withdraw their own request; an admin of the target
        // organisation may approve or deny it. Nobody else may touch it.
        const request = existing[0]
        if (request.user_id !== user.id) {
          const { rows: admin } = await pool.query(
            'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2 AND role = $3',
            [request.organisation_id, user.id, 'admin']
          )
          if (admin.length === 0) {
            return error('Not allowed to delete this request', 403)
          }
        }

        await pool.query('DELETE FROM organisation_requests WHERE id = $1', [body.id])
        return json({ success: true })
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
