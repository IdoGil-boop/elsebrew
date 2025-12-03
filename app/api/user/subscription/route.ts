import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getUserSubscription } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUserFromRequest(request);

    if (!user) {
      // Return free tier for anonymous users
      return NextResponse.json({
        tier: 'free',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Get subscription from database
    const subscription = await getUserSubscription(user.sub);

    return NextResponse.json(subscription);
  } catch (error: any) {
    console.error('[Subscription API] Error fetching subscription:', error);
    // Return free tier on error
    return NextResponse.json({
      tier: 'free',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

