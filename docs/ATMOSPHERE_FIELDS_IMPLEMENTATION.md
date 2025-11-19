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

### Step 2: Fetch Additional Fields Per Place
After getting search results, we fetch atmosphere & amenity fields for each place individually:
```typescript
const additionalFields = [
  'outdoorSeating',
  'takeout',
  'delivery',
  'dineIn',
  'reservable',
  'goodForGroups',
  'goodForChildren',
  'goodForWatchingSports',
  'liveMusic',
  'servesCoffee',
  'servesBreakfast',
  'servesBrunch',
  'servesLunch',
  'servesDinner',
  'servesBeer',
  'servesWine',
  'servesVegetarianFood',
  'allowsDogs',
  'restroom',
  'menuForChildren',
  'accessibilityOptions',
  'paymentOptions',
  'parkingOptions',
];

// Fetch for each place
await Promise.all(
  places.map(async (place: any) => {
    try {
      await place.fetchFields({ fields: additionalFields });
    } catch (error) {
      // Fields will be undefined if not available
      console.warn(`Could not fetch additional fields for ${place.displayName}`);
    }
  })
);
```

## Error Handling
The implementation includes graceful error handling:
- If `fetchFields()` fails for a place, that place will still be included in results
- Fields that aren't available will be `undefined` in the `PlaceBasicInfo` object
- Warnings are logged to console for debugging

## Billing Considerations
Some atmosphere and amenity fields may require the **Advanced Data SKU** billing plan from Google Cloud Platform. If these fields return `undefined`:

1. Check your Google Cloud Console billing plan
2. Verify that "Places API - Advanced Data" is enabled
3. Check API quotas and restrictions

Reference: https://developers.google.com/maps/documentation/places/web-service/data-fields

## Files Modified

### [lib/places-search.ts](lib/places-search.ts)
**Changes:**
1. Removed atmosphere/amenity fields from `searchRequest.fields` array (lines 89-103)
2. Created `additionalFields` array with all atmosphere/amenity field names (lines 109-135)
3. Added `fetchFields()` call after search results (lines 245-265)
4. Added error handling and logging

**Key sections:**
- Lines 87-107: Basic search request with only available fields
- Lines 109-135: List of additional fields to fetch separately
- Lines 245-265: Async fetching of additional fields per place

### No Changes Required To:
- [types/index.ts](types/index.ts) - Already has all atmosphere/amenity fields defined (lines 33-56)
- [components/results/ResultsList.tsx](components/results/ResultsList.tsx) - Will automatically receive the new fields
- [lib/scoring.ts](lib/scoring.ts) - Can now use these fields for enhanced scoring

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
- **With Advanced Data SKU enabled**: Fields will be populated with boolean values or objects
- **Without Advanced Data SKU**: Fields will be `undefined` but search will still work
- **API errors**: Will be logged to console but won't break the search

## Performance Impact
- **Additional API calls**: One `fetchFields()` call per place (typically 5-15 places)
- **Latency increase**: Approximately 100-500ms additional delay per search
- **Cost increase**: If Advanced Data SKU is enabled, each fetchFields() call may incur additional charges

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
