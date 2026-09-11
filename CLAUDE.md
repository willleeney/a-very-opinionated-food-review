# CLAUDE.md - Project Guidelines

## Overview

A food review website for the team at Runway East, London Bridge. Honest, opinionated reviews of lunch spots in the neighbourhood.

**Tech Stack:** pnpm monorepo — Astro + React islands (web), Capacitor + Vite (mobile), shared component library. Neon Postgres + Better Auth, Cloudflare Workers (R2 for media), Leaflet maps.

**Monorepo Structure:**
- `packages/web/` — Astro site deployed to Cloudflare Workers
- `packages/shared/` — React components, utilities, styles (shared between web + mobile)
- `packages/mobile/` — Capacitor + Vite for iOS/Android

## Visual QA

Run `/visual-qa` to capture 57 screenshots of every screen state and do a thorough visual inspection. The capture script lives at `e2e/capture-screens.ts` and outputs to `e2e/screenshots/`. See `~/.claude/skills/visual-qa/SKILL.md` for the full checklist.

## App Store & Release Skills

The following agent skills are installed for iOS release automation:

- **ASO Skills** (`Eronred/aso-skills`) — App Store Optimization: keyword research, metadata optimization, competitor analysis, app icon optimization, creative testing
- **App Store Preflight** (`truongduy2611/app-store-preflight-skills`) — Scan Xcode project for App Store rejection patterns before submission
- **App Store Connect CLI** (`rorkai/app-store-connect-cli-skills`) — Automate TestFlight, builds, submissions, signing, analytics, screenshots via `asc` CLI (installed at `/opt/homebrew/bin/asc`)

## Design Philosophy

**Editorial, not dashboard.** This is a publication, not a SaaS product. Think newspaper food section, not analytics tool.

- Warm, paper-like aesthetic over cold tech vibes
- Typography-first design with generous whitespace
- Minimal chrome - borders are subtle, shadows are rare
- Content takes center stage

## Color Palette

```css
--bg: #faf8f5;           /* Warm off-white paper background */
--bg-warm: #f5f2ed;      /* Slightly warmer for hover/expanded states */
--text: #1a1a1a;         /* Near-black for primary text */
--text-secondary: #666;  /* Body text, descriptions */
--text-muted: #6d6560;   /* Labels, metadata (WCAG AA compliant) */
--border: #e8e4de;       /* Subtle warm grey borders */
--accent: #a84e35;       /* Terracotta - CTAs, links, map markers (WCAG AA) */
--accent-light: #faf0eb; /* Selection highlight */
```

### Rating Colors
- `--great: #2d7a4f` - Forest green for 8-10 ratings
- `--good: #4d7a33` - Olive green for 6-7 ratings (WCAG AA)
- `--poor: #a64d4d` - Muted red for 1-5 ratings

## Typography

**Headings:** Playfair Display (serif) - elegant, editorial feel
- Large headlines use light weight (400), tight letter-spacing (-0.02em)
- Line height 1.1 for impact

**Body:** Inter (sans-serif) - clean, readable
- 16px base, 1.6 line height
- Font weight 400 for body, 500 for emphasis

**Data/Numbers:** JetBrains Mono (monospace)
- Use `.mono` class for ratings, distances, coordinates
- Slightly smaller (0.875em)

**Labels:** Uppercase with letter-spacing
- 11-12px, uppercase, 0.05-0.1em letter-spacing
- Color: `--text-muted`

## UI Components

### Buttons
- Minimal: transparent background, 1px border
- Uppercase text, wide letter-spacing
- Accent variant for primary actions (terracotta fill)
- No border-radius (sharp corners)

### Tags (Chamfered Style)
- Octagonal shape with chamfered corners on all sides (clip-path polygon)
- Icon on the right, text on the left (flex-direction: row-reverse)
- Clear/transparent when unselected, terracotta fill when selected
- Three sizes: `.tag` (full), `.tag-mini` (table cells), `.tag-small` (expanded rows)
- Used for: review attributes (High Protein, Quick, Good Value, etc.), category selection

### Inputs
- Borderless except bottom border
- No background
- Focus state: border darkens to `--text`
- No border-radius

### Tables
- No visible row borders except bottom hairline
- Hover state: warm background (`--bg-warm`)
- Expandable rows for details
- Headers: tiny uppercase labels

### Cards/Modals
- White background, single border
- No border-radius
- Generous padding (40px)
- Subtle overlay (rgba black 0.3)

