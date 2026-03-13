/**
 * Known seed data from supabase/seed.sql.
 * Use these constants in tests for deterministic assertions.
 */

export const RESTAURANTS = {
  boroughMarket: { name: 'Borough Market Kitchen', cuisine: 'British' },
  padella: { name: 'Padella', cuisine: 'Italian' },
  hawksmoor: { name: 'Hawksmoor Borough', cuisine: 'Steakhouse' },
  flatIron: { name: 'Flat Iron', cuisine: 'Steakhouse' },
  pho: { name: 'Pho', cuisine: 'Vietnamese' },
  monmouth: { name: 'Monmouth Coffee', cuisine: 'Cafe' },
  theRake: { name: 'The Rake', cuisine: 'Pub' },
  arabica: { name: 'Arabica Bar & Kitchen', cuisine: 'Middle Eastern' },
} as const

export const TOTAL_RESTAURANTS = 8

export const TAGS = [
  'Good Value',
  'Healthy',
  'High Protein',
  'Large Portion',
  'Outdoor Seating',
  'Quick',
  'Quiet',
  'Vegan Options',
] as const

export const ORGS = {
  stackone: { name: 'StackOne', slug: 'stackone' },
  acme: { name: 'Acme Corp', slug: 'acme' },
  testOrg: { name: 'Test Org', slug: 'test-org' },
} as const
