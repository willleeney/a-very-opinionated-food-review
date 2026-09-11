import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

// Explicit column list — the invite `token` is the join secret and must never
// appear in a listing response.
const INVITE_COLUMNS =
  'oi.id, oi.organisation_id, oi.email, oi.invited_by, oi.created_at, oi.expires_at'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, params, body }) => {
      const method = context.request.method

      if (method === 'GET') {
        const orgId = params.get('org_id')
        const email = params.get('email')
        const token = params.get('token')

        if (orgId) {
          if (!user) return error('Unauthorized', 401)

          const { rows: admin } = await pool.query(
            'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2 AND role = $3',
            [orgId, user.id, 'admin']
          )
          if (admin.length === 0) return error('Not an admin of this organisation', 403)

          const { rows } = await pool.query(
            `SELECT ${INVITE_COLUMNS}
             FROM organisation_invites oi
             WHERE oi.organisation_id = $1`,
            [orgId]
          )
          return json(rows)
        }

        if (email) {
          // The supplied email is ignored — a caller may only list invites
          // addressed to their own session email.
          if (!user) return error('Unauthorized', 401)
          if (!user.email) return json([])

          const { rows } = await pool.query(
            `SELECT ${INVITE_COLUMNS}, row_to_json(o.*) as organisation
             FROM organisation_invites oi
             JOIN organisations o ON o.id = oi.organisation_id
             WHERE LOWER(oi.email) = LOWER($1)`,
            [user.email]
          )
          return json(rows)
        }

        if (token) {
          // Reachable without a session: an anonymous visitor following an
          // invite link. Exact-match on the token, and expired invites are
          // treated as absent.
          const { rows } = await pool.query(
            `SELECT ${INVITE_COLUMNS}, oi.token, row_to_json(o.*) as organisation
             FROM organisation_invites oi
             JOIN organisations o ON o.id = oi.organisation_id
             WHERE oi.token = $1
               AND (oi.expires_at IS NULL OR oi.expires_at > now())`,
            [token]
          )
          if (rows.length === 0) return error('Invite not found or expired', 404)
          return json(rows[0])
        }

        return error('org_id, email, or token parameter is required')
      }

      if (method === 'POST') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.organisation_id || !body?.email) {
          return error('organisation_id and email are required')
        }
        if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email)) {
          return error('email must be a valid email address')
        }

        const { rows: admin } = await pool.query(
          'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2 AND role = $3',
          [body.organisation_id, user.id, 'admin']
        )
        if (admin.length === 0) return error('Not an admin of this organisation', 403)

        const { rows } = await pool.query(
          `INSERT INTO organisation_invites (organisation_id, email, invited_by)
           VALUES ($1, $2, $3)
           RETURNING *`,
          // Normalised on the way in so the invitee's own lookup and the
          // self-decline check below match regardless of how it was typed.
          [body.organisation_id, body.email.trim().toLowerCase(), user.id]
        )
        return json(rows[0], 201)
      }

      if (method === 'DELETE') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.id) return error('id is required')

        const { rows: invites } = await pool.query(
          'SELECT organisation_id, email FROM organisation_invites WHERE id = $1',
          [body.id]
        )
        if (invites.length === 0) return error('Invite not found', 404)
        const invite = invites[0]

        // Either an admin of the org revoking the invite, or the invitee
        // declining their own invite.
        const isInvitee =
          !!user.email &&
          String(invite.email).toLowerCase() === user.email.toLowerCase()
        if (!isInvitee) {
          const { rows: admin } = await pool.query(
            'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2 AND role = $3',
            [invite.organisation_id, user.id, 'admin']
          )
          if (admin.length === 0) return error('Not allowed to delete this invite', 403)
        }

        await pool.query('DELETE FROM organisation_invites WHERE id = $1', [body.id])
        return json({ success: true })
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
