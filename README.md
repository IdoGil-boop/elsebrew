# Elsebrew ☕

**Find your café's twin, anywhere.**

Elsebrew is a fake-door MVP that helps coffee lovers discover cafés in new cities that match the vibe of their favorite local spots. Built with Next.js 14, Google Maps Platform, and AI-powered matching.

> 📁 **New here?** See [docs/FILE_TREE.txt](./docs/FILE_TREE.txt) for a visual overview of the project structure.
>
> 📚 **Looking for specific docs?** See [docs/DOCS_INDEX.md](./docs/DOCS_INDEX.md) for documentation navigation.
>
> 🆕 **Latest Features:**
> - ✅ Place interaction tracking for all users (anonymous + logged-in) - see [docs/PLACE_TRACKING_FEATURE.md](docs/PLACE_TRACKING_FEATURE.md)
> - ✅ Atmosphere & amenity fields (outdoor seating, takeout, etc.) - see [docs/ATMOSPHERE_FIELDS_IMPLEMENTATION.md](docs/ATMOSPHERE_FIELDS_IMPLEMENTATION.md)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Google Cloud Platform account
- OpenAI API key (or compatible LLM provider)
- (Optional) Google Analytics 4 property
- (Optional) Mailchimp account
- (Optional) Buy Me A Coffee account

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual keys (see Configuration section below).

3. **Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Configuration

### Required Environment Variables

#### Google Maps API Keys

Elsebrew requires **two API keys** for security best practices:

1. **Client-side key** (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) - for Maps JavaScript API and Places autocomplete in the browser
2. **Server-side key** (`GOOGLE_MAPS_API_KEY`) - for Places API (New) calls from Next.js API routes

**Quick Setup:**

See [docs/GOOGLE_API_KEYS_SETUP.md](./docs/GOOGLE_API_KEYS_SETUP.md) for detailed step-by-step instructions.

**TL;DR:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable these 5 APIs: **Maps JavaScript API**, **Places API**, **Geocoding API**, **Maps Embed API**, and **Places API (New)**
3. Create two API keys with different restrictions:
   - Client key: HTTP referrers + ALL 5 APIs (including Places API New for searchByText)
   - Server key: IP addresses (or None) + Places API (New) only
4. Add to `.env.local`:

```bash
# Client-side (for Maps JS API)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...

# Server-side (for Places API)
GOOGLE_MAPS_API_KEY=AIza...
```

#### Google OAuth Client ID (for Sign In with Google)

1. In Google Cloud Console, go to APIs & Services → Credentials
2. Create credentials → OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://yourdomain.com` (production)
5. Add to `.env.local`:

```
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=123456789-abc...apps.googleusercontent.com
```

#### OpenAI API Key

