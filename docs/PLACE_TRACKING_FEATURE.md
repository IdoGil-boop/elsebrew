# Place Tracking & Caching Features

## Overview
Two major features have been implemented to improve user experience and search result quality:

1. **Place Interaction Tracking**: Track which places users have seen and filter them out from future searches (unless saved) - **Works for both logged-in and anonymous users via IP tracking!**
2. **Enhanced Results Caching**: Persist search results across browser navigation for instant page loads

## Feature 1: Place Interaction Tracking

### What It Does
- Records every place a user views in search results (**for all users!**)
- **Anonymous users**: Tracked by hashed IP address
- **Logged-in users**: Tracked by user ID
- **Automatic migration**: When anonymous user logs in, their IP-based data merges with their account
- Tracks the search context (destination, vibes, origin places, free text)
- Filters out previously seen but unsaved places when search parameters change
- Allows users to get fresh results by changing their search criteria
- Automatically marks places as saved/unsaved when user saves/removes them (logged-in only)

### How It Works

#### Database Schema
New DynamoDB table: `elsebrew-place-interactions`
```typescript
interface PlaceInteraction {
  userId: string;           // Partition key - Can be user ID OR hashed IP for anonymous users
  placeId: string;          // Sort key
  placeName: string;
  firstSeenAt: string;      // ISO timestamp
  lastSeenAt: string;       // ISO timestamp
  viewCount: number;        // How many times user saw this place
  searchContext: {
    destination: string;
    vibes: string[];
    freeText?: string;
    originPlaceIds: string[];
  };
  isSaved: boolean;
  savedAt?: string;
  isAnonymous?: boolean;    // Flag to identify IP-based records
}
```

#### User Flow

**Anonymous User:**
1. User visits site (no login)
2. Their IP is hashed (SHA-256 + salt for privacy)
3. Performs search → results tracked under hashed IP
4. Changes search → previously seen but unsaved places filtered out
5. **Later logs in** → All IP-based data automatically migrates to their user account!

**Logged-In User:**
1. User performs a search with specific criteria (e.g., "Paris", "cozy" vibe)
2. Results are shown and automatically recorded as "viewed" under their user ID
3. User doesn't save some places
4. User changes search (e.g., adds "roastery" vibe or changes to "London")
5. Previously seen but unsaved places are filtered out
6. If user goes back to original search, those places won't show again (new results)
7. Saved places always appear regardless of search changes

#### API Endpoints

**Record Place View**
```
POST /api/user/place-interactions
{
  "action": "view",
  "placeId": "ChIJ...",
  "placeName": "Café Example",
  "searchContext": {
    "destination": "Paris",
    "vibes": ["cozy", "roastery"],
    "originPlaceIds": ["ChIJ..."]
  }
}
```

**Get Places to Filter**
```
GET /api/user/place-interactions/filter?destination=Paris&vibes=["cozy"]&originPlaceIds=["ChIJ..."]
Response: { "placeIdsToPenalize": ["ChIJ...", "ChIJ..."] }
```

**Mark as Saved/Unsaved** (automatic via saved-places endpoint)
```
POST /api/user/place-interactions
{ "action": "save", "placeId": "ChIJ..." }

POST /api/user/place-interactions
{ "action": "unsave", "placeId": "ChIJ..." }
```

### Files Modified/Created
- `lib/dynamodb.ts`: Added place interaction functions + migration
- `lib/ip-utils.ts`: **NEW** - IP extraction and hashing utilities
- `scripts/create-dynamodb-tables.ts`: Added table creation
- `app/api/user/place-interactions/route.ts`: **NEW** - Works for logged-in AND anonymous users
- `app/api/user/migrate-anonymous-data/route.ts`: **NEW** - Migration endpoint
- `app/api/user/saved-places/route.ts`: Updated to mark places as saved/unsaved
- `lib/places-search.ts`: Added filtering logic
- `app/results/page.tsx`: Added view recording and filter fetching (works for all users)
- `components/auth/GoogleSignIn.tsx`: Trigger migration on login

## Feature 2: Enhanced Results Caching

### What It Does
- Caches complete search results in browser sessionStorage
- Restores results instantly when navigating back/forward in browser
- No API calls needed for cached results
- Includes map center, reasoning, image analysis, and all metadata
- Automatically clears when search parameters change

