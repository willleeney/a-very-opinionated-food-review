/**
 * Replaces the local database's app data with a small, obviously-fake dataset.
 *
 *   pnpm seed:dev
 *
 * Reads DATABASE_URL from packages/web/.dev.vars — the same value `astro dev`
 * uses — so it can only ever target whatever local dev is already pointed at.
 * It additionally refuses to run against the known production endpoint.
 *
 * The places are deliberately silly. If you are looking at "Lord of the Fries"
 * you are on local; if you are looking at real restaurants you are on prod.
 *
 * Users are NOT touched — sign in with the accounts from `pnpm seed:users`
 * (or any account already in the branch).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Pool } from '@neondatabase/serverless'

const here = dirname(fileURLToPath(import.meta.url))
const DEV_VARS = join(here, '..', 'packages', 'web', '.dev.vars')

/** Production's Neon endpoint. This script must never touch it. */
const PROD_HOST_FRAGMENT = 'ep-lucky-union'

function readDatabaseUrl() {
  let raw
  try {
    raw = readFileSync(DEV_VARS, 'utf8')
  } catch {
    console.error(`Could not read ${DEV_VARS}.\nLocal dev config is missing — see .env.example.`)
    process.exit(1)
  }
  const line = raw.split('\n').find((l) => l.trim().startsWith('DATABASE_URL'))
  const url = line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
  if (!url) {
    console.error(`No DATABASE_URL in ${DEV_VARS}.`)
    process.exit(1)
  }
  return url
}

const DATABASE_URL = readDatabaseUrl()
const host = new URL(DATABASE_URL).host

if (host.includes(PROD_HOST_FRAGMENT)) {
  console.error(`REFUSING TO RUN.\n\n  ${host}\n\nis the production database. This script only seeds local branches.`)
  process.exit(1)
}

// Around London Bridge so the map has something to show.
const PLACES = [
  { name: 'Lord of the Fries',      cuisine: 'Chips',    type: 'Chips',    lat: 51.5052, lng: -0.0881, cats: ['lunch'] },
  { name: 'Wok This Way',           cuisine: 'Chinese',  type: 'Chinese',  lat: 51.5039, lng: -0.0902, cats: ['lunch', 'dinner'] },
  { name: 'Pita Pan',               cuisine: 'Greek',    type: 'Greek',    lat: 51.5061, lng: -0.0868, cats: ['lunch'] },
  { name: 'The Soggy Bottom',       cuisine: 'Bakery',   type: 'Bakery',   lat: 51.5044, lng: -0.0913, cats: ['brunch', 'coffee'] },
  { name: 'Brew Order',             cuisine: 'Coffee',   type: 'Coffee',   lat: 51.5031, lng: -0.0874, cats: ['coffee'] },
  { name: 'Nacho Average Burrito',  cuisine: 'Mexican',  type: 'Mexican',  lat: 51.5068, lng: -0.0895, cats: ['lunch', 'dinner'] },
]

const COMMENTS = [
  'Structurally unsound but emotionally satisfying.',
  'Portion size implies a personal grudge.',
  'Would queue again. Reluctantly.',
  'The chilli oil has opinions.',
  'Fine. Genuinely, just fine.',
  'Better than it has any right to be.',
  'Ordered twice. Regret once.',
]

const pool = new Pool({ connectionString: DATABASE_URL })

async function main() {
  console.log(`Seeding ${host}\n`)

  const { rows: users } = await pool.query(
    `SELECT u.id, COALESCE(p.display_name, u.name) AS name
     FROM "user" u LEFT JOIN profiles p ON p.id = u.id
     ORDER BY u."createdAt" LIMIT 6`
  )
  if (users.length === 0) {
    console.error('No users in this branch — run `pnpm seed:users` first.')
    process.exit(1)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Clear app content. Users, profiles and orgs are left alone.
    await client.query('DELETE FROM review_tags')
    await client.query('DELETE FROM review_visibility')
    await client.query('DELETE FROM reviews')
    await client.query('DELETE FROM restaurants')

    const { rows: tags } = await client.query('SELECT id, name FROM tags ORDER BY name')

    let reviewCount = 0
    for (const [i, place] of PLACES.entries()) {
      const { rows: [restaurant] } = await client.query(
        `INSERT INTO restaurants (name, cuisine, type, categories, latitude, longitude, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [place.name, place.cuisine, place.type, place.cats, place.lat, place.lng, users[0].id]
      )

      // One or two reviews each, spread across whichever users exist.
      const reviewers = users.slice(i % users.length, (i % users.length) + 2)
      for (const [j, reviewer] of (reviewers.length ? reviewers : [users[0]]).entries()) {
        const { rows: [review] } = await client.query(
          `INSERT INTO reviews (restaurant_id, user_id, rating, comment, dish)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            restaurant.id,
            reviewer.id,
            4 + ((i * 3 + j * 2) % 7),
            COMMENTS[(i + j) % COMMENTS.length],
            null,
          ]
        )
        reviewCount++

        if (tags.length) {
          const tag = tags[(i + j) % tags.length]
          await client.query(
            'INSERT INTO review_tags (review_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [review.id, tag.id]
          )
        }
      }
    }

    await client.query('COMMIT')
    console.log(`  ${PLACES.length} places, ${reviewCount} reviews, across ${users.length} user(s)`)
    console.log(`\n  ${PLACES.map((p) => p.name).join(', ')}`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
