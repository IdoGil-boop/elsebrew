import { Client, ClientCredentialsAuthManager, Environment, SubscriptionsController } from '@paypal/paypal-server-sdk';

/**
 * PayPal configuration
 */
export const PAYPAL_CONFIG = {
  // Environment URLs
  // Note: PayPal adds subscription_id and ba_token params automatically to return URLs
  successUrl: process.env.PAYPAL_SUCCESS_URL || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/settings?success=true`,
  cancelUrl: process.env.PAYPAL_CANCEL_URL || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/settings?canceled=true`,
  
  // Subscription plan ID (create this in PayPal dashboard)
  planId: process.env.PAYPAL_PLAN_ID || '',
  
  // Base URL for webhook
  webhookUrl: process.env.PAYPAL_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/stripe/webhook`,
};

/**
 * Cached PayPal client instance
 */
let paypalClient: Client | null = null;

/**
 * Initialize PayPal client (lazy initialization)
 */
export function getPayPalClient(): Client {
  if (paypalClient) {
    return paypalClient;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'PayPal credentials not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.'
    );
  }

  const environment = process.env.PAYPAL_ENVIRONMENT === 'production' 
    ? Environment.Production
    : Environment.Sandbox;

  paypalClient = new Client({
    environment,
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret,
    },
  });

  return paypalClient;
}

/**
 * Get subscriptions controller
 */
export function getSubscriptionsController(): SubscriptionsController {
  const client = getPayPalClient();
  return new SubscriptionsController(client);
}

