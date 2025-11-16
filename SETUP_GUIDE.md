# Elsebrew Setup Guide

Quick setup guide to get Elsebrew running locally.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Google Cloud Platform account
- [ ] OpenAI account (or other LLM provider)
- [ ] (Optional) Google Analytics 4 property
- [ ] (Optional) Mailchimp account
- [ ] (Optional) Buy Me A Coffee account

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Google Maps API Setup

### Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to "APIs & Services" → "Library"
4. Enable these 4 APIs:
   - **Maps JavaScript API**
   - **Places API**
   - **Geocoding API**
   - **Maps Embed API**

### Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the key (you'll add it to `.env.local` shortly)

### Restrict API Key (IMPORTANT!)

1. Click on your newly created API key
2. Under "Application restrictions":
   - Select "HTTP referrers (websites)"
   - Add:
     - `http://localhost:3000/*` (for development)
     - `https://yourdomain.com/*` (for production - add this later)
3. Under "API restrictions":
   - Select "Restrict key"
   - Check only these 4 APIs:
     - Maps JavaScript API
     - Places API
     - Geocoding API
     - Maps Embed API
4. Click "Save"

---

## Step 3: Google OAuth Client ID

### Create OAuth Client

1. In Google Cloud Console, go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. If prompted, configure the OAuth consent screen first:
   - User Type: External
   - App name: Elsebrew
   - Support email: your email
   - Authorized domains: (leave empty for now)
4. Application type: **Web application**
5. Name: Elsebrew
6. Authorized JavaScript origins:
   - `http://localhost:3000`
   - (Add your production domain later)
7. Click "Create"
8. Copy the "Client ID" (format: `xxxxx.apps.googleusercontent.com`)

---

## Step 4: OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up / sign in
3. Navigate to "API Keys"
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)
6. **Important:** Add credits to your OpenAI account if you haven't already

**Cost estimate:** Each café match costs ~$0.0001 (using gpt-4o-mini)

---

## Step 5: Configure Environment Variables

1. Copy the example file:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your keys:

```bash
# Required
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=123456789-abc...apps.googleusercontent.com
OPENAI_API_KEY=sk-...

# Optional - leave empty to disable
NEXT_PUBLIC_GA4_MEASUREMENT_ID=
NEXT_PUBLIC_BUYMEACOFFEE_URL=https://www.buymeacoffee.com/yourname
MAILCHIMP_FORM_ACTION=
```

---

## Step 6: Run the App

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Step 7: Test the Core Flow

1. **Home page loads** ✓
   - Hero, search panel, pricing strip visible

2. **Search autocomplete works** ✓
   - Type a café name in "Your favorite café"
   - Type a city name in "Where are you going?"
   - Both should show autocomplete suggestions

3. **Submit a search** ✓
   - Fill in both fields
   - Optionally select vibe toggles
   - Click "Find my twins"

4. **Results page** ✓
   - Shows list of cafés on the left
   - Shows map with markers on the right (desktop)
   - Each result has photo, rating, tags

5. **Click a result** ✓
   - Details drawer opens
   - Shows embedded Google Map
   - "Open in Google Maps" button works
   - "Save" button works (check localStorage)

6. **Sign in** ✓
   - Click "Sign in with Google" in header
   - Complete OAuth flow
   - Avatar appears in header

7. **Saved cafés** ✓
   - Navigate to `/saved`
   - Previously saved cafés appear

---

## Optional: Analytics Setup

### Google Analytics 4

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new property
3. Get your Measurement ID (format: `G-XXXXXXXXXX`)
4. Add to `.env.local`:

```bash
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

5. Restart dev server
6. Check GA4 Realtime to verify events

---

## Optional: Email Signup

### Mailchimp

1. Create a Mailchimp account
2. Create an audience
3. Create an embedded form
4. Copy the form action URL
5. Add to `.env.local`:

```bash
MAILCHIMP_FORM_ACTION=https://XXXXX.usX.list-manage.com/subscribe/post?u=...&id=...
```

**Note:** Current implementation shows success message without actually POSTing. To enable real submissions, update `components/home/EmailSignup.tsx`.

---

## Optional: Buy Me A Coffee

1. Create account at [Buy Me A Coffee](https://www.buymeacoffee.com/)
2. Copy your profile URL
3. Add to `.env.local`:

```bash
NEXT_PUBLIC_BUYMEACOFFEE_URL=https://www.buymeacoffee.com/yourname
```

---

## Troubleshooting

### Maps not loading
- Check browser console for API key errors
- Verify all 4 APIs are enabled
- Check API key restrictions match your domain

### "This site can't provide a secure connection" on OAuth
- Make sure you added `http://localhost:3000` (not https) to authorized origins

### LLM reasoning not appearing
- Check OpenAI API key is correct
- Verify you have credits in OpenAI account
- Check terminal for API errors

### Build errors
- Make sure you're on Node.js 18+
- Delete `.next` folder and `node_modules`, then reinstall:
  ```bash
  rm -rf .next node_modules
  npm install
  npm run build
  ```

---

## Production Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy
5. **Update Google Maps API key restrictions** to include your Vercel domain
6. **Update OAuth authorized origins** to include your Vercel domain

---

## Cost Estimates (MVP with ~100 searches/day)

- **Google Maps Platform:** ~$10-20/month
  - Text Search: $32/1000 requests
  - Place Details: $17/1000 requests
  - Map loads: $7/1000 loads
  - Autocomplete: $2.83/1000 sessions

- **OpenAI:** ~$0.50-1/month
  - gpt-4o-mini: ~$0.0001 per café match explanation

- **Total:** ~$10-25/month for validation phase

---

## Next Steps

1. Customize the design (colors, fonts) in `tailwind.config.ts`
2. Adjust scoring algorithm in `lib/scoring.ts`
3. Add more vibe toggles in `components/home/SearchPanel.tsx`
4. Update copy in `app/page.tsx` and footer pages
5. Deploy to production
6. Share with coffee lovers! ☕

---

**Questions?** Check the main [README.md](./README.md) for detailed documentation.
