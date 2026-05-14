import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

interface ReviewPayload {
  type: 'INSERT'
  table: 'reviews'
  record: {
    id: string
    user_id: string
    restaurant_id: string
  }
}

Deno.serve(async (req) => {
  const payload: ReviewPayload = await req.json()

  if (payload.type !== 'INSERT') {
    return new Response('Not an insert', { status: 200 })
  }

  const { user_id: reviewerId, restaurant_id: restaurantId } = payload.record

  // Get reviewer profile
  const { data: reviewer } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', reviewerId)
    .single()

  // Get restaurant name
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name')
    .eq('id', restaurantId)
    .single()

  if (!reviewer || !restaurant) {
    return new Response('Missing data', { status: 200 })
  }

  // Get followers of the reviewer
  const { data: followers } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('following_id', reviewerId)

  if (!followers || followers.length === 0) {
    return new Response('No followers', { status: 200 })
  }

  const followerIds = followers.map((f) => f.follower_id)

  // Get push tokens for followers
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token, platform')
    .in('user_id', followerIds)

  if (!tokens || tokens.length === 0) {
    return new Response('No push tokens', { status: 200 })
  }

  const reviewerName = reviewer.display_name || reviewer.email || 'Someone'
  const title = 'New Review'
  const body = `${reviewerName} reviewed ${restaurant.name}`

  // Send to FCM (handles both iOS and Android via Firebase)
  const fcmKey = Deno.env.get('FCM_SERVER_KEY')
  if (fcmKey) {
    const fcmTokens = tokens.map((t) => t.token)

    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${fcmKey}`,
      },
      body: JSON.stringify({
        registration_ids: fcmTokens,
        notification: { title, body },
        data: { restaurantId, reviewerId },
      }),
    })
  }

  return new Response(JSON.stringify({ sent: tokens.length }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
