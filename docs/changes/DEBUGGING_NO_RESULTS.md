# Debugging "No Matches Found"

## Enhanced Logging Added

The code now includes comprehensive logging to help debug why searches return 0 results.

## How to Debug

### 1. Run a Search

1. Start the dev server: `npm run dev`
2. Open browser console (F12 → Console tab)
3. Perform a search
4. Look for `[Places Search]` log messages

### 2. Check the Log Messages

The logs will show each step of the search process:

#### Step 1: Search Initiation
```
[Places Search] Starting search
```
Shows:
- Source place name
- Destination coordinates
- Keywords generated
- Query string sent to Google
- Vibe toggles

**What to check:**
- Are the keywords reasonable? (e.g., "cafe coffee specialty coffee")
- Is the destination center correct?

#### Step 2: Search Parameters
```
[Places Search] Search parameters
```
Shows:
- Search radius in meters and kilometers
- Bounds of the destination city

**What to check:**
- Is the radius reasonable? (should be 5-50km typically)
- Are the bounds correct for your destination city?

#### Step 3: API Response
```
[Places Search] Google Places API response
```
Shows:
- Status code (OK, ZERO_RESULTS, etc.)
- Number of results returned

**What to check:**
- Status should be "OK"
- Result count should be > 0
- If status is not OK, see "Common Status Codes" below

#### Step 4: Filtering
```
[Places Search] After filtering
```
Shows:
- How many results before filtering
- How many after filtering (must have place_id + rating + within bounds)
- Sample of first 3 results

**What to check:**
- Are results being filtered out?
- Do results have place_id and ratings?
- Common issue: All results filtered out because they're outside bounds

#### Step 5: Top Candidates
```
[Places Search] Top candidates
```
Shows the top 6 candidates selected for detailed fetching.

#### Step 6: Detailed Fetch
```
[Places Search] Detailed candidates
```
Shows:
- How many successful detail fetches
- How many failed (returned null)

**What to check:**
- If nullCount > 0, check for `getPlaceDetails failed` warnings
- Common issue: Rate limiting or API quota

#### Step 7: Bounds Double-Check
```
[Places Search] After bounds double-check
```
Shows how many candidates remain after confirming they're within city bounds.

**What to check:**
- Are candidates being excluded here?
- This is the most common reason for 0 results

#### Step 8: Final Results
```
[Places Search] Final results
```
Shows the final scored and ranked results (top 2).

## Common Issues & Solutions

### Issue 1: Zero Results from Google API

**Log Message:**
```
[Places Search] Google Places API response { status: ..., resultCount: 0 }
```

**Possible Causes:**
1. **Too specific keywords** - Try broadening the search
2. **Wrong location** - Check destination coordinates
3. **No cafes in area** - Search radius might be too small

**Solutions:**
- Try a major city (e.g., "Tokyo", "New York", "London")
- Simplify vibe toggles (try with all off)
- Check if the destination geocoded correctly

### Issue 2: All Results Filtered Out (No place_id or rating)

**Log Message:**
```
[Places Search] After filtering { beforeFilter: 20, afterFilter: 0 }
```

**Cause:** Google returned places without ratings or place IDs.

**Solution:** This is rare but can happen. Check `sampleResults` in the log to see what's missing.

### Issue 3: All Results Outside Bounds

**Log Message:**
```
[Places Search] After bounds double-check { beforeBoundsCheck: 6, afterBoundsCheck: 0 }
```

**Cause:** Google's text search returned places outside the destination city bounds.

**Why this happens:**
- Google sometimes returns results from nearby cities
- Search radius might extend beyond city boundaries
- Destination bounds might be too restrictive

**Solutions:**

**Option A: Relax the bounds check** (Quick fix)

Edit [lib/places-search.ts](lib/places-search.ts:121-132):

