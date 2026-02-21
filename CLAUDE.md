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
- HomePage checks Supabase session client-side
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

### RLS Policies
- Anyone can read restaurants and reviews (all fields - visibility enforced in app layer)
- Review comment/reviewer visibility derived from org membership (see Visibility Logic above)
- Authenticated users can insert restaurants
- Users can only modify their own reviews
- Org members can view other members of their orgs
- Org admins can manage members, invites, and requests
- Settings readable by all, writable by authenticated

### Recreating the Database Schema

To set up the database from scratch, run these SQL commands in Supabase SQL Editor:

```sql
-- 1. Base schema (profiles trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Organisations
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  office_location JSONB DEFAULT NULL,
  tagline TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);

CREATE TABLE organisation_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  UNIQUE(organisation_id, email)
);

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_invites ENABLE ROW LEVEL SECURITY;

-- Organisation policies
CREATE POLICY "Anyone can view organisations" ON organisations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create organisations" ON organisations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update their organisations" ON organisations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisations.id AND user_id = auth.uid() AND role = 'admin'));

-- Helper function to avoid RLS recursion
CREATE OR REPLACE FUNCTION user_org_ids(user_uuid UUID) RETURNS SETOF UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT organisation_id FROM organisation_members WHERE user_id = user_uuid
$$;

-- Member policies
CREATE POLICY "Members can view organisation members" ON organisation_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organisation_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY "Admins can add members" ON organisation_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisation_members.organisation_id AND user_id = auth.uid() AND role = 'admin')
    OR NOT EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisation_members.organisation_id));
CREATE POLICY "Admins can remove members" ON organisation_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organisation_members om WHERE om.organisation_id = organisation_members.organisation_id AND om.user_id = auth.uid() AND om.role = 'admin') OR user_id = auth.uid());
CREATE POLICY "Admins can update member roles" ON organisation_members FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organisation_members om WHERE om.organisation_id = organisation_members.organisation_id AND om.user_id = auth.uid() AND om.role = 'admin'));

-- Invite policies
CREATE POLICY "Members can view their organisation's invites" ON organisation_invites FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisation_invites.organisation_id AND user_id = auth.uid())
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY "Admins can create invites" ON organisation_invites FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisation_invites.organisation_id AND user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete invites" ON organisation_invites FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisation_invites.organisation_id AND user_id = auth.uid() AND role = 'admin')
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 3. Organisation requests (users requesting to join)
CREATE TABLE organisation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);

ALTER TABLE organisation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own requests" ON organisation_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can view org requests" ON organisation_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisation_requests.organisation_id AND user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can request to join" ON organisation_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisation_requests.organisation_id AND user_id = auth.uid()));
CREATE POLICY "Users can cancel own requests" ON organisation_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can delete requests" ON organisation_requests FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organisation_members WHERE organisation_id = organisation_requests.organisation_id AND user_id = auth.uid() AND role = 'admin'));

-- NOTE: review_visibility table is DEPRECATED
-- Visibility is now derived from org membership (see Review Visibility Logic section above)

-- Indexes
CREATE INDEX idx_organisation_members_org ON organisation_members(organisation_id);
CREATE INDEX idx_organisation_members_user ON organisation_members(user_id);
CREATE INDEX idx_organisation_invites_org ON organisation_invites(organisation_id);
CREATE INDEX idx_organisation_invites_token ON organisation_invites(token);
CREATE INDEX idx_organisation_requests_org ON organisation_requests(organisation_id);
CREATE INDEX idx_organisation_requests_user ON organisation_requests(user_id);

-- 4. User follows and follow requests
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE TABLE follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, target_id)
);

-- Add is_private to profiles
ALTER TABLE profiles ADD COLUMN is_private BOOLEAN DEFAULT false;

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

-- User follows policies
CREATE POLICY "Anyone can view follows" ON user_follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON user_follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Users can unfollow" ON user_follows FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

-- Follow requests policies
CREATE POLICY "Users can view own requests" ON follow_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid());
CREATE POLICY "Users can create requests" ON follow_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Users can delete own requests" ON follow_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid());

CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);
CREATE INDEX idx_follow_requests_requester ON follow_requests(requester_id);
CREATE INDEX idx_follow_requests_target ON follow_requests(target_id);

-- 5. Tags (descriptive attributes for reviews)
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE review_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(review_id, tag_id)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags" ON tags FOR SELECT USING (true);
CREATE POLICY "Anyone can view review_tags" ON review_tags FOR SELECT USING (true);
CREATE POLICY "Users can add tags to their reviews" ON review_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM reviews WHERE id = review_tags.review_id AND user_id = auth.uid()));
CREATE POLICY "Users can remove tags from their reviews" ON review_tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM reviews WHERE id = review_tags.review_id AND user_id = auth.uid()));

CREATE INDEX idx_review_tags_review ON review_tags(review_id);
CREATE INDEX idx_review_tags_tag ON review_tags(tag_id);

-- Seed default tags
INSERT INTO tags (name, icon) VALUES
  ('High Protein', '💪'),
  ('Healthy', '🥗'),
  ('Good Value', '💰'),
  ('Quick', '⚡'),
  ('Large Portion', '🍽️'),
  ('Vegan Options', '🌱'),
  ('Quiet', '🤫'),
  ('Outdoor Seating', '☀️')
ON CONFLICT (name) DO NOTHING;
```

### Local Development with Supabase

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase (requires Docker)
supabase init
supabase start

# Create .env.local with local credentials (shown after supabase start)
# PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# PUBLIC_SUPABASE_ANON_KEY=<anon_key>

# Reset local DB (applies migrations + seed)
supabase db reset

# Stop local Supabase
supabase stop
```

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
