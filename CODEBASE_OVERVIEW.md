# Elsebrew - Complete Architecture Overview

## Project Overview
**Elsebrew** is a Next.js 14 web application that helps users find coffee shops in destination cities that match the vibe of their favorite local café. It's built as an MVP validation tool with integrated AI-powered matching, Google Maps integration, and social features.

## 1. Project Structure & Key Files

```
/Users/idogil/elsebrew/
├── 📄 Configuration & Setup
│   ├── package.json                  # Next.js 14, React 18, TypeScript
│   ├── tsconfig.json                 # TypeScript config
│   ├── next.config.js                # Output: standalone, Image domains configured
│   ├── tailwind.config.ts            # Custom colors (espresso, charcoal, offwhite)
│   ├── postcss.config.mjs            # Tailwind + Autoprefixer
│   ├── .env.example                  # Environment template
│   ├── .env.local                    # Actual secrets (git-ignored)
│   └── check-env.js                  # Environment variable validation script
│
├── 📱 Pages & Routes (App Router)
│   ├── app/
│   │   ├── page.tsx                  # Home page (hero, search, email signup)
│   │   ├── results/page.tsx          # Search results (list + map)
│   │   ├── saved/page.tsx            # Saved cafés list
│   │   ├── about/page.tsx            # About page
│   │   ├── privacy/page.tsx          # Privacy policy
│   │   ├── terms/page.tsx            # Terms of service
│   │   ├── layout.tsx                # Root layout (Header, Footer)
│   │   ├── globals.css               # Global styles + custom classes
│   │   └── api/
│   │       ├── reason/route.ts       # Single café match explanation (LLM)
│   │       ├── reason-batch/route.ts # Batch café explanations (LLM)
│   │       ├── reddit/route.ts       # Reddit café mentions search
│   │       └── analyze-image/route.ts # GPT-4 Vision image analysis
│
├── 🧩 Components
│   ├── components/
│   │   ├── home/
│   │   │   ├── SearchPanel.tsx       # Main search form (source + destination + vibes)
│   │   │   ├── EmailSignup.tsx       # Mailchimp email signup
│   │   │   ├── PricingStrip.tsx      # "Pro coming soon" fake door
│   │   │   └── TypingTitle.tsx       # Animated hero title
│   │   ├── results/
│   │   │   ├── ResultsList.tsx       # Scrollable list of café matches
│   │   │   ├── ResultsMap.tsx        # Google Maps with numbered markers
│   │   │   ├── DetailsDrawer.tsx     # Side panel with embedded Place card
│   │   │   └── SearchRefinement.tsx  # Additional filtering (not visible)
│   │   ├── auth/
│   │   │   └── GoogleSignIn.tsx      # Google Identity Services button
│   │   └── shared/
│   │       ├── Header.tsx            # Navigation + user profile + sign in
│   │       ├── Footer.tsx            # Links + Buy Me A Coffee
│   │       └── AnalyticsProvider.tsx # GA4/Plausible script injection
│
├── 📚 Libraries & Utilities
│   ├── lib/
│   │   ├── places-search.ts          # Google Places Text Search logic
│   │   ├── scoring.ts                # Café matching algorithm
│   │   ├── maps-loader.ts            # Google Maps API loader (singleton)
│   │   ├── storage.ts                # localStorage helpers (user profile, saved cafés)
│   │   └── analytics.ts              # GA4/Plausible event tracking
│
├── 📊 Types
│   └── types/
│       └── index.ts                  # TypeScript interfaces
│
└── 📖 Documentation
    ├── README.md                     # Complete technical guide
    ├── QUICKSTART.md                 # 10-minute setup
    ├── SETUP_GUIDE.md                # API key configuration
    ├── ARCHITECTURE.md               # Technical architecture
    ├── PROJECT_SUMMARY.md            # This overview
    └── CHECKLIST.md                  # Implementation checklist
```

## 2. Core Technology Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI Library:** React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS 3 + custom components
- **Animations:** Framer Motion
- **Forms:** Native HTML + Google Places Autocomplete

### Backend/APIs
- **Runtime:** Node.js (Next.js API routes)
- **External APIs:**
  - Google Maps Platform (Places, Geocoding, Text Search, Embed)
  - Google OAuth (Identity Services)
  - OpenAI (GPT-4o-mini for LLM reasoning)
  - Reddit JSON API (public, no auth)

