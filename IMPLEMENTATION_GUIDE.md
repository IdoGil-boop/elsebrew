# Freemium Model Implementation Guide

## ✅ Completed Implementation

The freemium model with premium vibes has been successfully implemented! Here's what's been done:

### Phase 1: Backend Infrastructure ✅

1. **Subscription Types** ([types/index.ts](types/index.ts))
   - Added `SubscriptionTier` type ('free' | 'premium')
   - Added `SubscriptionInfo` interface
   - Updated `UserProfile` to include subscription

2. **Stripe Integration**
   - Created [lib/stripe.ts](lib/stripe.ts) - Stripe client initialization
   - Created [lib/subscription.ts](lib/subscription.ts) - Subscription management utilities
   - Created API routes:
     - [app/api/stripe/create-checkout/route.ts](app/api/stripe/create-checkout/route.ts) - Create checkout sessions
     - [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts) - Handle Stripe events
     - [app/api/stripe/customer-portal/route.ts](app/api/stripe/customer-portal/route.ts) - Manage billing

3. **DynamoDB Schema** ([lib/dynamodb.ts](lib/dynamodb.ts))
   - Added `SUBSCRIPTIONS` table
   - Added `getUserSubscription()` function
   - Added `updateUserSubscription()` function
   - Added `queryUserByStripeCustomerId()` function
   - Updated `getRateLimitConfig()` to support tiers

4. **Rate Limiting** ([app/api/rate-limit/check/route.ts](app/api/rate-limit/check/route.ts))
   - Free users: 10 searches / 12 hours
   - Premium users: Unlimited searches

### Phase 2: Vibe System ✅

1. **Vibe Definitions** ([lib/vibes.ts](lib/vibes.ts))
   - **40+ comprehensive vibes** across 6 categories:
     - **Coffee Specialty** (10): roastery, lightRoast, singleOrigin, pourOver, coldBrew, nitro, etc.
     - **Ambiance** (6): cozy, minimalist, outdoorSeating, liveMusic, sportsFriendly, instagrammable
     - **Food & Drink** (10): brunch, servesBreakfast, oatMilk, bakedGoods, servesWine, etc.
     - **Amenities** (11): laptopFriendly, allowsDogs, takeout, delivery, parking, etc.
     - **Accessibility** (1): accessibleFriendly
     - **Timing** (1): nightOwl

2. **Vibe Features**
   - Google field mappings for 30+ vibes
   - Custom query keywords for non-Google vibes (oat milk, single origin, etc.)
   - Helper functions for filtering, searching, and categorization

3. **Recommended Vibes** ([lib/recommendedVibes.ts](lib/recommendedVibes.ts))
   - Analyzes source cafes' atmosphere fields
   - Suggests top 3 matching vibes

### Phase 3: UI Components ✅

1. **Vibe Selector Modal** ([components/home/VibeSelector.tsx](components/home/VibeSelector.tsx))
   - Searchable interface
   - Category tabs (Coffee Specialty, Ambiance, Food & Drink, etc.)
   - Recommended vibes section (top 3 based on source cafes)
   - Premium lock overlay for free users
   - Grid layout with icons and descriptions

2. **Pricing Modal** ([components/home/PricingModal.tsx](components/home/PricingModal.tsx))
   - Free vs Premium comparison
   - Stripe checkout integration
   - Feature breakdown
   - $5/month pricing

3. **Account Settings Page** ([app/settings/page.tsx](app/settings/page.tsx))
   - View subscription status
   - Manage billing (Stripe customer portal)
   - Sign out
   - Upgrade to premium

### Phase 4: Search Flow Gating ✅

