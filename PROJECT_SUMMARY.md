# Elsebrew - Project Summary

## What We Built

A complete **fake-door MVP** for Elsebrew - a café discovery tool that finds coffee shops in destination cities matching the vibe of a user's favorite local spot.

## ✅ Acceptance Criteria Met

All requirements from the original spec have been implemented:

### Core Functionality
- ✅ Source café input with Google Places Autocomplete
- ✅ Destination city/country input with Google Places Autocomplete
- ✅ Vibe toggles (6 options: roastery, light-roast, laptop-friendly, night-owl, cozy, minimalist)
- ✅ Real Google Maps results (Text Search + Place Details)
- ✅ Interactive map with numbered markers (list ↔ map sync)
- ✅ LLM-generated match explanations (OpenAI GPT-4o-mini)
- ✅ Details drawer with embedded Place card for native "Save to Google Maps"
- ✅ Custom scoring algorithm (rating, price match, keywords, hours, photos)

### Auth & Personalization
- ✅ Google Sign-In (Google Identity Services)
- ✅ Client-side saved cafés (localStorage)
- ✅ /saved page with saved café list

### Analytics & Validation
- ✅ GA4/Plausible integration
- ✅ 10 analytics events tracked (search_submit, results_loaded, etc.)
- ✅ Email signup form (Mailchimp-ready)
- ✅ Buy Me A Coffee button
- ✅ "Pro coming soon" fake door (tracks clicks)

### Design & UX
- ✅ Premium, minimal design (no default Tailwind vibes)
- ✅ Custom color palette (espresso, off-white, charcoal)
- ✅ Framer Motion micro-interactions
- ✅ Responsive (desktop + mobile)
- ✅ Accessibility (semantic HTML, ARIA labels)

### Compliance & Terms
- ✅ Google Maps Terms compliant (no persistent storage, attributions shown)
- ✅ Privacy Policy page
- ✅ Terms of Service page
- ✅ About page

## 📁 What's Included

```
elsebrew/
├── README.md                    # Full documentation
├── QUICKSTART.md                # 10-minute setup guide
├── SETUP_GUIDE.md               # Detailed API key setup
├── ARCHITECTURE.md              # Technical architecture
├── PROJECT_SUMMARY.md           # This file
├── check-env.js                 # Environment validation script
├── .env.example                 # Environment template
├── .env.local                   # Your API keys (git-ignored)
│
├── app/                         # Next.js 14 App Router
│   ├── page.tsx                 # Home page
│   ├── results/page.tsx         # Search results
│   ├── saved/page.tsx           # Saved cafés
│   ├── about/page.tsx           # About
│   ├── privacy/page.tsx         # Privacy policy
│   ├── terms/page.tsx           # Terms of service
│   └── api/reason/route.ts      # LLM reasoning API
│
├── components/
│   ├── home/                    # Search panel, email signup, pricing
│   ├── results/                 # Results list, map, details drawer
│   ├── shared/                  # Header, footer, analytics
│   └── auth/                    # Google Sign-In
│
├── lib/
│   ├── analytics.ts             # GA4/Plausible tracking
│   ├── maps-loader.ts           # Google Maps loader
│   ├── places-search.ts         # Café search logic
│   ├── scoring.ts               # Scoring algorithm
│   └── storage.ts               # localStorage helpers
│
└── types/
    └── index.ts                 # TypeScript definitions
```

## 🔑 API Keys Needed

You need to configure 3 API keys in `.env.local`:

1. **Google Maps API Key** (required)
   - Enables Maps, Places, Geocoding, Embed APIs
   - Free: $200/month credit (~2000 searches)

2. **Google OAuth Client ID** (required)
   - Enables Sign in with Google
   - Free (unlimited)

3. **OpenAI API Key** (required)
   - Powers LLM match explanations
   - Cost: ~$0.0001 per café match

**Optional:**
- GA4 Measurement ID (analytics)
- Mailchimp Form Action (email signups)
- Buy Me A Coffee URL (support button)

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Edit .env.local with your API keys

# 3. Verify
npm run check-env

