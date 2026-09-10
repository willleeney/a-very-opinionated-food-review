import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, params, body }) => {
      const method = context.request.method

      if (method === 'GET') {
        const followerId = params.get('follower_id')
        const followingId = params.get('following_id')

        // Follow graphs are private: callers may only read their own lists.
        if (followerId) {
          if (!user) return error('Unauthorized', 401)
          if (followerId !== user.id) {
            return error('Can only read your own following list', 403)
          }
          const { rows } = await pool.query(
            'SELECT * FROM user_follows WHERE follower_id = $1',
            [followerId]
          )
          return json(rows)
        }

        if (followingId) {
          if (!user) return error('Unauthorized', 401)
          if (followingId !== user.id) {
            return error('Can only read your own followers list', 403)
          }
          const { rows } = await pool.query(
            'SELECT * FROM user_follows WHERE following_id = $1',
            [followingId]
          )
          return json(rows)
        }

        return error('follower_id or following_id parameter is required')
      }

      if (method === 'POST') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.follower_id || !body?.following_id) {
          return error('follower_id and following_id are required')
        }
        if (body.follower_id !== user.id) {
          return error('Cannot follow on behalf of another user', 403)
        }

        const { rows } = await pool.query(
          `INSERT INTO user_follows (follower_id, following_id)
           VALUES ($1, $2)
           RETURNING *`,
          [body.follower_id, body.following_id]
        )
        return json(rows[0], 201)
      }

      if (method === 'DELETE') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.follower_id || !body?.following_id) {
          return error('follower_id and following_id are required')
        }

        const isFollower = body.follower_id === user.id
        const isFollowed = body.following_id === user.id
        if (!isFollower && !isFollowed) {
          return error('Can only remove your own follow relationships', 403)
        }

        await pool.query(
          'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2',
          [body.follower_id, body.following_id]
        )
        return json({ success: true })
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