### Map
- CartoDB light tiles (clean, minimal)
- Custom markers: small circles with terracotta fill
- Office marker: black/dark, slightly larger
- Leaflet controls stripped of default styling

## Interaction Patterns

### Filtering
- Inline filter bar, not sidebar
- Dropdown selects with minimal styling
- Clear button appears when filters active
- All visualizations respond to same filter state (Zustand store)

### Expandable Rows
- Click row to expand, click again to collapse
- Expanded state shows reviews and inline add/edit form
- Warm background for expanded content

### Map Integration
- Click marker to see details in popup
- "View on map" button in table scrolls to map and highlights
- Markers are read-only. Coordinates come solely from the Google Places result
  chosen in Add Place — there is no drag-to-move and no click-to-place, so there
  is deliberately no server route for updating a restaurant's location.
- Office location is read-only in the UI (`organisations.office_location`)

### Forms
- Inline where possible (reviews in expanded row)
- Modal for complex forms (adding new place)
- Place lookup via the Google Places autocomplete API, which supplies the
  coordinates directly

## Layout

- Max width: 1200px container
- Horizontal padding: 24px
- Section spacing: 80px vertical padding
- Fixed nav with transparent background

### Page Structure (Authenticated — Dashboard)
1. Fixed nav (sign in/out)
2. Hero section (headline + tagline)
3. Inline stats row
4. Map section with heading
5. Rating histogram
6. Filter bar
7. Restaurant table
8. Footer

### Page Structure (Unauthenticated — Landing Page)
1. Fixed nav (sign in link only)
2. Split hero: headline + social proof + sign-up CTA | top 3 rated restaurant cards
3. Map section (same container/styling as Dashboard, popups show name + rating with blurred details + sign-up button)
4. Bento stats grid: 4 stat cards + rating histogram + popular tags
5. 2 visible latest review groups
6. 3 blurred review groups behind gradient blur gate with sign-up CTA
7. Footer

### Auth Gate (`HomePage.tsx`)
- `src/pages/index.astro` renders `<HomePage>` (not Dashboard directly)
- HomePage checks the session client-side via Better Auth's `useSession()`
- Authenticated → `<Dashboard />`
- Unauthenticated → `<LandingPage />`
- No guest browsing — auth is required for the full dashboard

## Data Conventions

### Ratings
- Scale: 1-10 (never again → perfect)
- Labels: Avoid, Poor, Bad, Meh, Ok, Decent, Good, Great, Excellent, Perfect
- Display: "7.5 — Good" format

### Distance
- Calculated from office location (stored in settings table)
- Haversine formula for accuracy
- Displayed as walking minutes (assume 5 km/h)
- Format: "X min"

### Coordinates
- Office default: 51.5047, -0.0886 (Runway East, London Bridge)
- Display with 6 decimal places when shown

## Review Visibility Logic

Visibility is derived from organisation membership. No explicit visibility table - simpler and automatic.

### Core Rules

```
IF not signed in:
  - Ratings: VISIBLE (always public)
  - Reviewer name: HIDDEN
  - Comment: HIDDEN

IF signed in:
  IF viewing org page (/org/[slug]):
    - Get all members of current org
    - FOR each review:
      - IF reviewer is member of current org:
        - Rating: VISIBLE
        - Reviewer name: VISIBLE
        - Comment: VISIBLE
      - ELSE:
        - Rating: VISIBLE
        - Reviewer name: HIDDEN
        - Comment: HIDDEN

  IF viewing global page (/):
    - Get all orgs viewer is member of
    - Get all members of those orgs (union)
    - FOR each review:
      - IF reviewer is in that union (shares any org with viewer):
        - Rating: VISIBLE
        - Reviewer name: VISIBLE
        - Comment: VISIBLE
      - ELSE:
        - Rating: VISIBLE
        - Reviewer name: HIDDEN
        - Comment: HIDDEN
```

### Map Popup Visibility

Same rules apply to map popups:
- Ratings always shown
- Comments only shown if signed in AND reviewer is in visible member set

### When User Joins Org

Reviews automatically become visible - no migration needed:
- User joins StackOne
- User's existing reviews now visible to all StackOne members
- No explicit "share to org" action required

### Stats Display

- "X places" - total restaurant count
- "X reviews" - total review count (not reviewed places)
- "X avg rating" - average of all restaurant average ratings
- "X top rated" - count of restaurants with avgRating >= 8

### Distance Display

