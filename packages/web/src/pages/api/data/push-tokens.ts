import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, body }) => {
      const method = context.request.method

      if (!user) return error('Unauthorized', 401)

      if (method === 'POST') {
        if (!body?.token || !body?.platform) {
          return error('token and platform are required')
        }
        if (body.platform !== 'ios' && body.platform !== 'android') {
          return error('platform must be ios or android')
        }

        await pool.query(
          `INSERT INTO push_tokens (user_id, token, platform)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, token) DO NOTHING`,
          [user.id, body.token, body.platform]
        )
        return json({ success: true }, 201)
      }

      if (method === 'DELETE') {
        if (body?.token) {
          await pool.query('DELETE FROM push_tokens WHERE user_id = $1 AND token = $2', [
            user.id,
            body.token,
          ])
        } else {
          await pool.query('DELETE FROM push_tokens WHERE user_id = $1', [user.id])
        }
        return json({ success: true })
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
