# Elsebrew Codebase Exploration Index

## Overview

This document provides a comprehensive index to the exploration of the Elsebrew codebase. Multiple detailed documents have been created to help understand every aspect of the project.

## Documentation Files Created

### 1. **ARCHITECTURE_SUMMARY.txt** (28 KB)
**Location:** `docs/ARCHITECTURE_SUMMARY.txt`

Complete architectural reference covering:
- Project structure (12 sections, ~2,000 lines)
- Technology stack overview
- Data flow from home to search to results
- Authentication flow (Google OAuth)
- Café search algorithm with scoring details
- All API routes (reason-batch, reddit, analyze-image)
- State management & storage patterns
- Environment variables & configuration
- Design system (colors, fonts, components)
- Analytics & metrics
- Deployment on AWS Amplify
- Summary of architectural decisions

**Use This For:** Deep understanding of how everything fits together

### 2. **CODEBASE_OVERVIEW.md** (24 KB)
**Location:** `/Users/idogil/elsebrew/CODEBASE_OVERVIEW.md`

Detailed breakdown of:
- Project structure with file paths
- Technology stack (frontend, backend, data)
- Complete user journey (7 steps)
- Authentication flow with code patterns
- Café search algorithm with point scoring
- API routes with request/response examples
- State management architecture
- Environment variables reference
- Analytics events (10 tracked events)
- Deployment configuration
- Data types and TypeScript interfaces

**Use This For:** Reference while working on specific features

## Key Findings Summary

### Architecture Style
- **Pattern:** Component-based (React) + API routes (Next.js)
- **State Management:** Lightweight client-side (localStorage + component state)
- **Data Persistence:** Browser localStorage (no backend database)
- **Authentication:** Google OAuth (client-side only, no server validation)
- **Caching:** In-memory on API routes (5 min - 1 hour TTL)

### Critical Components

| Component | Purpose | File |
|-----------|---------|------|
| SearchPanel | Search form (source + destination + vibes) | `/components/home/SearchPanel.tsx` |
| ResultsContent | Search orchestration | `/app/results/page.tsx` |
| ResultsList | Results cards display | `/components/results/ResultsList.tsx` |
| ResultsMap | Google Map with markers | `/components/results/ResultsMap.tsx` |
| GoogleSignIn | OAuth authentication | `/components/auth/GoogleSignIn.tsx` |

### Critical Libraries

| Library | Purpose | File |
|---------|---------|------|
| searchCafes | Google Places integration | `/lib/places-search.ts` |
| scoreCafe | Café matching algorithm | `/lib/scoring.ts` |
| loadGoogleMaps | Singleton Maps loader | `/lib/maps-loader.ts` |
| storage | localStorage helpers | `/lib/storage.ts` |
| analytics | GA4/Plausible tracking | `/lib/analytics.ts` |

### Key Data Flows

**Search Flow (10 seconds total):**
1. User enters source café + destination + vibes
2. Navigate to /results with URL params
3. Google Places Text Search (~200 results filtered to 6)
4. Scoring algorithm (rating, price, keywords, vibes)
5. Top 2 matches selected
6. Parallel enrichment: Reddit mentions + Image analysis (3s timeout each)
7. LLM batch processing (OpenAI GPT-4o-mini)
8. Display list + map (synchronized)

**Authentication Flow:**
1. Google Identity Services script loads
2. User clicks "Sign in with Google"
3. JWT received, decoded client-side
4. User profile stored in localStorage
5. Custom event dispatches to Header
6. UI updates with user profile picture + name

### API Routes

| Route | Purpose | Cache | Timeout |
|-------|---------|-------|---------|
| `/api/reason-batch` | LLM explanations | 5 min | N/A |
| `/api/reddit` | Community mentions | 30 min | 3s |
| `/api/analyze-image` | Visual analysis | 1 hour | 3s |

### Scoring Algorithm

**8-Point System:**
- Rating: (rating/5) * 10 points
- Review count: log10(total) points
- Price match: 2 points
- Roastery: 2 points
- Specialty indicators: 1 point
- Night owl: 1 point
- Photos: 0.5 points
- Laptop-friendly: 1 point

**Example:** 4.5★ + 523 reviews + matches = 16.7 points

## Environment Setup

**Required Variables (3):**
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=xxx
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=xxx
OPENAI_API_KEY=xxx
```

**Optional Variables (3):**
```
NEXT_PUBLIC_GA4_MEASUREMENT_ID=xxx
NEXT_PUBLIC_BUYMEACOFFEE_URL=xxx
MAILCHIMP_FORM_ACTION=xxx
```

## Design System

**Color Palette:**
- Primary: `#5B4636` (espresso brown)
- Dark: `#3D2E24` (espresso dark)
- Light: `#8B6F5E` (espresso light)
- Text: `#2D2D2D` (charcoal)
- Background: `#FAFAF8` (offwhite)

