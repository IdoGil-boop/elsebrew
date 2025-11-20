# Deployment Troubleshooting Guide

## AWS Amplify: "Failed to get source place details" Error

### Problem
When running the app on AWS Amplify, clicking search results in the error:
```
Something went wrong
Failed to get source place details
```

### Root Causes & Solutions

#### 1. Google Maps API Keys Not Configured in AWS Amplify

**Check:**
- Go to AWS Amplify Console → Your App → Environment Variables
- Verify both `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (client) **and** `GOOGLE_MAPS_API_KEY` (server) are set

**Fix:**
1. Log into AWS Amplify Console
2. Navigate to your app
3. Go to **Environment variables** (in left sidebar)
4. Add/confirm `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (client-side, HTTP-referrer restricted)
5. Add/confirm `GOOGLE_MAPS_API_KEY` (server-side, for Places API calls)
6. **Redeploy** the app (variables only apply to new builds)

**📘 See:** [GOOGLE_API_KEYS_SETUP.md](./GOOGLE_API_KEYS_SETUP.md) for detailed key configuration

#### 2. Google Maps API Key Restrictions

**Problem:** Your client-side API key might be restricted to localhost only

**Check:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your **client-side API key** (the one for `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
4. Check **Application restrictions** section

**Fix:**
Update the **HTTP referrers** for your **client-side key** to include your AWS Amplify domain:

**Secure Option (Recommended):**
```
http://localhost:3000/*
https://main.d1a2b3c4d5e6.amplifyapp.com/*
https://*.d1a2b3c4d5e6.amplifyapp.com/*
https://your-custom-domain.com/*
```

**How to get your Amplify app ID:**
1. Go to AWS Amplify Console → Your App
2. Look at the URL: `https://console.aws.amazon.com/amplify/home?region=us-east-1#/d1a2b3c4d5e6`
3. The `d1a2b3c4d5e6` part is your app ID
4. Or check your deployed URL: `https://main.d1a2b3c4d5e6.amplifyapp.com`

**Pattern explanation:**
- `https://main.d1a2b3c4d5e6.amplifyapp.com/*` - Your main branch
- `https://*.d1a2b3c4d5e6.amplifyapp.com/*` - All your branch previews (dev, staging, etc.)
- Replace `d1a2b3c4d5e6` with your actual Amplify app ID

**⚠️ Security Warning:**
- ❌ Don't use `https://*.amplifyapp.com/*` - This allows **any** Amplify app to use your API key
- ✅ Use `https://*.YOUR_APP_ID.amplifyapp.com/*` - Only your branches can use it

#### 3. Required Google APIs Not Enabled

**Check:** Ensure these APIs are enabled in Google Cloud Console:
1. Go to **APIs & Services** → **Library**
2. Search and enable:
   - ✅ Maps JavaScript API (for client-side key)
   - ✅ Places API (New) (for server-side key)

#### 4. API Quota Exceeded

**Check:**
1. Go to **APIs & Services** → **Dashboard**
2. Check quota usage for Places API
3. Look for quota errors

**Fix:**
- Enable billing on your Google Cloud project
- Request quota increase if needed
- Implement rate limiting/caching

#### 5. Environment Variable Not Refreshed

AWS Amplify caches environment variables. After changing them:

**Fix:**
1. Go to AWS Amplify Console
2. Click **Redeploy this version**
3. Or trigger a new build by pushing a commit

### Testing the Fix

After applying fixes, test:

1. **Check environment variables:**
```bash
# In browser console on your Amplify URL:
console.log(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.substring(0, 10));
# Should show first 10 chars, not undefined

# Server key can't be read from browser—confirm via Amplify env settings
```

2. **Check API key restrictions:**
   - Open Network tab in browser DevTools
   - Look for requests to `maps.googleapis.com`
   - Check for 403 errors or "API key not valid" messages

3. **Check browser console:**
   - Look for `[Maps Loader]` log messages
   - Should see: `[Maps Loader] Initializing with API key: AIza...`

### Additional Debugging

Add this to your search URL to see detailed error info:
```
https://your-app.amplifyapp.com/results?...
```

Then open browser console and look for:
- `[Results] getPlaceDetails failed` - Shows the specific Places API status
- `[Maps Loader] Failed to load Google Maps` - Shows API loading errors

### Quick Checklist

- [ ] Environment variables `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_API_KEY` set in AWS Amplify
- [ ] App redeployed after setting environment variables
- [ ] API key includes AWS Amplify domain in HTTP referrer restrictions
- [ ] All required Google APIs enabled (Maps JavaScript, Places, Geocoding, Embed)
- [ ] Billing enabled on Google Cloud project
- [ ] No quota errors in Google Cloud Console

---

## Local Development: 401 Unauthorized Errors

### Problem
Console shows multiple 401 errors:
```
GET http://localhost:3000/api/user/saved-places 401 (Unauthorized)
POST http://localhost:3000/api/user/saved-places 401 (Unauthorized)
```

### Root Cause
Google JWT tokens expire quickly (typically 1 hour), and the auth verification was rejecting expired tokens.

### Fix Applied
Updated [lib/auth.ts](lib/auth.ts) to allow tokens up to 24 hours past expiration for MVP purposes.

**For Production:** Implement proper OAuth refresh token flow.

### Testing
1. Sign in with Google
2. Wait for token to expire (1 hour)
3. Try to save a cafe
4. Should work (with warning in console, but no 401 error)

---

## Google API Deprecation Warnings

You'll see these warnings in the console:

### 1. PlacesService Deprecation
```
google.maps.places.PlacesService is deprecated. Please use google.maps.places.Place instead.
```

**Status:** Not urgent - Google will give 12 months notice before discontinuation
**Fix:** See TODO item "Update deprecated Google Places API usage"

### 2. Marker Deprecation
```
google.maps.Marker is deprecated. Please use google.maps.marker.AdvancedMarkerElement instead.
```

**Status:** Not urgent - Google will give 12 months notice before discontinuation
**Fix:** See TODO item "Update deprecated Marker API"

**Migration Guide:** https://developers.google.com/maps/documentation/javascript/advanced-markers/migration

---

## Monitoring & Logging

### AWS Amplify Logs

1. Go to AWS Amplify Console → Your App
2. Click on a deployment
3. View build logs and runtime logs
4. Look for:
   - Environment variable values (they should show `***` if set)
   - Build errors
   - Runtime errors

### Google Cloud Monitoring

1. Go to Google Cloud Console
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your API key
4. View **Metrics** tab to see:
   - Request count
   - Error rate
   - Quota usage

---

## Still Having Issues?

### Get Better Error Messages

The code now includes detailed logging. Check:

1. **Browser Console:** Look for `[Maps Loader]` and `[Results]` prefixed messages
2. **Network Tab:** Check response bodies for 403/400 errors from Google APIs
3. **AWS CloudWatch:** Check Next.js server logs (if using SSR)

### Common Error Messages & Fixes

| Error Message | Cause | Fix |
|--------------|-------|-----|
| "Google Maps API key is not configured" | Missing env var | Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| "RefererNotAllowedMapError" | Domain not in API restrictions | Add AWS domain to HTTP referrers |
| "REQUEST_DENIED" | API not enabled | Enable Places API in Google Cloud |
| "OVER_QUERY_LIMIT" | Quota exceeded | Enable billing or wait for quota reset |
| "INVALID_REQUEST" | Malformed request | Check place_id format |
| "UNKNOWN_ERROR" | Temporary Google issue | Retry the request |

### Contact

If you're still stuck:
1. Check [FILE_TREE.txt](./FILE_TREE.txt) for code structure
2. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
3. Open an issue with:
   - Error message from console
   - Network tab screenshot
   - Your API key restrictions (screenshot, hide the key value)
