# PayPal Integration Step-by-Step Guide

This guide will walk you through integrating PayPal subscriptions into your Elsebrew application.

## Prerequisites

- A PayPal Business account (or upgrade your personal account to Business)
- Access to PayPal Developer Dashboard
- Your application deployed or running locally

## Step 1: Create PayPal App and Get Credentials

### 1.1 Access PayPal Developer Dashboard

1. Go to [https://developer.paypal.com/](https://developer.paypal.com/)
2. Log in with your PayPal Business account
3. Navigate to **Dashboard** → **My Apps & Credentials**

### 1.2 Create a New App

1. Click **Create App** button
2. Fill in the details:
   - **App Name**: `Elsebrew` (or your preferred name)
   - **Merchant**: Select your business account
   - **Features**: Select **Subscriptions** (this is important!)
3. Click **Create App**

### 1.3 Get Your Credentials

After creating the app, you'll see:
- **Client ID** (starts with something like `Ae...`)
- **Secret** (click **Show** to reveal it)

**IMPORTANT**: 
- For testing, use **Sandbox** credentials
- For production, use **Live** credentials
- Copy these values - you'll need them for environment variables

## Step 2: Create a Subscription Plan

PayPal no longer provides a dashboard UI for creating products and plans. You need to use the **Catalog Products API** to create them programmatically.

### Option A: Use the Helper Script (Recommended)

We've created a script to automate this process:

1. **Set up your environment variables first:**
   ```bash
   # In .env.local
   PAYPAL_CLIENT_ID=your_client_id
   PAYPAL_CLIENT_SECRET=your_secret
   PAYPAL_ENVIRONMENT=sandbox
   ```

2. **Run the script:**
   ```bash
   tsx scripts/create-paypal-plan.ts
   ```

3. **The script will:**
   - Create a product called "Elsebrew Premium"
   - Create a monthly billing plan for $5.00
   - Output the Plan ID (starts with `P-...`)
   - Tell you what to add to your `.env.local`

### Option B: Use PayPal API Directly

If you prefer to use the API directly, see the [Catalog Products API documentation](https://developer.paypal.com/docs/api/catalog-products/v1/).

**Create Product:**
```bash
curl -X POST https://api.sandbox.paypal.com/v1/catalogs/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Elsebrew Premium",
    "description": "Premium subscription for Elsebrew",
    "type": "SERVICE",
    "category": "SOFTWARE"
  }'
```

**Create Plan:**
Use the Subscriptions API to create a billing plan linked to your product. See [PayPal Subscriptions API](https://developer.paypal.com/docs/api/subscriptions/v1/) for details.

### 2.4 Save Your Plan ID

After creating the plan (via script or API), copy the **Plan ID** (starts with `P-...`) and save it for `PAYPAL_PLAN_ID` in your environment variables.

## Step 3: Set Up Webhooks

### 3.1 Create Webhook

1. In PayPal Developer Dashboard, go to **My Apps & Credentials**
2. Click on your app
3. Scroll to **Webhooks** section
4. Click **Add Webhook**

### 3.2 Configure Webhook

1. **Webhook URL**: 
   - For local testing: Use a tool like [ngrok](https://ngrok.com/) to expose your local server
   - Example: `https://your-ngrok-url.ngrok.io/api/stripe/webhook`
   - For production: `https://yourdomain.com/api/stripe/webhook`
2. **Event Types**: Select these events:
   - `BILLING.SUBSCRIPTION.CREATED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.UPDATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
3. Click **Save**

### 3.3 Get Webhook ID

After creating the webhook:
1. Click on the webhook
2. Copy the **Webhook ID** (you'll see it in the URL or details)
3. Save this for `PAYPAL_WEBHOOK_ID`

## Step 4: Configure Environment Variables

### 4.1 Local Development (.env.local)

Create or update `.env.local` in your project root:

```bash
# PayPal Configuration
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_secret_here
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_PLAN_ID=P-your_plan_id_here
PAYPAL_WEBHOOK_ID=your_webhook_id_here

# URLs (update with your actual domain)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
PAYPAL_SUCCESS_URL=http://localhost:3000/settings?session_id={CHECKOUT_SESSION_ID}
PAYPAL_CANCEL_URL=http://localhost:3000/settings
PAYPAL_WEBHOOK_URL=http://localhost:3000/api/stripe/webhook
```

### 4.2 Production Environment

For production (Vercel, AWS Amplify, etc.):

1. Go to your hosting platform's environment variables settings
2. Add the same variables but with:
   - **Live** credentials (not sandbox)
   - `PAYPAL_ENVIRONMENT=production`
   - Production URLs (your actual domain)

## Step 5: Create DynamoDB Subscriptions Table

### 5.1 Create the Subscriptions Table

First, you need to create the subscriptions table if it doesn't exist:

**Option A: Use the Helper Script (Recommended)**

Run the table creation script which will create the subscriptions table with all necessary indexes:

```bash
npm run create-tables
```

This will create the `elsebrew-subscriptions` table with:
- Primary key: `userId` (String)
- GSI: `paypalSubscriptionId-index` (for PayPal subscriptions)
- GSI: `stripeCustomerId-index` (for backward compatibility with Stripe)

**Option B: Create Table Manually**

If you prefer to create it manually or the script doesn't include it yet:

**Using AWS Console:**
1. Go to DynamoDB → Tables → `subscriptions`
2. Click **Indexes** tab
3. Click **Create index**
4. Configure:
   - **Partition key**: `paypalSubscriptionId` (String)
   - **Index name**: `paypalSubscriptionId-index`
5. Click **Create index**

**Using AWS CLI:**
```bash
aws dynamodb update-table \
  --table-name subscriptions \
  --attribute-definitions AttributeName=paypalSubscriptionId,AttributeType=S \
  --global-secondary-index-updates \
    "[{
      \"Create\": {
        \"IndexName\": \"paypalSubscriptionId-index\",
        \"KeySchema\": [{\"AttributeName\": \"paypalSubscriptionId\", \"KeyType\": \"HASH\"}],
        \"Projection\": {\"ProjectionType\": \"ALL\"},
        \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 1, \"WriteCapacityUnits\": 1}
      }
    }]"
```

## Step 6: Test the Integration

### 6.1 Local Testing Setup

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Expose local server for webhook testing:**
   ```bash
   # Install ngrok if you haven't
   npm install -g ngrok
   
   # Expose port 3000
   ngrok http 3000
   ```
   
3. **Update webhook URL in PayPal:**
   - Use the ngrok URL: `https://your-ngrok-url.ngrok.io/api/stripe/webhook`
   - Update it in PayPal Developer Dashboard

### 6.2 Test Subscription Flow

1. **Sign in to your app**
2. **Click "Upgrade to Premium"** (or navigate to pricing)
3. **Click "Upgrade to Premium" button**
4. **You should be redirected to PayPal:**
   - In sandbox, use test PayPal account
   - Complete the payment flow
5. **After approval, you'll be redirected back** to `/settings?session_id=...`
6. **Check your subscription status** in the settings page

### 6.3 Verify Webhook Events

1. In PayPal Developer Dashboard → **Webhooks**
2. Click on your webhook
3. View **Event Logs** to see incoming events
4. Check your server logs for webhook processing

## Step 7: Production Checklist

Before going live:

- [ ] Switch to **Live** credentials in production environment
- [ ] Set `PAYPAL_ENVIRONMENT=production`
- [ ] Update all URLs to production domain
- [ ] Update webhook URL in PayPal to production URL
- [ ] Test with real PayPal account (small amount)
- [ ] Verify webhook events are being received
- [ ] Test subscription cancellation flow
- [ ] Test subscription renewal

## Troubleshooting

### Common Issues

**1. "Failed to create PayPal subscription"**
- Check that `PAYPAL_PLAN_ID` is correct
- Verify plan is active in PayPal dashboard
- Check credentials are correct

**2. Webhooks not receiving events**
- Verify webhook URL is accessible (use ngrok for local)
- Check webhook is enabled in PayPal dashboard
- Verify webhook events are subscribed

**3. Subscription not activating after payment**
- Check webhook logs in PayPal dashboard
- Verify webhook handler is processing events correctly
- Check server logs for errors

**4. "User not found for subscription"**
- Verify DynamoDB GSI `paypalSubscriptionId-index` exists
- Check that `customId` is being set correctly in subscription creation

## Support Resources

- [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- [PayPal Subscriptions API](https://developer.paypal.com/docs/subscriptions/)
- [PayPal Webhooks Guide](https://developer.paypal.com/docs/api-basics/notifications/webhooks/)

## Next Steps

After successful integration:
1. Monitor webhook events
2. Set up error alerts
3. Test edge cases (cancellations, renewals, failures)
4. Consider adding subscription management UI improvements

