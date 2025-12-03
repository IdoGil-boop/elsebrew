import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createCheckoutSession } from '@/lib/subscription';
import { PAYPAL_CONFIG } from '@/lib/paypal';

export async function POST(request: NextRequest) {
  console.log('[PayPal Checkout] Request received');
  
  try {
    // Get authenticated user
    const user = await getUserFromRequest(request);
    console.log('[PayPal Checkout] User from request:', user ? 'authenticated' : 'not authenticated');

    if (!user) {
      console.log('[PayPal Checkout] No user found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[PayPal Checkout] Creating checkout for user:', user.sub);
    console.log('[PayPal Checkout] Plan ID configured:', !!PAYPAL_CONFIG.planId);
    console.log('[PayPal Checkout] Plan ID value:', PAYPAL_CONFIG.planId);

    // Create PayPal checkout session
    const checkoutUrl = await createCheckoutSession(
      user.sub,
      user.email,
      PAYPAL_CONFIG.planId,
      PAYPAL_CONFIG.successUrl,
      PAYPAL_CONFIG.cancelUrl
    );

    console.log('[PayPal Checkout] Checkout URL created successfully');
    return NextResponse.json({ url: checkoutUrl });
  } catch (error: any) {
    console.error('[PayPal Checkout] ========= ERROR CAUGHT =========');
    console.error('[PayPal Checkout] Error type:', error?.constructor?.name);
    console.error('[PayPal Checkout] Error message:', error?.message);
    console.error('[PayPal Checkout] Error toString:', String(error));
    console.error('[PayPal Checkout] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('[PayPal Checkout] Stack:', error?.stack);
    console.error('[PayPal Checkout] ====================================');
    
    // Extract error message with multiple fallbacks
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    
    // Provide helpful error messages for common issues
    let userMessage = 'Failed to create checkout session';
    
    if (errorMsg.includes('PayPal credentials not configured')) {
      userMessage = 'Payment system not configured. Please contact support.';
    } else if (errorMsg.includes('PayPal plan ID not configured')) {
      userMessage = 'Subscription plan not set up. Please contact support.';
    }
    
    return NextResponse.json(
      { 
        error: userMessage,
        details: errorMsg
      },
      { status: 500 }
    );
  }
}
