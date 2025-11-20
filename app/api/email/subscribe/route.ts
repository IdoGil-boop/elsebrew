import { NextRequest, NextResponse } from 'next/server';
import { subscribeEmail, getEmailSubscription } from '@/lib/dynamodb';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if already subscribed
    const existing = await getEmailSubscription(email);
    if (existing) {
      logger.debug('[Email Subscribe] Email already subscribed', { email });
      return NextResponse.json(
        { message: 'Email already subscribed', alreadySubscribed: true },
        { status: 200 }
      );
    }

    // Subscribe email
    await subscribeEmail(email, 'homepage');
    logger.debug('[Email Subscribe] Email subscribed successfully', { email });

    return NextResponse.json(
      { message: 'Email subscribed successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('[Email Subscribe] Error subscribing email:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe email' },
      { status: 500 }
    );
  }
}