# 4. Run
npm run dev
```

See [QUICKSTART.md](./QUICKSTART.md) for detailed steps.

## 💰 Cost Estimates

For **100 searches/day** (MVP validation):

- **Google Maps:** ~$10-20/month
- **OpenAI:** ~$0.50-1/month
- **Total:** ~$10-25/month

**Free tier available:**
- Google Maps: $200/month credit (covers ~2000 searches)
- OpenAI: Pay-as-you-go (but very cheap with gpt-4o-mini)

## 🎯 How It Works

1. **User searches** for source café (e.g., "Blue Bottle Oakland") + destination (e.g., "Tokyo")
2. **App geocodes** destination city to get center + bounds
3. **Google Places Text Search** finds cafés within bounds matching keywords
4. **Scoring algorithm** ranks by rating, price match, keywords, vibe toggles
5. **Place Details** fetched for top 12 candidates
6. **OpenAI LLM** generates 1-2 sentence explanation for each match
7. **Results displayed** on interactive map + list
8. **User clicks** a result → details drawer with embedded Place card
9. **User saves** to Google Maps (native button) or Elsebrew list (localStorage)

## 📊 Analytics Dashboard

Track these metrics in GA4:

- **Funnel:**
  - `view_home` → `search_submit` → `results_loaded` → `result_click`
- **Engagement:**
  - `result_save_google`, `result_open_gmaps`
- **Validation:**
  - `email_subscribe_submit` (interest)
  - `cta_upgrade_click` (willingness to pay)
  - `buy_me_coffee_click` (support)

## 🔒 Security & Compliance

- ✅ API keys restricted (domain + API whitelist)
- ✅ No server-side storage of Places content (ToS compliant)
- ✅ Privacy policy provided
- ✅ User data minimized (localStorage only)
- ✅ HTTPS enforced in production

## 🎨 Design Philosophy

**Premium coffee shop aesthetic:**
- Muted earth tones (espresso brown, off-white)
- Clean serif headings (Georgia)
- Generous whitespace
- Subtle shadows and hover states
- No gradients, no neon colors

**Micro-interactions:**
- Smooth page transitions
- Card hover effects
- Drawer slide-ins
- Staggered list animations

## 🚧 Known Limitations (MVP)

These are intentional trade-offs for a validation MVP:

- **No backend database** - everything in localStorage
- **No sync across devices** - saved cafés are local
- **Simple scoring** - heuristic-based, not ML
- **English-only** - no internationalization
- **No rate limiting** - relies on API quotas
- **Email signup doesn't POST** - shows success message only

## 🔮 Next Steps (Post-Validation)

If validation succeeds (signups, engagement, feedback):

1. **Add backend** (Supabase/Firebase)
2. **Implement Stripe** for Pro tier
3. **Build mobile app** (React Native)
4. **ML-based scoring** (embeddings, collaborative filtering)
5. **Social features** (share trips, reviews)
6. **Offline maps** (cached cafés)
7. **Advanced filters** (dietary, accessibility)
8. **Internationalization** (multi-language)

## 📚 Documentation Index

- **[README.md](./README.md)** - Complete technical documentation
- **[QUICKSTART.md](./QUICKSTART.md)** - Get running in 10 minutes
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Detailed API key setup
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical architecture & data flow

## 🛠️ Customization Guide

### Change Colors
Edit `tailwind.config.ts`:
```typescript
colors: {
  espresso: {
    DEFAULT: '#5B4636', // Your color here
  },
}
```

### Add Vibe Toggles
Edit `components/home/SearchPanel.tsx`:
```typescript
const vibeOptions = [
  { key: 'myNewVibe', label: 'My Vibe', icon: '🎨' },
];
```

Then update `lib/scoring.ts` to add keywords.

### Adjust Scoring
Edit `lib/scoring.ts` - `scoreCafe()`:
```typescript
if (vibes.roastery && combinedText.includes('roast')) {
  score += 5; // Increase from 2 to 5
}
```

### Swap LLM Provider
Edit `app/api/reason/route.ts`:
- Replace OpenAI client with your provider
- Update prompt template
- Change `OPENAI_API_KEY` in `.env.local`

## 🤝 Contributing

This is a validation MVP, but contributions welcome:

1. Fork the repo
2. Create a feature branch
3. Submit a PR with clear description
4. Ensure `npm run build` passes

## 📄 License

MIT License - use freely for your own projects.

## 🙏 Credits

Built with:
- [Next.js](https://nextjs.org/) - React framework
- [Google Maps Platform](https://developers.google.com/maps) - Maps & Places
- [OpenAI](https://openai.com/) - LLM reasoning
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Framer Motion](https://www.framer.com/motion/) - Animations

## 📞 Support

- 📖 **Docs:** See README.md
- 🐛 **Issues:** Open a GitHub issue
- 💬 **Questions:** Check SETUP_GUIDE.md
- ☕ **Support:** Buy me a coffee (see app footer)

---

**Happy café hunting!** ☕✨