### How It Works

#### Storage Format
```typescript
{
  searchParams: string;  // Full query string for matching
  results: CafeMatch[];  // Simplified, serializable results
  mapCenter: { lat: number; lng: number }
}
```

#### User Flow
1. User searches and gets results
2. Results are cached to sessionStorage with search params
3. User clicks on a place, goes to saved page, etc.
4. User clicks browser back button
5. Results page checks if searchParams match cached data
6. If match: instant restore from cache (no API calls!)
7. If different params: perform new search and clear old cache

#### Cache Management
- **Persist**: Cache stays in sessionStorage for entire browser session
- **Invalidate**: Automatically cleared when search params change
- **Refresh**: Cache is updated every time a new search completes
- **Photo URLs**: Extracted and cached to avoid Google Maps API dependencies

### Files Modified
- `lib/storage.ts`: Results state caching (already existed, enhanced)
- `app/results/page.tsx`: Cache restoration logic improved

## Benefits

### For Users
1. **No Duplicate Results**: Won't see the same places unless they saved them (**works for everyone!**)
2. **Fresh Discoveries**: Each search variation shows new places
3. **Instant Navigation**: Back/forward in browser is instant
4. **Better Experience**: Fewer API calls = faster page loads
5. **No Login Required**: Get filtered results even without signing up
6. **Seamless Transition**: Browse anonymously, login later - all data is preserved

### For the App
1. **Cost Savings**: Fewer Google Maps API calls
2. **Data Insights**: Track which places users view but don't save (even anonymous!)
3. **Better Recommendations**: Can analyze search patterns and preferences
4. **Scalability**: Caching reduces backend load
5. **Privacy-Preserving**: IP hashing protects user privacy
6. **Better Conversion**: Show value to anonymous users before requiring signup

## Future Enhancements

### Short Term
1. Add analytics dashboard showing:
   - Most viewed but unsaved places
   - Popular search combinations
   - User preferences over time

2. Improve filtering algorithm:
   - Consider view count (maybe show again after many searches)
   - Time-based filtering (show again after X days)
   - Location-based (filter only for same city)

### Long Term
1. Use interaction data to improve scoring algorithm
2. Recommend places based on viewing patterns
3. A/B test different filtering strategies
4. Export analytics for business insights

## Testing

### Manual Testing Steps

1. **Test Anonymous Place Filtering**
   - DON'T login to the app (test as anonymous user)
   - Search for cafes in a destination
   - Note the results (don't save any)
   - Change vibes or destination
   - Search again
   - Verify you don't see the same unsaved places
   - Check DynamoDB - should have records with `isAnonymous: true` and hashed IP as userId

2. **Test Data Migration on Login**
   - Start as anonymous user (no login)
   - Perform 2-3 searches, viewing multiple places
   - Check console: should see "Filtering out seen places: X"
   - Now login with Google
   - Check console: should see "Migrated X anonymous interactions to user account"
   - Perform another search
   - Verify previously seen places are still filtered out

3. **Test Caching**
   - Perform a search
   - Click on a result
   - Click browser back button
   - Verify results load instantly without API call

4. **Test Saved Places (logged in only)**
   - Login to the app
   - Search for cafes
   - Save one result
   - Change search parameters
   - Verify saved place can appear in new searches

### Database Verification
```bash
# Check if table was created
npm run setup-db

# Should show:
# ✓ Created table elsebrew-place-interactions
```

## Deployment Notes

1. **Database Setup**: Run `npm run setup-db` to create the new table
2. **Backward Compatible**: All existing user data is preserved - same table schema!
3. **No Breaking Changes**: Existing functionality unchanged
4. **Gradual Rollout**: Place tracking is automatic but gracefully fails if DB unavailable
5. **Anonymous Support**: New feature - IP-based tracking works alongside logged-in user tracking
6. **Optional Salt**: Set `IP_HASH_SALT` env variable for additional IP hashing security (optional)

## Configuration

No additional environment variables needed. Uses existing AWS credentials:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

## Monitoring

Watch for:
- DynamoDB read/write capacity for `place-interactions` table
- API latency for filter endpoint
- Cache hit rate in browser
- User complaints about "missing" places (if filtering too aggressive)
