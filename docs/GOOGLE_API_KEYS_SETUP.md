# Google API Keys Setup Guide

This guide walks you through creating and configuring Google API keys for Elsebrew. You'll need **two separate keys** (or one key with combined restrictions) for optimal security.

## Overview

Elsebrew uses Google Cloud services in multiple ways:

**Client-side (browser):**
1. Maps JavaScript API - displays interactive maps
2. Places API - autocomplete in search fields, place details via PlacesService
3. Geocoding API - converts addresses to coordinates
4. Maps Embed API - embedded map in details drawer
5. Places API (New) - searchByText for finding cafes (⚠️ currently called from browser, should be moved to server)

**Server-side (Next.js API routes):**
6. Places API (New) - fetches detailed place info via REST API

For security best practices, we recommend using **separate API keys** with different restrictions.

---

## Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**

---

## Step 2: Enable Required APIs

Before creating keys, enable this API:

1. Go to **APIs & Services** → **Library**
2. Search and enable:
   - **Maps JavaScript API** (for interactive maps in browser)
   - **Places API** (for autocomplete & PlacesService in browser)
   - **Geocoding API** (for address-to-coordinates conversion)
   - **Maps Embed API** (for embedded maps in details drawer)
   - **Places API (New)** (for searchByText in browser AND server-side place details)

**Note:** "Places API (New)" must be enabled on BOTH the client and server keys because searchByText is currently called from the browser.

---

## Step 3: Create Client-Side API Key

This key will be exposed in your frontend code and restricted by HTTP referrers.

### Create the Key

1. Click **+ CREATE CREDENTIALS** → **API key**
2. A key will be generated - click **Edit API key**
3. Name it: `Elsebrew Client (Maps JS API)`

### Configure API Restrictions

1. Under **API restrictions**, select **Restrict key**
2. Choose **ALL** of these APIs for the client key:
   - ✅ Maps JavaScript API
   - ✅ Places API
   - ✅ Geocoding API
   - ✅ Maps Embed API
   - ✅ Places API (New) (required for searchByText in browser)
3. Click **Save**

**Note:** The Places API (New) is needed for the `searchByText` method which is currently called from client-side code. For better security, this should be moved to server-side in the future.

### Configure Application Restrictions

1. Under **Application restrictions**, select **HTTP referrers (websites)**
2. Add these referrers:
   ```
   http://localhost:3000/*
   https://localhost:3000/*
   https://yourdomain.com/*
   https://*.amplifyapp.com/*
   ```
   Replace `yourdomain.com` with your actual domain
3. Click **Save**

### Add to Environment Variables

Copy the key and add it to your `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...your-key-here
```

---

## Step 4: Create Server-Side API Key

This key will only be used in server-side code and restricted by IP addresses (if possible).

### Create the Key

1. Click **+ CREATE CREDENTIALS** → **API key**
2. A key will be generated - click **Edit API key**
3. Name it: `Elsebrew Server (Places API)`

### Configure API Restrictions

1. Under **API restrictions**, select **Restrict key**
2. Choose **only** these APIs:
   - ✅ Places API (New)
3. Click **Save**

### Configure Application Restrictions

**For Local Development:**
- Select **None** (or add your local IP if you have a static IP)

**For Production (AWS Amplify):**
- AWS Amplify uses dynamic IPs for serverless functions, so you have two options:

  **Option A: No Restrictions (Less Secure)**
  - Select **None**
  - This is acceptable because the key is only in server-side code and not exposed to clients

  **Option B: IP Restrictions (More Secure)**
  - If you have static outbound IPs from AWS, add them here
  - Contact AWS support or check CloudWatch logs to find your Amplify function IPs

### Add to Environment Variables

Copy the key and add it to your `.env.local`:

```bash
GOOGLE_MAPS_API_KEY=AIzaSy...your-key-here
```

---

## Step 5: Verify Your Setup

Run the environment check script:

```bash
npm run check-env
```

You should see:
```
✅ Google Maps API Key (client) - AIzaSy...
✅ Google Maps API Key (server) - AIzaSy...
```

---

## Option: Using a Single Key (Not Recommended)

If you prefer to use one key for both purposes:

1. Create one API key
2. Enable **ALL FIVE** APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
   - Maps Embed API
   - Places API (New)
3. Use **HTTP referrers** restriction (less secure for server-side)
4. Use the same key for both environment variables:
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...same-key
   GOOGLE_MAPS_API_KEY=AIzaSy...same-key
   ```

**Warning:** This is less secure because HTTP referrer restrictions can be bypassed.

---

## Troubleshooting

### "This API project is not authorized to use this API"

**Solution:** Make sure you've enabled the correct APIs in Step 2.

### "API keys with referer restrictions cannot be used with this API"

**Solution:** You're using the client-side key (with HTTP referrer restrictions) for server-side API calls. Make sure:
- Your server-side code uses `GOOGLE_MAPS_API_KEY`
- Your client-side code uses `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### Maps not loading in production

**Solution:** Check that your production domain is added to the HTTP referrers list:
1. Go to Google Cloud Console → Credentials
2. Edit your client-side key
3. Add your production domain: `https://yourdomain.com/*`

### Server-side API calls failing in production

**Solution:**
1. Verify `GOOGLE_MAPS_API_KEY` is set in AWS Amplify environment variables
2. Check that the key has **Places API (New)** enabled
3. If using IP restrictions, switch to **None** for serverless environments

---

## Security Best Practices

✅ **DO:**
- Use separate keys for client and server
- Restrict client keys with HTTP referrers
- Restrict server keys with IP addresses (when possible)
- Enable only the APIs you need
- Rotate keys periodically
- Monitor usage in Google Cloud Console

❌ **DON'T:**
- Use the same key with weak restrictions
- Commit keys to version control (use `.env.local`)
- Enable unnecessary APIs
- Use NEXT_PUBLIC_ prefix for server-only keys

---

## Cost Monitoring

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Dashboard**
3. Monitor your API usage
4. Set up billing alerts to avoid unexpected charges

**Free Tier:**
- Maps JavaScript API: $200/month free credit
- Places API (New): First 1,000 requests/month free

See [Google Maps Platform Pricing](https://mapsplatform.google.com/pricing/) for details.

---

## Next Steps

- Set up [Google OAuth](./SETUP_GUIDE.md#step-2-google-oauth-setup) for "Sign in with Google"
- Configure [AWS DynamoDB](./SETUP_GUIDE.md#step-4-aws-dynamodb-setup) for saved places
- Deploy to [AWS Amplify](./AWS_DEPLOYMENT.md)