1. **Cost Optimization** ([lib/places-search.ts](lib/places-search.ts#L242))
   - Removed `editorialSummary` from basic fetch
   - Saves money: **Enterprise tier** instead of **Enterprise + Atmosphere**

2. **Premium Field Gating** ([app/api/google/places/details/route.ts](app/api/google/places/details/route.ts))
   - Free users: Basic search only (no atmosphere fields)
   - Premium users: Full atmosphere fields (outdoor seating, serves coffee, allows dogs, etc.)

---

## 🚧 Remaining Integration Tasks

### 1. Update SearchPanel Component

**File:** [components/home/SearchPanel.tsx](components/home/SearchPanel.tsx)

#### Changes Needed:

1. **Import new components** (add to top of file):
```typescript
import VibeSelector from './VibeSelector';
import PricingModal from './PricingModal';
import { getUserSubscription } from '@/lib/subscription';
import { getRecommendedVibes } from '@/lib/recommendedVibes';
```

2. **Add state for premium features**:
```typescript
const [isPremium, setIsPremium] = useState(false);
const [showPricingModal, setShowPricingModal] = useState(false);
const [recommendedVibeIds, setRecommendedVibeIds] = useState<string[]>([]);
```

3. **Fetch subscription on mount** (in `useEffect`):
```typescript
useEffect(() => {
  const checkSubscription = async () => {
    const userProfile = storage.getUserProfile();
    if (userProfile) {
      const subscription = await getUserSubscription(userProfile.sub);
      setIsPremium(subscription.tier === 'premium');
    }
  };
  checkSubscription();
}, []);
```

4. **Fetch recommended vibes when source cafes change**:
```typescript
useEffect(() => {
  const fetchRecommendedVibes = async () => {
    if (sourcePlaces.length > 0 && isPremium) {
      // Fetch advanced fields for source cafes
      const placeIds = sourcePlaces.map(p => p.place_id).filter(Boolean);
      // ... fetch advanced fields via API
      // const recommended = await getRecommendedVibes(sourcePlacesWithFields);
      // setRecommendedVibeIds(recommended);
    }
  };
  fetchRecommendedVibes();
}, [sourcePlaces, isPremium]);
```

5. **Replace old vibe dropdown** (lines ~374-426) with:
```typescript
<VibeSelector
  selectedVibes={vibes}
  onVibesChange={setVibes}
  recommendedVibeIds={recommendedVibeIds}
  isPremium={isPremium}
  onUpgradeClick={() => setShowPricingModal(true)}
/>
```

6. **Add pricing modal** (at end of component):
```typescript
<PricingModal
  isOpen={showPricingModal}
  onClose={() => setShowPricingModal(false)}
  source="vibe-selector"
/>
```

7. **Update vibe handling** - Change from old `VibeToggles` interface to dynamic object:
```typescript
// OLD:
const [vibes, setVibes] = useState<VibeToggles>({
  roastery: false,
  lightRoast: false,
  // ... 9 hardcoded vibes
});

// NEW:
const [vibes, setVibes] = useState<Record<string, boolean>>({});
```

### 2. Update Query Construction

**File:** [lib/places-search.ts](lib/places-search.ts)

Replace `buildVibeEnhancedQuery()` function (lines ~96-138) to use new vibe system:

```typescript
import { buildVibeQueryKeywords } from './vibes';

function buildVibeEnhancedQuery(baseKeywords: string[], vibes: Record<string, boolean>): string {
  // Get keywords from selected vibes
  const vibeKeywords = buildVibeQueryKeywords(vibes);

  // Combine base keywords with vibe keywords (limit to 5 total)
  const allKeywords = [
    ...baseKeywords.slice(0, 2),
    ...vibeKeywords.slice(0, 3)
  ];

  return allKeywords.slice(0, 5).join(' ');
}
```

### 3. Update Field Selection

**File:** [lib/googlePlaceFields.ts](lib/googlePlaceFields.ts)

Update `getRelevantFields()` function (lines ~37-151) to use new vibe system:

```typescript
import { getVibeFieldsToFetch } from './vibes';

export function getRelevantFields(
  vibes: Record<string, boolean>,
  keywords: string[] = [],
  freeText: string = ''
): AdvancedPlaceField[] {
  const relevantFields = new Set<AdvancedPlaceField>();

  // Always fetch essential fields
  relevantFields.add('servesCoffee');
  relevantFields.add('outdoorSeating');

  // Get fields from selected vibes
  const vibeFields = getVibeFieldsToFetch(vibes);
  vibeFields.forEach(field => relevantFields.add(field));

  // ... keep existing query text analysis logic ...

  return Array.from(relevantFields);
}
```

### 4. Update Scoring

**File:** [lib/scoring.ts](lib/scoring.ts)

Update vibe scoring section (lines ~193-206) to handle dynamic vibes:

```typescript
import { getVibeById } from './vibes';

// Score based on vibe matches
Object.keys(vibes).forEach(vibeId => {
  if (!vibes[vibeId]) return; // Skip unselected vibes

  const vibeDef = getVibeById(vibeId);
  if (!vibeDef?.googleField) return;

  const fieldValue = candidate[vibeDef.googleField];
  if (fieldValue === true) {
    score += 1.5;
    matchedKeywords.push(vibeDef.label);
  }
});
```

### 5. Update Types

**File:** [types/index.ts](types/index.ts)

Update `VibeToggles` to be more flexible (or deprecate it):

```typescript
// Option 1: Make it flexible
export type VibeToggles = Record<string, boolean>;

// Option 2: Keep for backward compatibility, add new type
export type DynamicVibes = Record<string, boolean>;
```

### 6. Add Analytics Tracking

**File:** [lib/analytics.ts](lib/analytics.ts)

Add new events:

```typescript
export const analytics = {
  // ... existing events ...

  subscriptionStarted: (userId: string, tier: string) => {
    trackEvent('subscription_started', { userId, tier });
  },

  subscriptionCancelled: (userId: string) => {
    trackEvent('subscription_cancelled', { userId });
  },

  premiumVibeClicked: (vibeId: string, isLocked: boolean) => {
    trackEvent('premium_vibe_clicked', { vibeId, isLocked });
  },

  upgradeModalShown: (source: string) => {
    trackEvent('upgrade_modal_shown', { source });
  },
};
```

---

## 📋 Environment Variables Setup

Add to `.env.local`:

```bash
# Stripe (Get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🗄️ Database Setup

### Create DynamoDB Subscriptions Table

**Table Name:** `elsebrew-subscriptions`

**Primary Key:**
- Partition Key: `userId` (String)

**Global Secondary Index (GSI):**
- Index Name: `stripeCustomerId-index`
- Partition Key: `stripeCustomerId` (String)

**Attributes:**
- `userId` (String) - Google user ID
- `tier` (String) - 'free' or 'premium'
- `stripeCustomerId` (String) - Stripe customer ID
- `stripeSubscriptionId` (String) - Stripe subscription ID
- `currentPeriodEnd` (String) - ISO timestamp
- `cancelAtPeriodEnd` (Boolean)
- `createdAt` (String) - ISO timestamp
- `updatedAt` (String) - ISO timestamp

### AWS CLI Command:

```bash
aws dynamodb create-table \
  --table-name elsebrew-subscriptions \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=stripeCustomerId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=stripeCustomerId-index,KeySchema=[{AttributeName=stripeCustomerId,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=1,WriteCapacityUnits=1}" \
  --provisioned-throughput \
    ReadCapacityUnits=1,WriteCapacityUnits=1
```

---

## 🎯 Stripe Setup

### 1. Create Product & Price

1. Go to https://dashboard.stripe.com/products
2. Click "Add product"
3. Name: "Elsebrew Premium"
4. Description: "Unlimited searches + 40+ vibe filters"
5. Pricing: $5.00 / month (recurring)
6. Copy the Price ID (starts with `price_...`)

### 2. Set Up Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the Webhook signing secret (starts with `whsec_...`)

---

## 🧪 Testing Checklist

### Free User Flow:
- [ ] Can sign in with Google
- [ ] Can search with basic text search
- [ ] Rate limited to 10 searches / 12 hours
- [ ] Vibes show lock icon
- [ ] Clicking vibe opens upgrade modal
- [ ] No atmosphere fields in results

### Premium User Flow:
- [ ] Can upgrade via Stripe checkout
- [ ] Receives welcome message after payment
- [ ] Can select all 40+ vibes
- [ ] Sees recommended vibes (top 3)
- [ ] Unlimited searches (no rate limit)
- [ ] Full atmosphere fields in results
- [ ] Can manage billing via customer portal

### Subscription Flow:
- [ ] Checkout session redirects to Stripe
- [ ] Webhook updates subscription status
- [ ] User tier changes from free to premium
- [ ] Can cancel subscription
- [ ] Cancelled users revert to free tier

---

## 🚀 Deployment Notes

1. **Stripe Test Mode:** Use test keys (`sk_test_...`, `pk_test_...`) for development
2. **Stripe Live Mode:** Switch to live keys when going to production
3. **Webhook Endpoint:** Must be HTTPS in production
4. **DynamoDB:** Ensure IAM permissions allow read/write to subscriptions table
5. **Environment Variables:** Set all Stripe variables in production environment (Vercel, AWS Amplify, etc.)

---

## 💰 Cost Analysis

### Before (All Users):
- Every search = **Enterprise + Atmosphere tier**
- Every advanced field fetch = **Enterprise + Atmosphere tier**

### After:
- **Free users:**
  - Basic search = **Enterprise tier** (no editorialSummary)
  - No advanced fields = **$0 atmosphere costs**
- **Premium users ($5/month):**
  - Full search = **Enterprise + Atmosphere tier**
  - Revenue offsets API costs

**Expected savings:** ~30-40% reduction in Google API costs for free tier users

---

## 📚 Key Files Reference

### Backend:
- [lib/stripe.ts](lib/stripe.ts) - Stripe client
- [lib/subscription.ts](lib/subscription.ts) - Subscription utilities
- [lib/dynamodb.ts](lib/dynamodb.ts) - Database functions
- [lib/vibes.ts](lib/vibes.ts) - Vibe definitions
- [lib/recommendedVibes.ts](lib/recommendedVibes.ts) - Recommendation logic

### API Routes:
- [app/api/stripe/create-checkout/route.ts](app/api/stripe/create-checkout/route.ts)
- [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts)
- [app/api/stripe/customer-portal/route.ts](app/api/stripe/customer-portal/route.ts)
- [app/api/google/places/details/route.ts](app/api/google/places/details/route.ts)
- [app/api/rate-limit/check/route.ts](app/api/rate-limit/check/route.ts)

### UI Components:
- [components/home/VibeSelector.tsx](components/home/VibeSelector.tsx)
- [components/home/PricingModal.tsx](components/home/PricingModal.tsx)
- [app/settings/page.tsx](app/settings/page.tsx)

### To Update:
- [components/home/SearchPanel.tsx](components/home/SearchPanel.tsx)
- [lib/places-search.ts](lib/places-search.ts)
- [lib/googlePlaceFields.ts](lib/googlePlaceFields.ts)
- [lib/scoring.ts](lib/scoring.ts)
- [lib/analytics.ts](lib/analytics.ts)
