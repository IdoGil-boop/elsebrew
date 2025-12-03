/**
 * Script to create a PayPal product and subscription plan via API
 * 
 * Usage:
 *   tsx scripts/create-paypal-plan.ts
 * 
 * Make sure you have these environment variables in .env.local:
 *   PAYPAL_CLIENT_ID
 *   PAYPAL_CLIENT_SECRET
 *   PAYPAL_ENVIRONMENT (sandbox or production)
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { 
  Client, 
  ClientCredentialsAuthManager, 
  Environment, 
  SubscriptionsController,
  PlanRequest,
  SubscriptionBillingCycle,
  SubscriptionPricingScheme,
  Frequency,
  IntervalUnit,
  Money,
  PaymentPreferences,
  TenureType,
  SetupFeeFailureAction,
  PlanRequestStatus,
} from '@paypal/paypal-server-sdk';

// Configuration
const PRODUCT_NAME = 'Elsebrew Premium';
const PRODUCT_DESCRIPTION = 'Premium subscription for Elsebrew - unlimited searches and advanced vibe filters';
const PLAN_NAME = 'Premium Monthly';
const PRICE = '5.00'; // USD
const CURRENCY = 'USD';

async function createProductAndPlan() {
  // Initialize PayPal client
  const paypalEnv = process.env.PAYPAL_ENVIRONMENT === 'production' 
    ? Environment.Production
    : Environment.Sandbox;

  const client = new Client({
    environment: paypalEnv,
    clientCredentialsAuthCredentials: {
      oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
      oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
    },
  });

  const subscriptionsController = new SubscriptionsController(client);

  console.log(`🔧 Using ${process.env.PAYPAL_ENVIRONMENT || 'sandbox'} environment\n`);

  // Step 1: Create Product using Catalog Products API
  // Note: The SDK might not have a direct product creation method, so we'll use the REST API
  console.log('📦 Step 1: Creating product...');
  
  try {
    // Get access token for REST API calls
    const credentials = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const tokenResponse = await fetch(
      paypalEnv === Environment.Production
        ? 'https://api.paypal.com/v1/oauth2/token'
        : 'https://api.sandbox.paypal.com/v1/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
    }

    // Create product
    const productResponse = await fetch(
      paypalEnv === Environment.Production
        ? 'https://api.paypal.com/v1/catalogs/products'
        : 'https://api.sandbox.paypal.com/v1/catalogs/products',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION,
          type: 'SERVICE',
          category: 'SOFTWARE',
        }),
      }
    );

    if (!productResponse.ok) {
      const error = await productResponse.json();
      throw new Error('Failed to create product: ' + JSON.stringify(error));
    }

    const product = await productResponse.json();
    console.log(`✅ Product created!`);
    console.log(`   Product ID: ${product.id}`);
    console.log(`   Name: ${product.name}\n`);

    // Step 2: Create Billing Plan
    console.log('💳 Step 2: Creating billing plan...');

    const pricingScheme: SubscriptionPricingScheme = {
      version: 1,
      fixedPrice: {
        value: PRICE,
        currencyCode: CURRENCY,
      },
    };

    const frequency: Frequency = {
      intervalUnit: IntervalUnit.Month,
      intervalCount: 1,
    };

    const billingCycle: SubscriptionBillingCycle = {
      frequency,
      tenureType: TenureType.Regular,
      sequence: 1,
      totalCycles: 0, // 0 means infinite
      pricingScheme,
    };

    const paymentPreferences: PaymentPreferences = {
      autoBillOutstanding: true,
      setupFee: {
        value: '0',
        currencyCode: CURRENCY,
      },
      setupFeeFailureAction: SetupFeeFailureAction.Continue,
      paymentFailureThreshold: 3,
    };

    const planRequest: PlanRequest = {
      productId: product.id,
      name: PLAN_NAME,
      description: `${PLAN_NAME} - ${PRODUCT_DESCRIPTION}`,
      status: PlanRequestStatus.Active,
      billingCycles: [billingCycle],
      paymentPreferences,
    };

    const planResponse = await subscriptionsController.createBillingPlan({
      body: planRequest,
      prefer: 'return=representation',
    });

    if (planResponse.statusCode !== 201 || !planResponse.result) {
      throw new Error('Failed to create plan: ' + JSON.stringify(planResponse));
    }

    const plan = planResponse.result;
    console.log(`✅ Billing plan created!`);
    console.log(`   Plan ID: ${plan.id}`);
    console.log(`   Name: ${plan.name}`);
    console.log(`   Status: ${plan.status}\n`);

    console.log('🎉 Success! Add these to your .env.local:\n');
    console.log(`PAYPAL_PLAN_ID=${plan.id}\n`);

    return {
      productId: product.id,
      planId: plan.id,
    };
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
    throw error;
  }
}

// Run the script
if (require.main === module) {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    console.error('❌ Missing required environment variables:');
    console.error('   PAYPAL_CLIENT_ID');
    console.error('   PAYPAL_CLIENT_SECRET');
    console.error('\nSet PAYPAL_ENVIRONMENT=sandbox for testing\n');
    process.exit(1);
  }

  createProductAndPlan()
    .then(() => {
      console.log('✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to create product/plan:', error);
      process.exit(1);
    });
}

export { createProductAndPlan };

