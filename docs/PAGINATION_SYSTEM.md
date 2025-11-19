# Search Results Pagination System

## Overview

This document explains the pagination system implemented for search results in Elsebrew. The system ensures users get different results when they refine their search or request more options, without seeing the same cafes repeatedly.

## How It Works

### 1. Search State Tracking

Every search is uniquely identified by a **searchId** generated from:
- Origin place IDs (cafes the user loves)
- Destination city
- Selected vibes
- Free text query

This ID remains the same as long as these parameters don't change. When the user modifies any parameter (e.g., adds a new vibe), a new searchId is generated, representing a different search.

### 2. Result Caching

When a search is performed:
- Google Places API returns up to 20 results per page
- All results are scored and sorted
- The **top 5** are displayed to the user
- **All 20** are cached in DynamoDB (in the `SearchHistory` table)
- Metadata is stored:
  - `allResults`: All 20 cafes with their scores
  - `shownPlaceIds`: Array of place IDs already shown to user (initially the top 5)
  - `currentPage`: Which page of Google results we're on (0-indexed)
  - `hasMorePages`: Whether Google has more results available
  - `nextPageToken`: Token for fetching the next page from Google

### 3. Serving Next Results

When the user refines their search (same parameters, just exploring more options):

**Priority 1: Serve from cache**
- Check if `searchId` matches a cached search
- Filter `allResults` to exclude `shownPlaceIds`
- If unseen results exist:
  - Return next 5 unseen results
  - Update `shownPlaceIds` to include these new results
  - User sees results 6-10, then 11-15, then 16-20 from the original fetch

**Priority 2: Fetch next page from Google**
- If all cached results have been shown
- Use `nextPageToken` to fetch results 21-40 from Google
- Cache these new results
- Display top 5 from this new batch
- Update pagination state

### 4. Modified Search Detection

If the user modifies search parameters:
- New `searchId` is generated
- System treats it as a brand new search
- Starts fresh with Google API call
- Old cached results remain for that previous searchId

## Implementation Details

### Key Files

1. **types/index.ts**
   - `SearchState`: Defines search parameters
   - `SearchResultsCache`: Defines pagination state

2. **lib/places-search.ts**
   - `searchCafes()` now returns `SearchCafesResult` with:
     - `results`: Top 5 for display
     - `allScoredResults`: All results from current fetch
     - `hasMorePages`: Boolean
     - `nextPageToken`: String for pagination

3. **lib/search-state-manager.ts**
   - `generateSearchId()`: Creates unique ID from search params
   - `saveCompleteSearchState()`: Stores search results in DB
   - `areSearchStatesEqual()`: Compares two searches

4. **lib/dynamodb.ts**
   - `SearchHistoryItem`: Extended with pagination fields
   - `getSearchState()`: Retrieves cached search
   - `updateSearchState()`: Updates shown place IDs

5. **app/api/search-state/route.ts**
   - GET: Retrieve cached search state
   - POST: Create new search state
   - PATCH: Update pagination state (shown IDs)

6. **app/results/page.tsx**
   - Checks for cached results before calling Google
   - Saves complete search state after receiving results
   - Tracks which results have been shown

## User Flow Examples

### Example 1: Initial Search
```
User: Coffee shops like Blue Bottle in Manhattan
System:
1. Generates searchId: "BlueBottleID_Manhattan_roastery-minimalist_"
2. Calls Google Places API
3. Gets 20 results, scores them
4. Shows top 5 (e.g., Cafe Grumpy, Devoción, etc.)
5. Caches all 20 results
6. Sets shownPlaceIds: [cafe1, cafe2, cafe3, cafe4, cafe5]
```

### Example 2: Refine Search (Same Parameters)
```
User: Clicks "Refine Search" → Keeps same vibes
System:
1. Generates same searchId
2. Checks DynamoDB for cached results
3. Finds 15 unseen results (places 6-20)
4. Shows next 5 (places 6-10)
5. Updates shownPlaceIds: [cafe1-10]
```

### Example 3: Modify Search
```
User: Adds "laptop-friendly" vibe
System:
1. Generates NEW searchId (different vibes)
2. No cache match (new search)
3. Calls Google Places API with updated query
4. Shows fresh top 5 results
5. Caches new set of results
```

### Example 4: Exhaust Cache
```
User: Has seen all 20 cached results
System:
1. No unseen results in cache
2. Uses nextPageToken to fetch results 21-40 from Google
3. Scores new batch
4. Shows top 5 from new batch
5. Caches results 21-40
6. Updates currentPage: 1
```

## Database Schema

### SearchHistory Table (DynamoDB)

```typescript
{
  userId: string,           // Partition key (user ID or IP)
  searchId: string,         // Sort key (generated from search params)
  originPlaces: [{
    placeId: string,
    name: string
  }],
  destination: string,
  vibes: string[],
  freeText?: string,
  results: [{              // Top 5 displayed results
    placeId: string,
    name: string,
    score: number
  }],
  allResults: [{          // All fetched results (20+)
    placeId: string,
    name: string,
    score: number
  }],
  shownPlaceIds: string[], // Place IDs user has seen
  currentPage: number,     // Google page index (0, 1, 2...)
  hasMorePages: boolean,   // Google has more results
  nextPageToken?: string,  // Token for next Google fetch
  timestamp: string
}
```

## Benefits

1. **No Duplicate Results**: Users never see the same cafe twice in the same search session
2. **Efficient API Usage**: Fetches 20 results per Google call but shows them gradually
3. **Seamless UX**: Users can explore options without changing parameters
4. **Smart Caching**: Distinguishes between refinement (show more) vs. modification (new search)
5. **Works for All Users**: Supports both logged-in users and anonymous (IP-based) sessions

## Testing the System

To verify the pagination works:

1. Perform a search (e.g., "coffee shops like Blue Bottle in Manhattan")
2. Note the 5 results shown
3. Click "Refine Search" without changing vibes/free text
4. Verify you see different cafes (results 6-10)
5. Repeat to see results 11-15, 16-20
6. When cache exhausted, should fetch page 2 from Google
7. Modify a vibe → Should see fresh results (new search)

## Future Enhancements

- Add UI indicator showing "X of Y results"
- "Show me more" button instead of requiring refine modal
- Cache expiration (e.g., results older than 24 hours refetch from Google)
- Prefetch next page proactively when user views result 15+