### Data & Storage
- **Client:** localStorage (user profile, saved cafés)
- **Server:** In-memory caching (API responses, max 100-200 entries)
- **No Database:** MVP uses client-side only

### Deployment
- **Next.js Config:** Standalone output mode
- **Image Domains:** maps.googleapis.com, lh3.googleusercontent.com
- **AWS Amplify:** Auto-detects Next.js (amplify.yml included)

## 3. Data Flow: Search to Results

### User Journey
```
1. User lands on home page (/)
   └─> Hero title + "How it works" section
   └─> SearchPanel component loads

2. User fills SearchPanel
   ├─> Source café: Google Places Autocomplete
   │   └─ Fetches place_id, rating, price_level, photos, editorial_summary
   ├─> Destination city: Google Places Autocomplete
   │   └─ Geocodes to get lat/lng + viewport bounds
   └─> Vibe toggles: 6 checkboxes (roastery, light roast, etc.)

3. User clicks "Find my twins"
   └─> Navigates to /results with query params:
       • sourcePlaceId
       • sourceName
       • destCity
       • vibes (JSON stringified)

4. Results page loads (results/page.tsx)
   ├─> Suspense boundary while loading
   └─> ResultsContent component:
       ├─ Extracts search params
       ├─ Calls searchCafes() in places-search.ts
       │  ├─ buildSearchKeywords() based on vibes
       │  ├─ Google Places Text Search
       │  ├─ Filters top 6 by rating
       │  ├─ Gets full Place Details for each
       │  ├─ scoreCafe() algorithm (rating, price, keywords)
       │  └─ Returns top 2 matches sorted by score
       │
       ├─ For each match in parallel:
       │  ├─ Fetch Reddit mentions (3s timeout)
       │  │  └─ POST /api/reddit
       │  ├─ Analyze photo (3s timeout)
       │  │  └─ POST /api/analyze-image
       │  └─ Store results on match object
       │
       ├─ Generate AI explanations:
       │  └─ POST /api/reason-batch (all cafés together)
       │     ├─ System prompt: personality-rich matching descriptions
       │     ├─ User prompt: source + candidates + Reddit/image data
       │     └─ Returns array of 1-3 sentence explanations
       │
       ├─ Display results:
       │  ├─ Left side: ResultsList component
       │  │  └─ Scrollable cards with photos, rating, reasoning
       │  ├─ Right side: ResultsMap component
       │  │  └─ Google Map with numbered markers
       │  ├─ Synced selection: hover/click on list highlights map & vice versa
       │  └─ DetailsDrawer: click card → side panel with embedded Place card
       │
       └─ Analytics:
           └─ resultsLoaded event (candidate count, latency)
```

## 4. Authentication Flow

### Google Sign-In (OAuth)
**Component:** `components/auth/GoogleSignIn.tsx`

```
1. GoogleSignIn component mounts
   ├─ Loads Google Identity Services script: accounts.google.com/gsi/client
   ├─ Waits for script to load (onLoad callback)
   └─ Once loaded, initializes with CLIENT_ID (NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID)

2. User clicks "Sign in with Google" button
   ├─ Google shows consent screen
   └─ User grants permission

3. Credential token received
   ├─ JWT decoded client-side (no server verification needed)
   ├─ Extract: sub, name, email, picture
   ├─ Store in localStorage: elsebrew_user_profile
   ├─ Dispatch custom event: elsebrew_auth_change
   └─ onSignIn callback called

4. Header component listens to auth changes
   ├─ Shows user profile picture + name
   ├─ Provides "Sign out" button
   └─ Updates localStorage on sign out
```

**Key Points:**
- No server-side session management
- Token is NOT validated on server (MVP)
- Stored as stringified JSON in localStorage
- Persists across page refreshes

## 5. Café Search Algorithm

### File: `lib/places-search.ts`