```typescript
// BEFORE (strict):
const validCandidates = detailedCandidates.filter((place): place is PlaceBasicInfo => {
  if (!place) return false;

  if (place.geometry?.location) {
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    return destinationBounds.contains(new google.maps.LatLng(lat, lng));
  }

  return false;
});

// AFTER (lenient - use distance instead):
const validCandidates = detailedCandidates.filter((place): place is PlaceBasicInfo => {
  if (!place) return false;

  // Allow places within 50km of center, even if outside strict bounds
  if (place.geometry?.location) {
    const distance = calculateDistance(destinationCenter, place.geometry.location);
    return distance <= 50; // 50km radius
  }

  return false;
});
```

**Option B: Remove the double-check** (Even more lenient)

The initial filter at line 69-81 already checks bounds. The second check at line 121-132 might be too strict. You could remove it entirely if you trust the first filter + distance-based scoring.

### Issue 4: API Quota or Rate Limiting

**Log Messages:**
```
[Places Search] getPlaceDetails failed
  status: OVER_QUERY_LIMIT
```

**Cause:** Google API quota exceeded.

**Solutions:**
1. Enable billing in Google Cloud Console
2. Check quota usage in Google Cloud Console → APIs → Dashboard
3. Wait for quota to reset (resets daily)

### Issue 5: API Key Restrictions

**Log Messages:**
```
[Places Search] Search failed
  status: REQUEST_DENIED
```

**Cause:** API key doesn't allow requests from localhost.

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your API key
3. Under "Application restrictions" → "HTTP referrers"
4. Add: `http://localhost:3000/*`

## Testing Different Scenarios

### Test 1: Simple Search
- **Source:** Any coffee shop (use autocomplete)
- **Destination:** "Tokyo, Japan"
- **Vibes:** All OFF
- **Expected:** Should find 2 results

### Test 2: With Vibes
- **Source:** Blue Bottle Coffee
- **Destination:** "San Francisco, CA"
- **Vibes:** Roastery, Light Roast ON
- **Expected:** Should find specialty coffee shops

### Test 3: Smaller City
- **Source:** Local cafe
- **Destination:** "Portland, Maine"
- **Vibes:** Cozy ON
- **Expected:** Might return 0-2 results (smaller city)

## Understanding the Search Flow

```
User enters search
    ↓
Geocode destination city → Get center + bounds
    ↓
Build keywords from vibes
    ↓
Google Places textSearch (query + location + radius)
    ↓
Filter: has place_id + rating + within bounds
    ↓
Take top 6 by rating
    ↓
Fetch detailed info (getDetails) for each
    ↓
Filter again: within bounds + has geometry
    ↓
Score each based on vibes/keywords
    ↓
Return top 2
```

**Where results get lost:**
1. ❌ After textSearch (0 results from Google)
2. ❌ After first filter (no place_id/rating/outside bounds)
3. ❌ After getDetails (all failed to fetch)
4. ❌ After bounds double-check (strict bounds filtering) ← **Most common**
5. ❌ After scoring (all scored too low - unlikely)

## Quick Fixes to Try

### 1. Most Likely: Bounds Too Strict

Comment out the bounds double-check:

```typescript
// lib/places-search.ts line ~121
const validCandidates = detailedCandidates.filter((place): place is PlaceBasicInfo => {
  if (!place) return false;
  return !!place.geometry?.location; // Just check if it has location

  // COMMENTED OUT - bounds check might be too strict
  // if (place.geometry?.location) {
  //   const lat = place.geometry.location.lat();
  //   const lng = place.geometry.location.lng();
  //   return destinationBounds.contains(new google.maps.LatLng(lat, lng));
  // }
  // return false;
});
```

### 2. Increase Candidate Count

```typescript
// lib/places-search.ts line ~96
.slice(0, 20); // Instead of 6 - fetch more candidates
```

### 3. Simplify Keywords

The keywords might be too specific. Try removing some:

```typescript
// lib/scoring.ts - buildSearchKeywords function
// Reduce base keywords to just:
const baseKeywords = ['cafe', 'coffee'];
```

## Still Stuck?

Share these logs in your issue:
1. The full `[Places Search]` console output
2. The search parameters you used (source, destination, vibes)
3. Your Google Cloud Console → APIs → Dashboard quota usage

The detailed logs will pinpoint exactly where results are being lost.
