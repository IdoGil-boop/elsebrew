# Elsebrew Launch Checklist

Use this checklist to get Elsebrew from code to production.

## ✅ Initial Setup

- [ ] Verified Node.js 18+ installed (`node --version`)
- [ ] Ran `npm install` successfully
- [ ] Created `.env.local` from `.env.example`

## ✅ Google Cloud Platform Setup

### Google Maps API

**See [GOOGLE_API_KEYS_SETUP.md](./GOOGLE_API_KEYS_SETUP.md) for detailed instructions**

- [ ] Created Google Cloud project
- [ ] Enabled **Maps JavaScript API**
- [ ] Enabled **Places API**
- [ ] Enabled **Geocoding API**
- [ ] Enabled **Maps Embed API**
- [ ] Enabled **Places API (New)**
- [ ] Created client-side API key (for browser)
- [ ] Restricted client key: HTTP referrers + Maps JavaScript API + Places API + Geocoding API + Maps Embed API
- [ ] Added `http://localhost:3000/*` to allowed referrers
- [ ] Copied client key to `.env.local` → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- [ ] Created server-side API key (for Next.js API routes)
- [ ] Restricted server key: IP addresses (or None) + Places API (New) only
- [ ] Copied server key to `.env.local` → `GOOGLE_MAPS_API_KEY`

### Google OAuth
- [ ] Created OAuth 2.0 Client ID (Web application)
- [ ] Added `http://localhost:3000` to authorized JavaScript origins
- [ ] Copied Client ID to `.env.local` → `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`

## ✅ OpenAI Setup

- [ ] Created OpenAI account
- [ ] Generated API key
- [ ] Added credits to account ($5 minimum recommended)
- [ ] Copied API key to `.env.local` → `OPENAI_API_KEY`

## ✅ Optional Services

### Google Analytics 4 (recommended for validation)
- [ ] Created GA4 property
- [ ] Copied Measurement ID to `.env.local` → `NEXT_PUBLIC_GA4_MEASUREMENT_ID`

### Buy Me A Coffee (recommended)
- [ ] Created Buy Me A Coffee account
- [ ] Copied profile URL to `.env.local` → `NEXT_PUBLIC_BUYMEACOFFEE_URL`

### Mailchimp (optional)
- [ ] Created Mailchimp account
- [ ] Created audience
- [ ] Created embedded form
- [ ] Copied form action URL to `.env.local` → `MAILCHIMP_FORM_ACTION`
- [ ] Updated `components/home/EmailSignup.tsx` to actually POST (if desired)

## ✅ Local Testing

- [ ] Ran `npm run check-env` - all required vars show ✅
- [ ] Ran `npm run dev` successfully
- [ ] Opened http://localhost:3000 in browser
- [ ] Home page loads with search panel
- [ ] Source café autocomplete shows suggestions
- [ ] Destination city autocomplete shows suggestions
- [ ] Submitted a search (e.g., "Blue Bottle Oakland" → "Tokyo, Japan")
- [ ] Results page loads with café list
- [ ] Map displays with numbered markers
- [ ] Clicked a result → details drawer opens
- [ ] Embedded Google Map shows in drawer
- [ ] "Open in Google Maps" button works
- [ ] "Save" button works (check localStorage in DevTools)
- [ ] Clicked "Sign in with Google" → OAuth flow completes
- [ ] Avatar appears in header after sign-in
- [ ] Navigated to /saved → saved café appears
- [ ] Clicked "Sign out" → avatar disappears

## ✅ Analytics Verification

- [ ] Opened GA4 Realtime dashboard (if configured)
- [ ] Performed a search
- [ ] Verified `search_submit` event appears in GA4
- [ ] Clicked a result
- [ ] Verified `result_click` event appears in GA4

## ✅ Build & Production

- [ ] Ran `npm run build` successfully
- [ ] No TypeScript errors
- [ ] No build warnings (or acceptable warnings noted)
- [ ] Ran `npm run start` to test production build locally
- [ ] Tested same flows as local testing above

## ✅ Deployment Preparation

- [ ] Chose hosting platform (Vercel recommended)
- [ ] Created account on hosting platform
- [ ] Connected GitHub repository (or pushed code)
- [ ] Added environment variables in hosting dashboard:
  - [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  - [ ] `GOOGLE_MAPS_API_KEY`
  - [ ] `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`
  - [ ] `OPENAI_API_KEY`
  - [ ] `NEXT_PUBLIC_GA4_MEASUREMENT_ID` (if using)
  - [ ] `NEXT_PUBLIC_BUYMEACOFFEE_URL` (if using)
  - [ ] `MAILCHIMP_FORM_ACTION` (if using)

## ✅ Post-Deployment

- [ ] Deployed to production
- [ ] Noted production URL (e.g., `https://elsebrew.vercel.app`)
- [ ] Updated Google Maps API key restrictions:
  - [ ] Added `https://yourdomain.com/*` to allowed referrers
- [ ] Updated OAuth authorized origins:
  - [ ] Added `https://yourdomain.com` to authorized JavaScript origins
- [ ] Tested full flow on production URL
- [ ] Verified analytics tracking on production
- [ ] Checked all pages load (/, /results, /saved, /about, /privacy, /terms)
- [ ] Tested mobile responsiveness

## ✅ Monitoring & Optimization

- [ ] Set up Google Cloud billing alerts
- [ ] Set up OpenAI usage monitoring
- [ ] Reviewed GA4 dashboard setup
- [ ] Tested search from different locations
- [ ] Verified cost estimates match expectations

## ✅ Marketing & Launch

- [ ] Updated About page with correct contact info
- [ ] Updated Privacy & Terms if needed
- [ ] Tested email signup flow
- [ ] Set up Mailchimp welcome email (if using)
- [ ] Prepared social media posts
- [ ] Identified target communities (coffee subreddits, etc.)
- [ ] Created launch announcement

## ✅ Post-Launch Tracking

Track these metrics for validation:

- [ ] Daily active users (GA4)
- [ ] Search conversion rate (searches / visitors)
- [ ] Email signups (Mailchimp or local tracking)
- [ ] "Pro coming soon" clicks (fake door validation)
- [ ] Buy Me A Coffee clicks/conversions
- [ ] Average searches per user
- [ ] Most popular source/destination cities
- [ ] API costs (Google Maps + OpenAI)

## 🎯 Success Criteria (30 days)

Define your validation goals:

- [ ] X daily active users
- [ ] Y total searches
- [ ] Z email signups
- [ ] $W in Buy Me A Coffee support
- [ ] Positive user feedback

If met → build Pro tier!

---

**Questions?** See [SETUP_GUIDE.md](./SETUP_GUIDE.md) or [README.md](./README.md)