1. Sign up at [OpenAI](https://platform.openai.com/)
2. Create an API key
3. Add to `.env.local`:

```
OPENAI_API_KEY=sk-...
```

**Note:** The app uses `gpt-4o-mini` for cost efficiency. Each café match explanation costs ~$0.0001.

---

### Optional Environment Variables

#### Google Analytics 4

1. Create a GA4 property at [Google Analytics](https://analytics.google.com/)
2. Get your Measurement ID (format: `G-XXXXXXXXXX`)
3. Add to `.env.local`:

```
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

If left empty, analytics tracking will be disabled.

#### Mailchimp (Email Signup)

1. Create a Mailchimp audience
2. Create an embedded form
3. Copy the form action URL (looks like `https://XXXXX.usX.list-manage.com/subscribe/post?u=...&id=...`)
4. Add to `.env.local`:

```
MAILCHIMP_FORM_ACTION=https://XXXXX.usX.list-manage.com/subscribe/post?u=...&id=...
```

**Note:** The current implementation shows a success message without actually POSTing to Mailchimp. To enable real submissions, update `components/home/EmailSignup.tsx`.

#### Buy Me A Coffee

1. Create an account at [Buy Me A Coffee](https://www.buymeacoffee.com/)
2. Copy your profile URL
3. Add to `.env.local`:

```
NEXT_PUBLIC_BUYMEACOFFEE_URL=https://www.buymeacoffee.com/yourname
```

---

## 📁 Project Structure

```
elsebrew/
├── app/
│   ├── about/              # About page
│   ├── api/
│   │   └── reason/         # LLM reasoning API route
│   ├── privacy/            # Privacy policy
│   ├── results/            # Search results page
│   ├── saved/              # Saved cafés page
│   ├── terms/              # Terms of service
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles
├── components/
│   ├── auth/               # Google Sign-In
│   ├── home/               # Home page components
│   ├── results/            # Results page components
│   └── shared/             # Shared components (Header, Footer, etc.)
├── lib/
│   ├── analytics.ts        # Analytics tracking
│   ├── maps-loader.ts      # Google Maps loader
│   ├── places-search.ts    # Café search logic
│   ├── scoring.ts          # Scoring & keyword matching
│   └── storage.ts          # localStorage utilities
├── types/
│   └── index.ts            # TypeScript types
└── public/
    └── images/             # Static images
```

---

## 🎯 How It Works

### Search Flow

1. **User Input:**
   - Source café (Google Places Autocomplete for establishments)
   - Destination city (Google Places Autocomplete for cities)
   - Optional vibe toggles (roastery, light roast, etc.)

2. **Candidate Generation:**
   - Geocode destination city to get center + bounds
   - Build search query from vibe keywords
   - Use Google Places Text Search within destination bounds
   - Fetch top 30 candidates, then detailed info for top 12

3. **Scoring:**
   - Base score: rating + log(review count)
   - Bonus for price level match (±1)
   - Keyword matching (roastery, specialty coffee, etc.)
   - Opening hours overlap (if Night-owl selected)
   - Photo presence bonus
   - Sort by score, take top 8

4. **LLM Reasoning:**
   - For each result, call `/api/reason` with source/candidate data
   - OpenAI generates 1-2 sentence explanation
   - Results cached for 5 minutes

5. **Display:**
   - List view (left) with photo, rating, tags, reasoning
   - Map view (right) with numbered markers
   - Click to open details drawer with embedded Google Maps Place card

### Data Flow

- **Client-side:** Google Maps API calls, autocomplete, map rendering
- **Server-side:** LLM reasoning API route (Edge runtime)
- **Storage:** Saved cafés + user profile in localStorage (no backend database)
- **Analytics:** GA4 or Plausible for event tracking

---

## 🔒 Google Maps Platform Terms Compliance

This app respects Google Maps Platform Terms of Service:

1. **No persistent storage:** Place names, reviews, photos are NOT stored server-side beyond ephemeral caching (5 min for LLM reasoning)
2. **Storing place_id is OK:** We only persist `place_id` in localStorage for saved cafés
3. **Required attributions:** "Powered by Google" shown in footer; embedded maps include Google branding
4. **API key restrictions:** Lock your key to your domain and enable only required APIs
5. **Respect quotas:** Use `fields` parameter to minimize costs; debounce autocomplete

**Cost estimates (as of 2024):**
- Text Search: $32/1000 requests
- Place Details: $17/1000 requests (with minimal fields)
- Map loads: $7/1000 loads
- Autocomplete: $2.83/1000 sessions

For MVP validation with ~100 searches/day: **~$10-20/month**

---

## 📊 Analytics Events

The app tracks these events for validation:

- `view_home` - Home page view
- `click_sign_in` - Google Sign-In clicked
- `search_submit` - Search submitted (includes source, dest, toggles)
- `results_loaded` - Results displayed (includes count, latency)
- `result_click` - Result clicked (includes rank, place_id)
- `result_save_google` - Embedded Save button clicked
- `result_open_gmaps` - "Open in Google Maps" clicked
- `buy_me_coffee_click` - Buy Me A Coffee button clicked
- `email_subscribe_submit` - Email signup submitted
- `cta_upgrade_click` - "Pro coming soon" clicked

View these in GA4 Realtime or your Plausible dashboard.

---

## 🎨 Design System

### Colors

- **Espresso:** `#5B4636` (primary brand color)
- **Espresso Dark:** `#3D2E24` (hover states)
- **Off-white:** `#FAFAF8` (background)
- **Charcoal:** `#2D2D2D` (text)

### Typography

- **Headings:** Georgia serif
- **Body:** System sans-serif
- **Code/mono:** ui-monospace

### Components

- **Buttons:** `.btn-primary`, `.btn-secondary` (rounded-2xl, subtle shadows)
- **Cards:** `.card` (white bg, rounded-2xl, hover shadow)
- **Inputs:** `.input-field` (rounded-xl, focus ring)

### Micro-interactions

- Framer Motion used for:
  - Page transitions
  - Card hover states
  - Drawer slide-in
  - Staggered list animations

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

**Important:** Update your Google Maps API key restrictions to include your Vercel domain.

### Other Platforms

This is a standard Next.js 14 app and can be deployed to:
- Netlify
- AWS Amplify
- Cloudflare Pages
- Any Node.js hosting

---

## 🛠️ Development

### Run locally

```bash
npm run dev
```

### Build for production

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

---

## 🔧 Customization

### Change LLM Provider

To use a different LLM (e.g., Claude, Gemini):

1. Update `app/api/reason/route.ts`
2. Swap OpenAI client for your provider's SDK
3. Adjust prompt template as needed
4. Update `.env.local` with new API key

### Customize Vibe Toggles

Edit `components/home/SearchPanel.tsx` - `vibeOptions` array:

```typescript
const vibeOptions = [
  { key: 'roastery', label: 'Roastery', icon: '🔥' },
  // Add your own toggles here
];
```

Then update `lib/scoring.ts` - `buildSearchKeywords()` to add corresponding keywords.

### Adjust Scoring Algorithm

Edit `lib/scoring.ts` - `scoreCafe()` function to tweak weights:

```typescript
// Example: increase roastery bonus from +2 to +5
if (vibes.roastery && combinedText.includes('roast')) {
  score += 5; // was 2
  matchedKeywords.push('Roastery');
}
```

---

## 📝 Notes on Fake-Door MVP

This is a **validation project**. The core functionality is real (live Google Maps results, working map, AI reasoning), but it's designed to:

1. **Test product-market fit** - Do people actually want this?
2. **Capture demand signals** - Email signups, Buy Me A Coffee clicks
3. **Validate pricing assumptions** - "Pro coming soon" clicks
4. **Stay lean** - No backend database, minimal infra costs

**What's real:**
- Google Maps search and results
- Interactive map with markers
- LLM-generated explanations
- Save to Google Maps (via embedded Place card)
- Analytics tracking

**What's fake-door:**
- Pro tier (button does nothing, just tracks clicks)
- Email signup (shows success but doesn't actually POST to Mailchimp by default)
- No user accounts (localStorage only)
- No backend database

---

## 🐛 Troubleshooting

### Production Deployment Issues (AWS Amplify)

**"Something went wrong - Failed to get source place details"**

This is a common issue when deploying to AWS Amplify. See the comprehensive guide:

📖 **[docs/DEPLOYMENT_TROUBLESHOOTING.md](docs/DEPLOYMENT_TROUBLESHOOTING.md)**

Quick fixes:
1. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in AWS Amplify environment variables
2. Add your Amplify domain to Google Maps API key restrictions:
   - Use `https://*.YOUR_APP_ID.amplifyapp.com/*` (e.g., `https://*.d1a2b3c4d5e6.amplifyapp.com/*`)
   - ⚠️ Don't use `https://*.amplifyapp.com/*` - that's too permissive!
3. Redeploy after changing environment variables

### Local Development Issues

#### Maps not loading

- Check `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`
- Verify APIs are enabled in Google Cloud Console
- Check browser console for errors
- Ensure API key restrictions include `http://localhost:3000/*`

#### 401 Unauthorized errors

- **Fixed:** Token expiration handling updated to allow 24-hour grace period
- If you still see 401 errors, try signing out and signing in again
- Check browser console for `[Auth]` log messages

#### Autocomplete not working

- Verify Places API is enabled
- Check API key restrictions
- Open browser console and look for 403/API key errors

#### LLM reasoning not appearing

- Check `OPENAI_API_KEY` in `.env.local`
- Verify you have credits in your OpenAI account
- Check `/api/reason` route logs in terminal

#### Sign-in button not showing

- Check `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` in `.env.local`
- Verify authorized origins in OAuth consent screen
- Check browser console for errors

### Need More Help?

See [docs/DEPLOYMENT_TROUBLESHOOTING.md](docs/DEPLOYMENT_TROUBLESHOOTING.md) for detailed debugging steps, error message reference, and AWS-specific solutions.

---

## 📄 License

MIT License - feel free to use this as a template for your own projects.

---

## 💬 Feedback

This is a validation project! We'd love your feedback:

- ⭐ Star this repo if you find it useful
- 🐛 Open an issue for bugs
- 💡 Submit feature requests
- ☕ Buy us a coffee to support development

---

**Made with ❤️ by Elsebrew • Powered by Google**
