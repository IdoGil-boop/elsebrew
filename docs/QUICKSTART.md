# Elsebrew - Quick Start

Get Elsebrew running in 10 minutes.

## 1. Install Dependencies

```bash
npm install
```

## 2. Get Your API Keys

You need 3 API keys (all free to start):

### Google Maps API Key
1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create project → Enable APIs: Maps JavaScript, Places, Geocoding, Maps Embed
3. Create API Key → Restrict to those 4 APIs + add `http://localhost:3000/*` as allowed referrer

### Google OAuth Client ID
1. Same console → Create OAuth 2.0 Client ID
2. Web application → Add `http://localhost:3000` as authorized origin

### OpenAI API Key
1. Go to [platform.openai.com](https://platform.openai.com/)
2. Create API key → Add credits (~$5 is plenty for testing)

## 3. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local - add your 3 API keys
```

## 4. Verify Setup

```bash
npm run check-env
```

Should show ✅ for all required variables.

## 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 6. Test

1. Type a café name (e.g., "Blue Bottle Oakland")
2. Type a city (e.g., "Tokyo, Japan")
3. Click "Find my twins"
4. See results on map!

---

**Need help?** See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed instructions.

**Cost?** ~$10-20/month for ~100 searches/day. Free tier available.
