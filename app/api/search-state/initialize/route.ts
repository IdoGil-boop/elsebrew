import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { initializeSearchHistory } from '@/lib/dynamodb';
import { getClientIp } from '@/lib/ip-utils';
import { logger } from '@/lib/logger';

/**
 * POST: Initialize a new search in pending status
 * Called immediately after rate limit check passes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      searchId,
      originPlaces,
      destination,
      vibes,
      freeText,
    } = body;

    if (!searchId || !originPlaces || !destination || !vibes) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user ID (authenticated or IP-based)
    let userId: string;
    const user = await getUserFromRequest(request);
    if (user) {
      userId = user.sub;
    } else {
      userId = `ip-${getClientIp(request)}`;
    }

    await initializeSearchHistory(
      userId,
      searchId,
      originPlaces,
      destination,
      vibes,
      freeText
    );

    logger.debug('[Search State Init] Successfully initialized search', { userId, searchId });

    return NextResponse.json({ success: true, searchId });
  } catch (error) {
    logger.error('[Search State Init] Error initializing search:', error);
    return NextResponse.json(
      { error: 'Failed to initialize search', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
