/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>

interface Env {
  MEDIA: R2Bucket
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  APPLE_CLIENT_ID?: string
  APPLE_CLIENT_SECRET?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}

declare namespace App {
  interface Locals extends Runtime {}
}