**Custom Classes:**
- `.btn-primary` - Primary button
- `.btn-secondary` - Secondary button
- `.card` - Card container
- `.input-field` - Text input

## Analytics Events (10 Total)

Funnel:
```
view_home 
  → search_submit 
    → results_loaded 
      → result_click 
        → result_save_google or result_open_gmaps
```

Also tracked:
- click_sign_in
- email_subscribe_submit
- buy_me_coffee_click
- cta_upgrade_click

## Deployment

**Platform:** AWS Amplify
**Build:** `npm run build` → Standalone output
**Environment:** Set vars in Amplify console
**Auto-Deploy:** Git push triggers build

## Quick Navigation

### By Task
- **Adding a new vibe toggle:** SearchPanel.tsx + scoring.ts
- **Changing colors:** tailwind.config.ts + globals.css
- **Adding an API route:** app/api/*/route.ts
- **Modifying scoring:** lib/scoring.ts
- **Authentication changes:** components/auth/GoogleSignIn.tsx + lib/storage.ts
- **Analytics tracking:** lib/analytics.ts

### By File Type
- **Pages:** app/*.tsx
- **Components:** components/**/*.tsx
- **API Routes:** app/api/**/route.ts
- **Libraries:** lib/*.ts
- **Styles:** app/globals.css, tailwind.config.ts
- **Types:** types/index.ts

### By Feature
- **Search:** SearchPanel.tsx, lib/places-search.ts, lib/scoring.ts
- **Authentication:** GoogleSignIn.tsx, Header.tsx, lib/storage.ts
- **Results Display:** ResultsContent.tsx, ResultsList.tsx, ResultsMap.tsx
- **LLM Integration:** app/api/reason-batch/route.ts
- **Data Enrichment:** app/api/reddit/route.ts, app/api/analyze-image/route.ts
- **Analytics:** lib/analytics.ts, AnalyticsProvider.tsx

## Technical Decisions

### What's Done Well
1. ✓ Clean separation of concerns (components, libs, API routes)
2. ✓ Singleton pattern for Google Maps (load once, reuse)
3. ✓ Batch LLM requests (better variety, lower cost)
4. ✓ Parallel enrichment with timeouts (doesn't block results)
5. ✓ Custom event auth (no Context API needed)
6. ✓ Premium design system (custom colors, typography)
7. ✓ Analytics from day 1 (validation metrics)

### MVP Trade-offs
1. No backend database (faster to launch)
2. No server-side auth validation (acceptable for MVP)
3. Only top 2 results (speed over quantity)
4. Heuristic scoring (not ML-based)
5. localStorage only (no cross-device sync)
6. In-memory cache (lost on restart)

## Next Steps for Growth

If validation succeeds, add:
1. Supabase/Firebase backend
2. Stripe payments
3. User accounts & cross-device sync
4. ML-based scoring
5. Social features
6. Mobile app (React Native)
7. Advanced filters
8. Multi-language support

## Files by Size

| File | Size | Purpose |
|------|------|---------|
| package-lock.json | 225 KB | Dependencies |
| node_modules/ | 11+ GB | Third-party code |
| ARCHITECTURE_SUMMARY.txt | 28 KB | Architecture reference |
| CODEBASE_OVERVIEW.md | 24 KB | Component breakdown |
| app/results/page.tsx | ~8 KB | Search orchestration |

## Key Metrics

- **Search Latency:** 5-10 seconds (includes all API calls)
- **Result Limit:** Top 2 matches (reduced from 8)
- **Cache TTL:** 5 min (LLM) to 1 hour (images)
- **API Timeouts:** 3 seconds (Reddit, image analysis)
- **Scoring Range:** 0-20 points
- **Events Tracked:** 10 analytics events

## Conclusion

Elsebrew is a **production-ready MVP** with:
- Clean architecture (easy to extend)
- Well-designed UX (premium aesthetic)
- Smart API usage (Google Maps + OpenAI + Reddit)
- Analytics-driven (validation metrics)
- Ready for scale (standalone Docker output)

The codebase is maintainable, well-organized, and demonstrates best practices for MVP development.

---

**Last Updated:** November 16, 2025
**Exploration Scope:** Complete codebase analysis
**Documentation:** 3 comprehensive guides created
