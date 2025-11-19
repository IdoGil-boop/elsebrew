# Elsebrew Architecture

## Overview

Elsebrew is a Next.js 14 app using the App Router, with client-side Google Maps integration and server-side LLM reasoning.

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript
- **Styling:** Tailwind CSS, Framer Motion
- **Maps:** Google Maps JavaScript API + Places Library
- **Auth:** Google Identity Services (client-side only)
- **LLM:** OpenAI GPT-4o-mini
- **Analytics:** Google Analytics 4 (optional)
- **Storage:** localStorage (no backend database)

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                          USER                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      HOME PAGE (/)                          │
│  • Google Places Autocomplete (source café)                 │
│  • Google Places Autocomplete (destination city)            │
│  • Vibe toggles                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │ Submit search
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   RESULTS PAGE (/results)                   │
│                                                             │
│  1. Fetch source place details (Google Places API)         │
│  2. Geocode destination city                               │
│  3. Text Search for cafés in destination bounds            │
│  4. Get Place Details for top 12 candidates                │
│  5. Score & rank using custom algorithm                    │
│  6. Call /api/reason for LLM explanations                  │
│  7. Display results: List + Map                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              DETAILS DRAWER (modal)                         │
│  • Embedded Google Maps Place card                          │
│  • "Save" → localStorage                                    │
│  • "Open in Google Maps" → deep link                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ Save clicked
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  SAVED PAGE (/saved)                        │
│  • Read from localStorage                                   │
│  • Display saved cafés                                      │
└─────────────────────────────────────────────────────────────┘
```

## API Routes

### `/api/reason` (POST)

**Purpose:** Generate LLM explanation for why a candidate café matches the source.

**Input:**
```json
{
  "source": {
    "name": "Blue Bottle Coffee",
    "price_level": 2,
    "rating": 4.5
  },
  "candidate": {
    "name": "Onibus Coffee",
    "price_level": 2,
    "rating": 4.6,
    "editorial_summary": "Specialty coffee roastery..."
  },
  "keywords": ["Roastery", "Specialty coffee"]
}
```

**Output:**
```json
{
  "reasoning": "Both are specialty roasters with a focus on light-roast, single-origin beans and a minimalist aesthetic."
}
```

**Caching:** 5-minute in-memory cache to reduce costs.

## Scoring Algorithm

Located in `lib/scoring.ts`:

```typescript
score = base_rating_score +            // 0-10 based on rating
        log10(review_count) +          // Popularity bonus
        price_level_match_bonus +      // +2 if within ±1
        keyword_match_bonuses +        // +1-2 per matched keyword
        photo_bonus +                  // +0.5 if has photos
        vibe_specific_bonuses          // Based on toggles
```

**Top 8** highest-scoring cafés are returned.

## Component Hierarchy

```
app/
├── layout.tsx (Root)
│   ├── Header
│   │   └── GoogleSignIn
│   ├── {children} (page content)
│   └── Footer
│
├── page.tsx (Home)
│   ├── SearchPanel
│   │   └── Google Places Autocomplete
│   ├── PricingStrip
│   └── EmailSignup
│
├── results/page.tsx
│   ├── ResultsList
│   │   └── ResultCard (x8)
│   ├── ResultsMap
│   │   └── Google Map + Markers
│   └── DetailsDrawer (modal)
│       └── Embedded Place Card
│
└── saved/page.tsx
    └── SavedCafeCard (xN)
```

## State Management

**No Redux, no Context API.** Simple component state with:

- `useState` for local component state
- `localStorage` for persistence (saved cafés, user profile)
- Custom events for cross-component communication (auth changes)

## Google Maps Integration

### Client-side only (no server)

**Loader:** `@googlemaps/js-api-loader` (1 instance, shared)

**APIs used:**
1. **Autocomplete** - source café & destination city inputs
2. **Places Service** - Text Search + Place Details
3. **Geocoding** - destination city → LatLng + bounds
4. **Maps JavaScript API** - interactive map with markers
5. **Maps Embed API** - embedded Place card in drawer

**Cost control:**
- Use `fields` parameter to request only needed data
- Cache LLM reasoning (avoid re-fetching)
- Debounce autocomplete
- No persistent storage of Places content (ToS compliance)

## Analytics Events

Tracked via `lib/analytics.ts`:

- `view_home` - Home page loaded
- `search_submit` - Search submitted (includes params)
- `results_loaded` - Results displayed (count, latency)
- `result_click` - Result clicked (rank, place_id)
- `result_save_google` - Save button clicked
- `result_open_gmaps` - Open in Maps clicked
- `buy_me_coffee_click` - Support button clicked
- `email_subscribe_submit` - Email signup
- `cta_upgrade_click` - Pro CTA clicked (fake door)

## Security & Compliance

### Google Maps Terms

✅ **Compliant:**
- No server-side storage of Places content (names, reviews, photos)
- `place_id` storage is allowed (for saved cafés)
- Required attributions displayed ("Powered by Google")
- API key restricted to specific domains + APIs

### Data Privacy

- Minimal data collection (analytics only)
- No user accounts (localStorage only)
- Optional Google sign-in (profile stored client-side)
- Privacy policy provided

### API Key Security

- **Never commit** `.env.local` to git
- API key restricted to:
  - Specific domains (HTTP referrers)
  - Specific APIs (4 Maps APIs)
- Rotate keys if exposed

## Performance Optimizations

1. **Static pre-rendering** for home, about, privacy, terms
2. **Dynamic rendering** for results (search params)
3. **Image optimization** via Next.js `<Image>` (not used for Google Photos - direct URLs)
4. **Code splitting** - automatic via App Router
5. **Framer Motion** - tree-shaking friendly animations
6. **Debounced autocomplete** - reduce API calls
7. **LLM caching** - 5-min in-memory cache

## Deployment Checklist

- [ ] Update Google Maps API key restrictions (add production domain)
- [ ] Update OAuth authorized origins (add production domain)
- [ ] Set environment variables in hosting platform
- [ ] Enable GA4 (if using)
- [ ] Test all flows in production
- [ ] Monitor costs (Google Maps + OpenAI)

## Limitations (MVP)

- **No backend database** - everything in localStorage
- **No user accounts** - just client-side Google sign-in
- **No payment processing** - just Buy Me A Coffee link
- **No offline support** - requires internet + APIs
- **Simple scoring** - heuristic-based, not ML
- **English-only** - no i18n
- **No rate limiting** - relies on API quotas

## Future Enhancements (Post-validation)

- Backend database (Supabase, Firebase)
- Real user accounts with sync across devices
- Stripe integration for Pro tier
- Saved trips / itineraries
- Advanced filters (dietary, accessibility)
- ML-based scoring (embeddings, collaborative filtering)
- Mobile app (React Native)
- Offline maps (saved cafés)
- Social features (share trips, reviews)

---

**Questions?** See [README.md](./README.md) for full documentation.
