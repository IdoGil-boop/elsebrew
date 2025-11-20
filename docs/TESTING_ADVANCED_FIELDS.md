# Testing Advanced Place Fields (REST API)

## Quick Test Steps

### 1. Set Up Environment
Make sure you have `GOOGLE_MAPS_API_KEY` in `.env.local`:
```bash
GOOGLE_MAPS_API_KEY=AIza...  # Server-side key (can be same as client key for testing)
```

### 2. Start Dev Server
```bash
npm run dev
```

### 3. Perform a Search
1. Go to http://localhost:3000
2. Enter a favorite café (e.g., "Blue Bottle Coffee")
3. Enter a destination (e.g., "Tokyo, Japan")
4. Click "Find my twins"

### 4. Check Browser Console
Look for these logs:

**✅ Success indicators:**
```
[Places Search] Fetching advanced fields for 5 places
[Places Search] Advanced fields fetched: 5 places, 5 with data
```

**⚠️ No Advanced Data SKU (expected):**
```
[Places Search] Fetching advanced fields for 5 places
[Places Search] Advanced fields fetched: 5 places, 0 with data
```
(This is fine - fields will be `undefined` but no errors)

**❌ Errors (should NOT see):**
- ~~`Unknown fields requested: outdoorSeating, takeout...`~~ ← Should be GONE
- Any red errors in console

### 5. Check Network Tab
1. Open DevTools → Network tab
2. Filter by "details"
3. Look for POST request to `/api/google/places/details`
4. Check the response:
   - **Status 200**: ✅ API route working
   - **Response body**: Should have `fieldsByPlaceId` object
   - If Advanced Data SKU enabled: Fields will have values
   - If not enabled: Fields will be empty `{}`

### 6. Check Server Logs (Terminal)
Look for:
```
[Places Details API] Fetching 5 places with fields: outdoorSeating,takeout,delivery,...
[Places Details API] Successfully fetched fields for 5/5 places (120 total fields)
```

**If Advanced Data SKU not enabled:**
```
[Places Details API] Fetching 5 places with fields: outdoorSeating,takeout,delivery,...
[Places Details API] Successfully fetched fields for 5/5 places (0 total fields)
```

### 7. Verify Data in Results
In browser console, after search completes:
```javascript
// Check if fields are populated
const firstResult = /* get from React DevTools or console */;
console.log('Outdoor seating:', firstResult.place.outdoorSeating);
console.log('Takeout:', firstResult.place.takeout);
console.log('Delivery:', firstResult.place.delivery);
```

**Expected:**
- **With Advanced Data SKU**: `true`/`false` values
- **Without Advanced Data SKU**: `undefined` (no errors)

## What Success Looks Like

### ✅ Working Correctly:
1. **No console errors** - "Unknown fields requested" warnings are gone
2. **Network request visible** - POST to `/api/google/places/details` appears
3. **Server logs show success** - "Successfully fetched fields" message
4. **Fields populated** (if Advanced Data SKU enabled) - `outdoorSeating`, `takeout`, etc. have values

### ⚠️ Working but No Data (Normal):
1. **No console errors** ✅
2. **Network request visible** ✅
3. **Server logs show 0 total fields** - This means Advanced Data SKU not enabled
4. **Fields are `undefined`** - Expected behavior, not an error

### ❌ Not Working:
1. **Console errors** - Check server logs for API key issues
2. **No network request** - Check that `fetchAdvancedPlaceFields` is being called
3. **500 errors** - Check server logs for API key or network issues

## Troubleshooting

### Issue: "Google Maps API key is not configured"
**Fix:** Add `GOOGLE_MAPS_API_KEY` to `.env.local` and restart dev server

### Issue: Network request returns 500
**Check server logs** for:
- API key invalid
- API not enabled in Google Cloud Console
- Quota exceeded

### Issue: Fields still undefined after enabling Advanced Data SKU
**Check:**
1. Google Cloud Console → Billing → Verify Advanced Data SKU is enabled
2. API key has "Places API" enabled (not just "Places API (New)")
3. Wait a few minutes for billing changes to propagate

## Advanced: Inspect API Response

Add this temporarily to see raw API response:

```typescript
// In lib/places-search.ts, after fetchAdvancedPlaceFields call:
console.log('[DEBUG] Advanced fields response:', advancedFieldsByPlaceId);
```

This will show exactly what Google's REST API returned.

