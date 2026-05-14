import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client for direct DB verification in tests.
 * Uses the service_role key for unrestricted access.
 * Only connects to LOCAL Supabase — never production.
 */
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

export async function getRestaurantByName(name: string) {
  const { data } = await adminClient
    .from('restaurants')
    .select('*')
    .eq('name', name)
    .single()
  return data
}

export async function getReviewsByRestaurant(restaurantId: string) {
  const { data } = await adminClient
    .from('reviews')
    .select('*')
    .eq('restaurant_id', restaurantId)
  return data || []
}

export async function getReviewsByUser(userId: string) {
  const { data } = await adminClient
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
  return data || []
}

export async function deleteRestaurantByName(name: string) {
  await adminClient.from('restaurants').delete().eq('name', name)
}
