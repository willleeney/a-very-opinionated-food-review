import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

/**
 * Load DATABASE_URL (and friends) from the repo-root .env files.
 * Imported by both global-setup and the per-worker db helper, since Playwright
 * workers are separate processes and don't inherit setup-time mutations reliably.
 */
dotenv.config({ path: path.join(repoRoot, '.env.local'), quiet: true })
dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true })

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add it to .env (or .env.local) at the repo root — the e2e suite talks to Neon directly.'
    )
  }
  return url
}
