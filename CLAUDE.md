# CLAUDE.md - Project Guidelines

## Overview

A food review website for the team at Runway East, London Bridge. Honest, opinionated reviews of lunch spots in the neighbourhood.

**Tech Stack:** Astro + React islands, Supabase (PostgreSQL + Auth), Cloudflare Workers, Leaflet maps

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
--text-muted: #999;      /* Labels, metadata */
--border: #e8e4de;       /* Subtle warm grey borders */
--accent: #c45d3e;       /* Terracotta - CTAs, links, map markers */
--accent-light: #e8d5ce; /* Selection highlight */
```

### Rating Colors
- `--great: #2d7a4f` - Forest green for 8-10 ratings
- `--good: #b8860b` - Golden amber for 6-7 ratings
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
- Draggable markers for editing locations (with save confirmation)
- Office location is editable (stored in settings table)

### Forms
- Inline where possible (reviews in expanded row)
- Modal for complex forms (adding new place with geocoding)
- Address lookup via OpenStreetMap Nominatim API
- Click-to-place fallback on map

## Layout

- Max width: 1200px container
- Horizontal padding: 24px
- Section spacing: 80px vertical padding
- Fixed nav with transparent background

### Page Structure
1. Fixed nav (sign in/out)
2. Hero section (headline + tagline)
3. Inline stats row
4. Map section with heading
5. Rating histogram
6. Filter bar
7. Restaurant table
8. Footer

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

## Database Notes

### Tables
- `restaurants` - name, type, notes, latitude, longitude
- `reviews` - rating (1-10), comment, links to restaurant + user
- `settings` - key/value store (office_location as JSONB)

### RLS Policies
- Anyone can read restaurants and reviews
- Authenticated users can insert restaurants
- Users can only modify their own reviews
- Settings readable by all, writable by authenticated

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
- `src/components/MapView.tsx` - Leaflet map with editable markers
- `src/components/AddReview.tsx` - New place form with geocoding
- `src/lib/distance.ts` - Haversine distance calculation
- `src/lib/store.ts` - Zustand filter state
- `src/lib/supabase.ts` - Supabase client
