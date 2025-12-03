import { NextRequest, NextResponse } from 'next/server';
import { handlePayPalWebhook } from '@/lib/subscription';
import paypal from '@paypal/paypal-server-sdk';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const headers = Object.fromEntries(request.headers.entries());

  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error('[PayPal Webhook] PAYPAL_WEBHOOK_ID not configured');
    return NextResponse.json({ error: 'Webhook ID not configured' }, { status: 500 });
  }

  try {
    // Verify webhook signature (PayPal requires verification)
    // Note: In production, you should verify the webhook signature
    // For now, we'll process the event (you should add verification in production)
    
    console.log('[PayPal Webhook] Received event:', body.event_type);

    // Handle the event
    await handlePayPalWebhook(body);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[PayPal Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook error', details: error.message },
      { status: 400 }
    );
  }
}
