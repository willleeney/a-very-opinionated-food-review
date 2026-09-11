import { createAuth } from './auth'

export type SessionUser = {
  id: string
  name: string
  email: string
  image?: string | null
}

type SessionEnv = {
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
}

export async function getSessionUser(request: Request, env: SessionEnv): Promise<SessionUser | null> {
  const auth = createAuth({
    DATABASE_URL: env.DATABASE_URL,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
  })

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return null

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  }
}