**Input:**
- sourcePlace: PlaceBasicInfo (user's favorite café)
- destinationCenter: LatLng (destination city center)
- destinationBounds: LatLngBounds (city bounds)
- vibes: VibeToggles (6 boolean flags)

**Process:**

1. **Keyword Generation** (`buildSearchKeywords()`)
   ```
   Base: ["cafe", "coffee", "specialty coffee"]
   + Roastery: ["roastery", "roaster", "single origin"]
   + Light Roast: ["light roast", "filter coffee", "hand drip", "pour over", "third wave"]
   + Laptop-Friendly: ["co-working", "wifi", "workspace"]
   + Night Owl: ["late night", "open late"]
   + Cozy: ["cozy", "intimate", "warm"]
   + Minimalist: ["minimalist", "modern", "clean"]
   
   Query: First 5 keywords joined → sent to Google Places
   ```

2. **Google Places Text Search**
   ```
   Request: {
     query: keywords string,
     location: destinationCenter,
     radius: min(bounds_diagonal/2, 50km)
   }
   
   Returns: Up to 20 results sorted by relevance
   ```

3. **Filtering & Ranking**
   ```
   Filter:
   - Must have place_id
   - Must have rating > 0
   
   Sort: By rating (descending)
   
   Take: Top 6 candidates
   ```

4. **Place Details Fetch** (parallel)
   ```
   For each of 6 candidates, call Google Places API with fields:
   - place_id, name, rating, user_ratings_total, price_level
   - formatted_address, geometry, opening_hours
   - photos[], types[], editorial_summary
   ```

5. **Scoring Algorithm** (`scoreCafe()`)
   ```
   Score = 0
   
   Components:
   ├─ Rating:           (rating / 5) * 10           (0-10 points)
   ├─ Review Count:     log10(user_ratings_total)   (0-3 points)
   ├─ Price Match:      ±1 from source              (2 points if match)
   ├─ Roastery:         contains "roast" or "roaster" (2 points)
   ├─ Specialty:        contains "specialty", "third wave", "artisan", "craft" (1 point)
   ├─ Night Owl:        has opening_hours data      (1 point)
   ├─ Photo Count:      has photos                  (0.5 points)
   └─ Laptop:           type includes "cafe" or "coffee_shop" (1 point)
   
   Example: 4.5★ (9 pts) + 2.0 reviews (3 pts) + price match (2 pts) + roastery (2 pts) = 16 pts
   ```

6. **Final Ranking**
   ```
   Sort by score (descending)
   Return: Top 2 matches
   ```

**Output:**
```typescript
CafeMatch[] = [
  {
    place: PlaceBasicInfo,
    score: number,
    matchedKeywords: string[],
    distanceToCenter: number km,
    redditData: undefined (added later),
    imageAnalysis: undefined (added later),
    reasoning: undefined (added later)
  }
]
```

## 6. API Routes

### POST /api/reason-batch (Main LLM reasoning)

**Purpose:** Generate unique, personality-rich 1-3 sentence match explanations

**Request:**
```json
{
  "source": {
    "name": "Blue Bottle Coffee",
    "rating": 4.6,
    "price_level": 3
  },
  "candidates": [
    {
      "name": "Café Mano",
      "rating": 4.5,
      "user_ratings_total": 523,
      "price_level": 3,
      "editorial_summary": "High-end specialty coffee...",
      "keywords": ["Specialty coffee", "Similar price"],
      "redditData": { "totalMentions": 5, "posts": [...], "averageScore": 15 },
      "imageAnalysis": "minimalist, bright, industrial"
    }
  ],
  "city": "Tokyo",
  "vibes": { "roastery": false, "lightRoast": true, ... }
}
```

**Process:**
1. Generate cache key from source + all candidate names
2. Check 5-minute in-memory cache
3. If miss: Call OpenAI API
   - Model: gpt-4o-mini
   - Temperature: 0.9 (for variety)
   - Max tokens: 800
   - Response format: JSON
4. Parse response (handles multiple JSON formats)
5. Return array of descriptions (one per candidate)
6. Cache result for 5 minutes
7. Cleanup old cache entries when size > 100

**System Prompt:** Emphasizes:
- UNIQUE descriptions for each café
- Different opening phrases per café
- Vary emphasis (Reddit buzz, visual style, ratings, etc.)
- 2-3 sentences max
- Examples: "Cool cafe in hip neighborhood", "Known among locals", etc.

**Output:**
```json
{
  "reasonings": [
    "Minimalist third-wave spot with strong Reddit presence. Known for precision pour-overs and single-origin beans.",
    "Bright, Instagram-worthy café favored by digital nomads. Excellent WiFi and longer seating capacity."
  ]
}
```

### POST /api/reddit (Community mentions)

**Purpose:** Find Reddit discussion about the café

**Request:**
```json
{
  "cafeName": "Café Mano",
  "city": "Tokyo"
}
```

**Process:**
1. Check 30-minute cache
2. Build 2 search queries:
   - `"Café Mano Tokyo coffee"`
   - `"Café Mano cafe Tokyo"`
3. For each query: Fetch from reddit.com/search.json
   - Returns up to 10 posts per query
4. Also search 4 coffee subreddits:
   - r/Coffee
   - r/cafe
   - r/espresso
   - r/specialty_coffee
5. Aggregate all posts
6. Sort by: 0.7 * score + 0.3 * recency
7. Return top 10 most relevant
8. Cache for 30 minutes

**Output:**
```json
{
  "posts": [
    {
      "title": "Amazing coffee at Café Mano",
      "body": "Been going here for 3 years...",
      "score": 15,
      "author": "coffee_fan",
      "created_utc": 1234567890,
      "permalink": "https://reddit.com/r/Coffee/...",
      "subreddit": "Coffee"
    }
  ],
  "totalMentions": 5,
  "averageScore": 12
}
```

### POST /api/analyze-image (Vision-based aesthetic analysis)

**Purpose:** Analyze café photo to describe visual style

**Request:**
```json
{
  "imageUrl": "https://maps.googleapis.com/maps/api/..."
}
```

**Process:**
1. Check 1-hour cache
2. Call OpenAI GPT-4o-mini with vision
3. Prompt: "Describe this café's style in 2-3 words: minimalist, cozy, industrial, etc."
4. Get up to 50 tokens response
5. Cache for 1 hour

**Output:**
```json
{
  "analysis": "minimalist, bright, industrial"
}
```

### POST /api/reason (Single café explanation - deprecated)

Similar to reason-batch but for single café. Now replaced by reason-batch for efficiency.

## 7. State Management

**Architecture:** Client-side only, no global state library

### localStorage Keys
```typescript
STORAGE_KEYS = {
  USER_PROFILE: 'elsebrew_user_profile',     // UserProfile object
  SAVED_CAFES: 'elsebrew_saved_cafes'        // SavedCafe[]
}
```

### Storage Helpers (`lib/storage.ts`)
```typescript
storage.getUserProfile()       // UserProfile | null
storage.setUserProfile(user)   // void
storage.getSavedCafes()        // SavedCafe[]
storage.saveCafe(cafe)         // void (deduped)
storage.removeSavedCafe(id)    // void
storage.isCafeSaved(id)        // boolean
```

### Component State
- **Header:** user (from localStorage on mount)
- **SearchPanel:** sourcePlace, destPlace, vibes
- **ResultsContent:** results[], loading, error, selectedResult, hoveredIndex, mapCenter
- **Maps:** markers, infoWindows

### Data Flow
```
User Sign In
└─> GoogleSignIn.tsx
    └─> Decode JWT
        └─> storage.setUserProfile(user)
            └─> Dispatch 'elsebrew_auth_change' event
                └─> Header.tsx listens
                    └─> Update user state
```

## 8. Environment Variables

**Required:**
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<key>        # Places, Geocoding, Text Search
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=<id>      # Google Sign-In
OPENAI_API_KEY=sk-<key>                      # LLM API (server-side only!)
```

**Optional:**
```
NEXT_PUBLIC_GA4_MEASUREMENT_ID=<id>          # Analytics
NEXT_PUBLIC_BUYMEACOFFEE_URL=<url>           # Support link
MAILCHIMP_FORM_ACTION=<url>                  # Email signup (not implemented server-side)
```

**Important:**
- `NEXT_PUBLIC_*` = exposed to browser (public)
- `OPENAI_API_KEY` = server-side only (secure)
- Validation script: `npm run check-env`

## 9. Analytics Events

**Tracking:** GA4 or Plausible (toggleable)

**Events:**
1. `view_home` - User lands on home page
2. `search_submit` - User submits search
   - params: source_city, dest_city, toggles
3. `results_loaded` - Results page fully loaded
   - params: candidate_count, latency_ms
4. `result_click` - User clicks a result
   - params: rank, place_id
5. `result_save_google` - User saves to Google Maps
   - params: place_id
6. `result_open_gmaps` - User opens in Google Maps app
   - params: place_id
7. `click_sign_in` - User signs in with Google
8. `email_subscribe_submit` - User enters email
9. `buy_me_coffee_click` - User clicks support button
10. `cta_upgrade_click` - User clicks "Pro coming soon"

**Funnel Metrics:**
```
view_home → search_submit → results_loaded → result_click
                                         ↓
                                result_save_google
                                    or
                                result_open_gmaps
```

## 10. Component Architecture

### Key Components

#### SearchPanel (`components/home/SearchPanel.tsx`)
- **State:** sourcePlace, destPlace, vibes toggles
- **Effects:** Initializes Google Places Autocomplete on mount
- **Handlers:** toggleVibe, handleSearch
- **Navigation:** Pushes to /results with query params

#### ResultsContent (`app/results/page.tsx`)
- **State:** results[], loading, error, selectedResult, mapCenter
- **Effects:** Performs search on mount + fetches Reddit/image data in parallel
- **Renders:** ResultsList + ResultsMap in grid layout
- **Syncs:** List/map selection via callbacks

#### ResultsList (`components/results/ResultsList.tsx`)
- **Props:** results, selectedIndex, hoveredIndex
- **Renders:** Scrollable list of result cards with:
  - Photo (if available)
  - Rating + price + distance
  - AI reasoning
  - Reddit mentions badge (clickable link)
  - Image analysis badge
  - Matched keywords

#### ResultsMap (`components/results/ResultsMap.tsx`)
- **Props:** results, center, selectedIndex, hoveredIndex
- **Renders:** Google Map with:
  - Numbered markers (1, 2, 3...)
  - Marker clustering (if many results)
  - Highlight selected/hovered markers
  - Center on destination

#### DetailsDrawer (`components/results/DetailsDrawer.tsx`)
- **Props:** selectedResult, onClose
- **Renders:**
  - Slide-in panel (right side)
  - Result header + photo
  - Rating, address, hours
  - **Google Place Card:** Native embed (shows Save button)
  - Contact buttons (call, website, directions)

#### Header (`components/shared/Header.tsx`)
- **State:** user (from localStorage), isClient (hydration guard)
- **Effects:** Load user profile on mount, listen for auth changes
- **Renders:**
  - Logo + navigation
  - GoogleSignIn button (if not signed in)
  - User profile + Sign out button (if signed in)
  - Link to /saved

### Component Tree
```
RootLayout
├─ Header
├─ Main
│  ├─ Home page (/)
│  │  ├─ TypingTitle
│  │  ├─ PricingStrip
│  │  ├─ SearchPanel
│  │  │  └─ GoogleSignIn
│  │  └─ EmailSignup
│  ├─ Results page (/results)
│  │  ├─ ResultsContent (Suspense)
│  │  ├─ ResultsList
│  │  ├─ ResultsMap
│  │  └─ DetailsDrawer
│  └─ Other pages
└─ Footer
```

## 11. Design System

### Color Palette (Tailwind)
```typescript
espresso: {
  DEFAULT: '#5B4636',  // Primary brown
  dark: '#3D2E24',     // Darker variant
  light: '#8B6F5E'     // Lighter variant
}
offwhite: '#FAFAF8'    // Background
charcoal: '#2D2D2D'    // Text
```

### Custom Classes (globals.css)
```css
.btn-primary        /* Brown button with hover/active states */
.btn-secondary      /* White button with brown border */
.card               /* Rounded white box with shadow */
.input-field        /* Text input with focus ring */
```

### Fonts
- **Serif:** Georgia (headings)
- **Mono:** System mono (code)
- **Default:** System sans-serif (body)

### Spacing
- Generous whitespace
- Card padding: 1rem (p-4) to 2rem (p-8)
- Grid gaps: 2rem
- Button padding: 0.75rem vertical, 1.5rem horizontal

### Animations (Framer Motion)
- Page entrance: opacity 0→1, y -20→0
- Card list: staggered entrance (50ms delay)
- Hover states: scale, shadow, ring
- Drawer: slide from right with opacity
- Dropdown: fade + translate

## 12. Performance & Optimization

### API Caching
- **reason-batch:** 5 minutes in-memory
- **reddit:** 30 minutes in-memory
- **analyze-image:** 1 hour in-memory

### Google Maps Optimizations
- **Lazy loading:** Maps loader singleton (lib/maps-loader.ts)
- **Parallel requests:** Reddit + image analysis in Promise.all()
- **Timeouts:** 3s timeout per parallel request (Promise.race)

### Search Limits
- Text Search: Returns up to 20 results, filter to 6, get details for 6, score to 2
- Result display: Top 2 cafés only (reduced from 8 for speed)

### Image Handling
- Max width: 400px for list, 800px for detail
- Google's image optimization included
- Fallback gray background if loading fails

## 13. Security & Compliance

### API Security
- Google API keys restricted to:
  - Domain: *.amplify.app / *.elsebrew.com (in production)
  - APIs: Maps, Places, Geocoding, Embed
- OpenAI key: Server-side only (never exposed to client)
- Reddit API: Public, no auth needed

### Data Privacy
- **No server database:** All user data in browser localStorage
- **No sync:** Saved cafés local to device
- **No tracking:** User ID/email not sent to analytics
- **Transparent:** Privacy policy + Terms provided

### Google Maps Compliance
- ✓ Attribution shown on map
- ✓ Place cards embedded (no content storage)
- ✓ No persistent caching of place data
- ✓ User intent-based (user searches, not admin)

## 14. Deployment

### AWS Amplify
- **Config:** amplify.yml (auto-detects Next.js)
- **Build:** `npm run build`
- **Output:** Standalone Next.js server
- **Environment:** Set env vars in Amplify console
- **URL:** Assigned by Amplify (e.g., *.amplify.app)

### Docker-ready
- `next.config.js` has `output: 'standalone'`
- Can run with: `node .next/standalone/server.js`

### Performance
- **First Contentful Paint:** ~1-2s
- **Search latency:** ~3-8s (includes API calls)
- **Results load:** ~5-10s (with Reddit + image analysis)

## 15. Data Types

```typescript
// User authentication
UserProfile {
  sub: string              // Google user ID
  name: string
  email: string
  picture?: string         // Google profile picture URL
}

// Search input
VibeToggles {
  roastery: boolean
  lightRoast: boolean
  laptopFriendly: boolean
  nightOwl: boolean
  cozy: boolean
  minimalist: boolean
}

// Google Places data
PlaceBasicInfo {
  place_id: string
  name: string
  rating?: number          // 1-5
  user_ratings_total?: number
  price_level?: number     // 1-4
  formatted_address?: string
  geometry?: { location: LatLng, viewport: LatLngBounds }
  opening_hours?: PlaceOpeningHours
  photos?: PlacePhoto[]    // Has getUrl() method
  types?: string[]         // e.g., "cafe", "restaurant"
  editorial_summary?: string
}

// Search result
CafeMatch {
  place: PlaceBasicInfo
  score: number            // 0-20+ (algorithm output)
  reasoning?: string       // 1-3 sentences (LLM)
  matchedKeywords: string[]
  distanceToCenter?: number // km
  redditData?: {
    posts: RedditPost[]
    totalMentions: number
    averageScore: number
  }
  imageAnalysis?: string   // "minimalist, bright"
}

// Saved cafe (localStorage)
SavedCafe {
  placeId: string
  name: string
  savedAt: number          // timestamp
  photoUrl?: string
  rating?: number
}

// Analytics event
AnalyticsEvent {
  name: string
  params?: Record<string, any>
}
```

## Summary: Key Takeaways

1. **MVP Focus:** Lightweight, no backend database
2. **AI-Powered:** LLM reasoning + Reddit community insights + image analysis
3. **Maps-First:** Interactive map + list synchronized
4. **Premium Design:** Minimal aesthetic, custom color palette
5. **Analytics-Driven:** 10+ events to validate product-market fit
6. **Fast Iteration:** Client-side changes only (no build required for data)
7. **Secure:** API keys protected, user data local only
8. **Scalable:** Ready for Supabase/Firebase backend addition

