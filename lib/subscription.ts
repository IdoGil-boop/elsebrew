import { SubscriptionTier, SubscriptionInfo } from '@/types';
import { getUserSubscription as getSubscriptionFromDB, updateUserSubscription } from './dynamodb';
import { getSubscriptionsController, PAYPAL_CONFIG } from './paypal';
import { CreateSubscriptionRequest, ApplicationContextUserAction, ExperienceContextShippingPreference } from '@paypal/paypal-server-sdk';

/**
 * Get user's subscription tier and details
 */
export async function getUserSubscription(userId: string | undefined): Promise<SubscriptionInfo> {
  if (!userId) {
    return {
      tier: 'free',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const subscription = await getSubscriptionFromDB(userId);

    // Check if subscription has expired
    if (subscription.tier === 'premium' && subscription.currentPeriodEnd) {
      const periodEnd = new Date(subscription.currentPeriodEnd);
      if (periodEnd < new Date()) {
        // Subscription expired, downgrade to free
        const updatedSubscription: SubscriptionInfo = {
          ...subscription,
          tier: 'free',
          updatedAt: new Date().toISOString(),
        };
        await updateUserSubscription(userId, updatedSubscription);
        return updatedSubscription;
      }
    }

    return subscription;
  } catch (error) {
    console.error('Error fetching subscription:', error);
    // Default to free tier on error
    return {
      tier: 'free',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Check if user is premium
 */
export async function isPremiumUser(userId: string | undefined): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  return subscription.tier === 'premium';
}

/**
 * Handle PayPal webhook events
 */
export async function handlePayPalWebhook(event: any): Promise<void> {
  console.log('[PayPal Webhook] Processing event:', event.event_type);

  const resource = event.resource;

  switch (event.event_type) {
    case 'BILLING.SUBSCRIPTION.CREATED':
    case 'BILLING.SUBSCRIPTION.ACTIVATED': {
      const subscriptionId = resource.id;
      const payerId = resource.subscriber?.payer_id;
      const userId = resource.custom_id || resource.application_context?.custom_id;

      if (!userId || !subscriptionId) {
        console.error('[PayPal Webhook] Missing required fields in subscription created');
        return;
      }

      // Fetch subscription details from PayPal
      const subscriptionsController = getSubscriptionsController();
      const response = await subscriptionsController.getSubscription({
        id: subscriptionId,
      });

      const subscription = response.result;

      const subscriptionInfo: SubscriptionInfo = {
        tier: 'premium',
        paypalPayerId: payerId,
        paypalSubscriptionId: subscriptionId,
        currentPeriodEnd: subscription?.billingInfo?.nextBillingTime 
          ? new Date(subscription.billingInfo.nextBillingTime).toISOString()
          : undefined,
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await updateUserSubscription(userId, subscriptionInfo);
      console.log('[PayPal Webhook] Subscription created for user:', userId);
      break;
    }

    case 'BILLING.SUBSCRIPTION.UPDATED': {
      const subscriptionId = resource.id;
      const status = resource.status;

      // Find user by subscription ID
      const userId = await findUserByPayPalSubscriptionId(subscriptionId);
      if (!userId) {
        console.error('[PayPal Webhook] User not found for subscription:', subscriptionId);
        return;
      }

      const currentSubscription = await getUserSubscription(userId);

      const subscriptionInfo: SubscriptionInfo = {
        ...currentSubscription,
        tier: status === 'ACTIVE' ? 'premium' : 'free',
        currentPeriodEnd: resource.billingInfo?.nextBillingTime
          ? new Date(resource.billingInfo.nextBillingTime).toISOString()
          : currentSubscription.currentPeriodEnd,
        updatedAt: new Date().toISOString(),
      };

      await updateUserSubscription(userId, subscriptionInfo);
      console.log('[PayPal Webhook] Subscription updated for user:', userId);
      break;
    }

    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED': {
      const subscriptionId = resource.id;

      // Find user by subscription ID
      const userId = await findUserByPayPalSubscriptionId(subscriptionId);
      if (!userId) {
        console.error('[PayPal Webhook] User not found for subscription:', subscriptionId);
        return;
      }

      const currentSubscription = await getUserSubscription(userId);

      const subscriptionInfo: SubscriptionInfo = {
        ...currentSubscription,
        tier: 'free',
        updatedAt: new Date().toISOString(),
      };

      await updateUserSubscription(userId, subscriptionInfo);
      console.log('[PayPal Webhook] Subscription cancelled for user:', userId);
      break;
    }

    default:
      console.log('[PayPal Webhook] Unhandled event type:', event.event_type);
  }
}

/**
 * Find user ID by PayPal subscription ID
 */
async function findUserByPayPalSubscriptionId(subscriptionId: string): Promise<string | null> {
  const { queryUserByPayPalSubscriptionId } = await import('./dynamodb');
  return queryUserByPayPalSubscriptionId(subscriptionId);
}

/**
 * Create a PayPal subscription agreement for checkout
 */
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  planId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const finalPlanId = planId || PAYPAL_CONFIG.planId;
  
  if (!finalPlanId) {
    throw new Error(
      'PayPal plan ID not configured. Set PAYPAL_PLAN_ID environment variable or run the create-paypal-plan script.'
    );
  }

  const requestBody: CreateSubscriptionRequest = {
    planId: finalPlanId,
    customId: userId, // Store user ID for webhook
    applicationContext: {
      brandName: 'Elsebrew',
      locale: 'en-US',
      shippingPreference: ExperienceContextShippingPreference.NoShipping,
      userAction: ApplicationContextUserAction.SubscribeNow,
      returnUrl: successUrl,
      cancelUrl: cancelUrl,
    },
  };

  const subscriptionsController = getSubscriptionsController();
  const response = await subscriptionsController.createSubscription({
    body: requestBody,
  });

  if (response.statusCode !== 201 || !response.result?.links) {
    throw new Error('Failed to create PayPal subscription');
  }

  // Find approval URL
  const approvalLink = response.result.links.find((link: any) => link.rel === 'approve');
  if (!approvalLink?.href) {
    throw new Error('Failed to get approval URL from PayPal');
  }

  return approvalLink.href;
}

/**
 * Create a PayPal customer portal session (redirect to PayPal account)
 * Note: PayPal doesn't have a built-in portal like Stripe, so we redirect to PayPal's subscription management
 */
export async function createCustomerPortalSession(
  subscriptionId: string,
  returnUrl: string
): Promise<string> {
  // PayPal doesn't have a customer portal API like Stripe
  // We'll redirect users to PayPal's website to manage their subscription
  // The subscription ID is used to identify the subscription
  const environment = process.env.PAYPAL_ENVIRONMENT === 'production' 
    ? 'https://www.paypal.com'
    : 'https://www.sandbox.paypal.com';
  
  // Users can manage subscriptions at: https://www.paypal.com/myaccount/autopay/
  // For a better UX, we can provide a direct link or show instructions
  return `${environment}/myaccount/autopay/`;
}
