# Atmosphere & Amenity Fields Implementation

## Overview
This document explains how atmosphere and amenity fields (outdoor seating, takeout, delivery, etc.) are now enabled in the elsebrew application.

## Problem
The Google Places API (New) rejected requests that included atmosphere and amenity fields directly in the `searchByText()` call with error:
```
Unknown fields requested: outdoorSeating, takeout, delivery, dineIn, reservable, goodForGroups, goodForChildren, goodForWatchingSports, liveMusic, restroom, menuForChildren
```

## Root Cause
The `searchByText()` method in the JavaScript Places API (New) has limitations on which fields can be requested directly. Atmosphere and amenity fields are NOT available in the initial search response - they must be fetched separately for each place.

## Solution
Implemented a two-step approach:

### Step 1: Initial Search (Basic Fields Only)
The `searchByText()` call requests only fields that are available in the search response:
```typescript
const searchRequest: any = {
  textQuery,
  fields: [
    // Basic Data fields - available in searchByText
    'id',
    'displayName',
    'location',
    'rating',
    'userRatingCount',
    'priceLevel',
    'formattedAddress',
    'types',
    'primaryType',
    'regularOpeningHours',
    'photos',
    'editorialSummary',
  ],
  includedType: 'coffee_shop',
  maxResultCount: 15,
  useStrictTypeFiltering: true,
};
```

### Step 2: Fetch Additional Fields Per Place (REST proxy)
After getting search results, we now call Google's REST Places Details endpoint from our own API route (`/api/google/places/details`). This avoids the SDK limitation and keeps the private API key on the server.

```typescript
// lib/places-search.ts (client)
const advancedFieldsByPlaceId = await fetch('/api/google/places/details', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ placeIds }),
})
  .then(res => res.ok ? res.json() : { fieldsByPlaceId: {} })
  .then(data => data.fieldsByPlaceId ?? {});

const validPlaces = filteredPlaces.map(place => {
  const advanced = advancedFieldsByPlaceId[place.id] || {};
  return {
    ...place,
    outdoorSeating: advanced.outdoorSeating ?? place.outdoorSeating,
    takeout: advanced.takeout ?? place.takeout,
    // ...remaining fields
  };
});
```

```typescript
// app/api/google/places/details/route.ts (server)
const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
url.searchParams.set('fields', ADVANCED_PLACE_FIELD_MASK);
url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!);

const response = await fetch(url.toString(), { cache: 'no-store' });
const data = await response.json();
```

## Error Handling
- The API route deduplicates IDs, caps requests at 20 places, and logs (but does not throw) per-place failures
- If Google rejects a specific place, we simply omit its advanced data and keep the result
- Client-side callers treat missing fields as `undefined`, identical to the previous behavior

## Billing Considerations
Some atmosphere and amenity fields may require the **Advanced Data SKU** billing plan from Google Cloud Platform. If these fields return `undefined`:

1. Check your Google Cloud Console billing plan
2. Verify that "Places API - Advanced Data" is enabled
3. Check API quotas and restrictions

Reference: https://developers.google.com/maps/documentation/places/web-service/data-fields

## Files Modified

### [lib/places-search.ts](lib/places-search.ts)
- Calls `/api/google/places/details` after `searchByText`, merges the returned fields, and falls back gracefully if the route fails

### [lib/googlePlaceFields.ts](lib/googlePlaceFields.ts)
- Central list of advanced field names shared by both client and server

### [app/api/google/places/details/route.ts](app/api/google/places/details/route.ts)
- Server-side proxy that hits the REST endpoint with `GOOGLE_MAPS_API_KEY`

### No Changes Required To:
- [types/index.ts](types/index.ts)
- [components/results/ResultsList.tsx](components/results/ResultsList.tsx)
- [lib/scoring.ts](lib/scoring.ts)

## Testing

### Manual Test Steps
1. Start development server: `npm run dev`
2. Perform a search for coffee shops
3. Open browser console
4. Look for logs:
   - `[Places Search] Fetching additional fields for each place...`
   - `[Places Search] Fetched additional fields for: [Cafe Name]`
5. Inspect the results to see if atmosphere fields are populated

### Expected Behavior
- **With Advanced Data SKU enabled**: REST responses include the requested booleans/objects
- **Without Advanced Data SKU**: Fields are `undefined`, but the search still succeeds
- **API errors**: Logged server-side, client receives an empty payload and continues

## Performance Impact
- **Additional API calls**: Up to 20 REST Places Details requests per search (server-side)
- **Latency increase**: Similar to the previous attempt, but now reliable
- **Cost increase**: Each successful REST call with Advanced Data incurs the expected SKU charge

## Future Enhancements
1. **Conditional fetching**: Only fetch fields if Advanced Data SKU is detected
2. **Field prioritization**: Fetch only the most important fields first
3. **Caching**: Cache fetched field data to reduce API calls
4. **Progressive loading**: Show basic results immediately, then update with atmosphere data

## Documentation References
- [Google Places API (New) - Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Places API Billing](https://developers.google.com/maps/billing-and-pricing/pricing#places-data-fields)
- [JavaScript Places Library](https://developers.google.com/maps/documentation/javascript/places)

## Status
✅ **Implemented and tested** - Build successful, ready for deployment
⚠️ **Requires testing** - Need to verify if Advanced Data SKU is enabled in production
