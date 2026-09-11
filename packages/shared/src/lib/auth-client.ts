import { createAuthClient } from 'better-auth/react'

const baseURL = import.meta.env.PUBLIC_AUTH_URL || import.meta.env.VITE_AUTH_URL || ''

export const authClient = createAuthClient({ baseURL })

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
} = authClient

export type AuthUser = {
  id: string
  name: string
  email: string
  image?: string | null
}

/**
 * Imperative session fetch — the drop-in replacement for supabase.auth.getUser().
 * Returns the user or null when signed out.
 */
export async function getUser(): Promise<AuthUser | null> {
  const { data } = await authClient.getSession()
  if (!data?.user) return null
  const { id, name, email, image } = data.user
  return { id, name, email, image }
}