- Only shown when viewing org page (has office location)
- Global view: no distance column, no distance in map popup
- Format: "X min" (walking time at 5 km/h)

## Database Notes

### Tables
- `restaurants` - name, type, notes, latitude, longitude
- `reviews` - rating (1-10), comment, links to restaurant + user
- `tags` - predefined descriptive tags (name, icon)
- `review_tags` - junction table linking reviews to tags
- `settings` - key/value store (office_location as JSONB)
- `profiles` - user profiles with display_name, is_private flag, synced from auth.users
- `organisations` - multi-tenant orgs with name, slug, office_location, tagline
- `organisation_members` - user membership with role (admin/member)
- `organisation_invites` - pending invites with email, token, expiry
- `organisation_requests` - pending join requests from users
- `user_follows` - follower/following relationships between users
- `follow_requests` - pending follow requests for private accounts

### Access Control (no RLS)

Row Level Security is gone — the app no longer talks to Postgres from the browser. All reads and
writes go through typed functions in `packages/shared/src/lib/api.ts`, which call the API routes in
`packages/web/src/pages/api/data/*.ts`. Those routes use the `withApi` helper
(`packages/web/src/lib/api-helpers.ts`), which supplies `{ pool, user, params, body }` and resolves
`user` from the Better Auth session. Access control is therefore enforced in the route handlers:

- Restaurants and reviews are readable by anyone (field-level visibility is applied in the app layer)
- Review comment/reviewer visibility is derived from org membership (see Visibility Logic above)
- Mutating routes require a session; users can only modify their own reviews
- Org-scoped routes check membership, and admin actions (members, invites, requests) check the admin role

Every server route must include `export const prerender = false` after the imports — the site is
built with static output.

### Media

Avatars and review photos live in the private R2 bucket `tastefull-media`, bound as `MEDIA` in
`packages/web/wrangler.jsonc`. There is no public bucket or custom domain — the Worker serves objects
at `/api/media/<key>`, e.g. `/api/media/review-photos/<userId>/<reviewId>.jpg` and
`/api/media/avatars/<userId>/avatar.<ext>`.

### Recreating the Database Schema

SQL migrations live in `migrations/` and are applied by hand with `psql`, in filename
order. There is no migration runner — that directory is the record of what has been run.
See `migrations/README.md` for what each one does and why.

```bash
psql "$DATABASE_URL" -f migrations/001_schema.sql
psql "$DATABASE_URL" -f migrations/002_better_auth.sql
```

Use the **unpooled** Neon connection string for DDL; the pooled `-pooler` host is for
the app. Applying a migration does not touch the Neon `dev` branch — run it there too.

`migrations/one-off/` holds the Node scripts that moved data off Supabase. They are
archival: they read from a now-dormant Supabase project and are not expected to run
again.

Credentials for these scripts live outside the repo, in
`/Users/will/Documents/personal/tastefull/.env`.

The `supabase/` directory is retained as a historical record of the pre-migration schema and the
`notify-new-review` edge function. Nothing reads it and it is not applied to anything — the hosted
Supabase project is left running, unattended, as a fallback. Do not add migrations there.

### Local Development

There is no local database or emulator — development runs against the Neon branch directly.

```bash
# .env / .env.local at the repo root needs the Neon connection string
# DATABASE_URL=postgresql://...neon.tech/...?sslmode=require
# plus the Better Auth secret / base URL

pnpm install
pnpm dev
```

Credentials for the migration scripts live in `/Users/will/Documents/personal/tastefull/.env`.

## Development

```bash
npm run dev      # Start Astro dev server at localhost:4321
npm run build    # Build for production
npm run preview  # Preview production build
```

Auto-deploys to Cloudflare Workers via GitHub Actions on push to master.

## Key Files

- `src/styles/global.css` - All design tokens and component styles
- `src/components/Dashboard.tsx` - Main page component
- `src/components/MapView.tsx` - Leaflet map (read-only markers)
- `src/components/AddReview.tsx` - New place form with geocoding
- `src/lib/distance.ts` - Haversine distance calculation
- `src/lib/store.ts` - Zustand filter state
- `packages/shared/src/lib/api.ts` - Typed data-access functions (all DB access goes through here)
- `packages/shared/src/lib/auth-client.ts` - Better Auth client (`signIn`, `useSession`, `getUser`, …)
- `packages/web/src/lib/auth.ts` - Better Auth server config
- `packages/web/src/lib/api-helpers.ts` - `withApi` helper providing `{ pool, user, params, body }`
