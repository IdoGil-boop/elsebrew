# Vibe-Based Search & Cross-Search Filtering

## Overview

This document explains how vibes influence search results and how the system prevents showing the same cafes across different searches in the same destination.

## Problem Solved

**Before:**
- Vibes only affected scoring/ranking, not what Google returned
- Changing vibes generated different searchIds but returned the same cafes
- Users saw the same cafes repeatedly even when changing search parameters

**After:**
- Vibes influence the Google search query, returning different cafes
- Previously seen cafes are penalized across ALL searches in the same destination
- Different vibe combinations lead to genuinely different results from Google

## How Vibes Affect Google Search

### Vibe → Keyword Mapping

Vibes are now translated into keywords that are included in the Google Places API text query:

```typescript
roastery → "roastery", "roaster"
lightRoast → "light roast", "specialty coffee"
laptopFriendly → "workspace", "wifi", "laptop friendly"
nightOwl → "late night", "open late"
cozy → "cozy", "intimate"
minimalist → "minimalist", "modern", "clean design"
```

### Query Construction

The final query sent to Google includes:
1. Base keywords from origin cafe (e.g., "cafe", "coffee")
2. Origin cafe types (e.g., "coffee_shop", "roastery")
3. **Top 2 vibe keywords** (e.g., "roastery roaster")

**Example:**
```
No vibes: "cafe coffee specialty coffee"
With roastery + minimalist: "cafe coffee roastery roaster minimalist modern"
```

This causes Google to return different cafes based on selected vibes.

## Cross-Search Filtering

### The Strategy

Instead of only filtering cafes from the current search, the system now penalizes ALL cafes the user has seen (but not saved) in the same destination, regardless of when or how they were seen.

### Implementation

1. **Tracking**: Every cafe view is recorded in DynamoDB with:
   - userId (or IP hash for anonymous)
   - placeId
   - destination
   - isSaved flag

2. **Filtering**: When searching, the system queries ALL seen-but-unsaved places for that destination:
   ```typescript
   // Returns ALL unsaved cafes seen in Tokyo, regardless of vibes/origin/freeText
   getSeenButUnsavedPlaces(userId, { destination: "Tokyo" })
   ```

3. **Scoring Penalty**: Previously seen cafes get their score reduced by 50%:
   ```typescript
   adjustedScore = wasPreviouslySeen ? score * 0.5 : score
   ```

### Why Penalize Instead of Filter Completely?

- **Fallback**: If there aren't enough fresh cafes, seen ones can still appear (but ranked lower)
- **Flexibility**: User might reconsider a cafe they previously skipped
- **UX**: Prevents empty results in small cities where options are limited

## User Flow Examples

### Example 1: Different Vibes = Different Cafes

```
Search 1: Tokyo, no vibes
→ Google query: "cafe coffee specialty coffee"
→ Returns: Generic coffee shops

Search 2: Tokyo, roastery + minimalist vibes
→ Google query: "cafe coffee roastery roaster minimalist modern"
→ Returns: Different set focused on roasteries with modern design
```

### Example 2: Cross-Search Filtering

```
Day 1: Search Tokyo, see cafes A, B, C, D, E → Don't save any

Day 2: Search Tokyo again (different vibes, different origin)
→ System fetches: A, B, C, D, E, F, G, H, I, J (from Google)
→ Penalizes A-E (seen before): scores cut in half
→ Shows: F, G, H, I, J (fresh cafes ranked higher)
```

### Example 3: Saving Cafes

```
Search 1: See cafes A, B, C, D, E → Save B and D

Search 2: Same destination
→ System returns: A, C, E, F, G, H, I, J
→ Penalizes: A, C, E (seen but not saved)
→ Does NOT penalize: B, D (were saved)
→ Shows: F, G, H, I, J first, then A, C, E if needed
```

## Technical Details

### Files Modified

1. **[lib/places-search.ts](lib/places-search.ts#L11-L74)**
   - Added `vibeToPlaceTypes()`: Maps vibes to Google place types
   - Added `buildVibeEnhancedQuery()`: Builds query with vibe keywords
   - Modified search to use vibe-enhanced queries
   - Added scoring penalty for previously seen places

2. **[lib/dynamodb.ts](lib/dynamodb.ts#L349-L367)**
   - Updated `getSeenButUnsavedPlaces()` to filter by destination only
   - Removed filtering by vibes/freeText/origin (cross-search filtering)

3. **[app/api/user/place-interactions/filter/route.ts](app/api/user/place-interactions/filter/route.ts)**
   - New dedicated route for fetching places to filter
   - Works for both authenticated and anonymous users

### Query Logging

You can see the vibe-enhanced queries in the browser console:
```
[Places Search] 🔍 Calling searchByText API with: {
  textQuery: "cafe coffee roastery roaster minimalist modern",
  ...
}
```

And penalties being applied:
```
[Places Search] Penalizing previously seen place: Cafe Grumpy (score: 18.45 → 9.23)
```

## Benefits

1. **Diverse Results**: Different vibes lead to different cafes from Google
2. **No Repetition**: Users don't see the same cafes across searches in a city
3. **Smart Ranking**: Fresh cafes appear first, but seen ones remain as fallback
4. **Works Everywhere**: Applies to all destinations automatically
5. **Persistent**: Works across sessions (data stored in DynamoDB)
6. **Anonymous Support**: Even non-logged-in users benefit (IP-based tracking)

## Configuration

### Penalty Factor

Currently set to 50% reduction (line 478 in places-search.ts):
```typescript
const adjustedScore = wasPreviouslySeen ? score * 0.5 : score;
```

To make it more aggressive (hide seen cafes more): increase penalty
```typescript
const adjustedScore = wasPreviouslySeen ? score * 0.2 : score; // 80% reduction
```

To make it less aggressive: decrease penalty
```typescript
const adjustedScore = wasPreviouslySeen ? score * 0.7 : score; // 30% reduction
```

### Vibe Keywords

To add more keywords for a vibe, edit `buildVibeEnhancedQuery()` in places-search.ts:
```typescript
if (vibes.roastery) {
  vibeKeywords.push('roastery', 'roaster', 'artisan coffee'); // Add more
}
```

## Monitoring

Check console logs for:
- `[Places Search] 🔍 Calling searchByText API with:` - See the actual query sent to Google
- `[Places Search] Penalizing previously seen place:` - Which cafes were penalized
- `[Filter API] Returning X seen places for Y` - How many cafes being filtered per destination

## Future Enhancements

- **Time decay**: Cafes seen long ago could have reduced penalty
- **View count threshold**: Only penalize after seeing a cafe 3+ times
- **Location-specific penalty**: Cafes far from current search center get less penalty
- **Explicit "never show again"**: User can permanently hide specific cafes
