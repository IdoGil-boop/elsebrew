import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getUserSubscription, createCustomerPortalSession } from '@/lib/subscription';
import { PAYPAL_CONFIG } from '@/lib/paypal';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's subscription to find PayPal subscription ID
    const subscription = await getUserSubscription(user.sub);

    if (!subscription.paypalSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Create customer portal session (redirects to PayPal account management)
    const portalUrl = await createCustomerPortalSession(
      subscription.paypalSubscriptionId,
      PAYPAL_CONFIG.cancelUrl
    );

    return NextResponse.json({ url: portalUrl });
  } catch (error: any) {
    console.error('[PayPal Portal] Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session', details: error.message },
      { status: 500 }
    );
  }
}
