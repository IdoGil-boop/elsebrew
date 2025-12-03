# PayPal Integration - Quick Start

## 🚀 Quick Setup (5 minutes)

### Step 1: Get PayPal Credentials (2 min)

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard)
2. Log in with your PayPal Business account
3. Click **My Apps & Credentials** → **Create App**
4. Name it "Elsebrew", select **Subscriptions** feature
5. Copy **Client ID** and **Secret** (click Show for secret)

### Step 2: Create Subscription Plan (2 min)

**Use the helper script** (easiest way):

1. Make sure you have `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env.local`
2. Run:
   ```bash
   tsx scripts/create-paypal-plan.ts
   ```
3. The script will create the product and plan, then output the **Plan ID**

**Or use the API directly:**
- See [Catalog Products API](https://developer.paypal.com/docs/api/catalog-products/v1/)
- See [docs/PAYPAL_INTEGRATION.md](docs/PAYPAL_INTEGRATION.md) for detailed instructions

### Step 3: Set Up Webhook (1 min)

1. In your app settings, scroll to **Webhooks**
2. Click **Add Webhook**
3. URL: `https://yourdomain.com/api/stripe/webhook` (or use ngrok for local)
4. Select events:
   - `BILLING.SUBSCRIPTION.CREATED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.UPDATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
5. Copy the **Webhook ID**

### Step 4: Add Environment Variables

Create `.env.local`:

```bash
# PayPal Sandbox (for testing)
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_secret_here
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_PLAN_ID=P-your_plan_id_here
PAYPAL_WEBHOOK_ID=your_webhook_id_here

# URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000
PAYPAL_SUCCESS_URL=http://localhost:3000/settings?session_id={CHECKOUT_SESSION_ID}
PAYPAL_CANCEL_URL=http://localhost:3000/settings
```

### Step 5: Add DynamoDB Index

Run this AWS CLI command (or use AWS Console):

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

### Step 6: Test!

1. Start your server: `npm run dev`
2. Sign in and click "Upgrade to Premium"
3. Complete PayPal checkout
4. Check `/settings` page for subscription status

## 📝 Production Checklist

When ready for production:

- [ ] Switch to **Live** credentials (not Sandbox)
- [ ] Set `PAYPAL_ENVIRONMENT=production`
- [ ] Update all URLs to production domain
- [ ] Update webhook URL in PayPal dashboard
- [ ] Test with real payment (small amount)

## 🐛 Troubleshooting

**Can't create subscription?**
- Check `PAYPAL_PLAN_ID` is correct
- Verify plan is active in PayPal dashboard

**Webhooks not working?**
- Use ngrok for local testing: `ngrok http 3000`
- Update webhook URL in PayPal with ngrok URL
- Check webhook event logs in PayPal dashboard

**Subscription not activating?**
- Check DynamoDB GSI exists: `paypalSubscriptionId-index`
- Verify webhook events in PayPal dashboard
- Check server logs for errors

## 📚 Full Documentation

See [docs/PAYPAL_INTEGRATION.md](docs/PAYPAL_INTEGRATION.md) for detailed guide.

