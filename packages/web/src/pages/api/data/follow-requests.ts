import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, params, body }) => {
      const method = context.request.method

      if (method === 'GET') {
        const targetId = params.get('target_id')
        const requesterId = params.get('requester_id')

        // Callers may only read requests addressed to or sent by themselves.
        if (targetId) {
          if (!user) return error('Unauthorized', 401)
          if (targetId !== user.id) {
            return error('Can only read your own incoming follow requests', 403)
          }
          const { rows } = await pool.query(
            'SELECT * FROM follow_requests WHERE target_id = $1',
            [targetId]
          )
          return json(rows)
        }

        if (requesterId) {
          if (!user) return error('Unauthorized', 401)
          if (requesterId !== user.id) {
            return error('Can only read your own outgoing follow requests', 403)
          }
          const { rows } = await pool.query(
            'SELECT * FROM follow_requests WHERE requester_id = $1',
            [requesterId]
          )
          return json(rows)
        }

        return error('target_id or requester_id parameter is required')
      }

      if (method === 'POST') {
        if (!user) return error('Unauthorized', 401)

        if (body?.action === 'accept') {
          if (!body?.requester_id) return error('requester_id is required')

          await pool.query('SELECT accept_follow_request($1, $2)', [
            body.requester_id,
            user.id,
          ])
          return json({ success: true })
        }

        if (!body?.requester_id || !body?.target_id) {
          return error('requester_id and target_id are required')
        }
        if (body.requester_id !== user.id) {
          return error('Cannot create request on behalf of another user', 403)
        }

        const { rows } = await pool.query(
          `INSERT INTO follow_requests (requester_id, target_id)
           VALUES ($1, $2)
           RETURNING *`,
          [body.requester_id, body.target_id]
        )
        return json(rows[0], 201)
      }

      if (method === 'DELETE') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.requester_id || !body?.target_id) {
          return error('requester_id and target_id are required')
        }

        const isRequester = body.requester_id === user.id
        const isTarget = body.target_id === user.id
        if (!isRequester && !isTarget) {
          return error('Can only delete your own follow requests', 403)
        }

        await pool.query(
          'DELETE FROM follow_requests WHERE requester_id = $1 AND target_id = $2',
          [body.requester_id, body.target_id]
        )
        return json({ success: true })
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
