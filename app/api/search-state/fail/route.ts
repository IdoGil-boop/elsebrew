import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { markSearchAsFailed } from '@/lib/dynamodb';
import { getClientIp } from '@/lib/ip-utils';
import { logger } from '@/lib/logger';

/**
 * POST: Mark a search as failed with error details
 * Called when search encounters an error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      searchId,
      stage,
      message,
    } = body;

    if (!searchId || !stage || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: searchId, stage, message' },
        { status: 400 }
      );
    }

    // Validate stage
    const validStages = ['rate_limit', 'geocoding', 'place_search', 'ai_analysis', 'unknown'];
    if (!validStages.includes(stage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${validStages.join(', ')}` },
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

    await markSearchAsFailed(userId, searchId, stage, message);

    logger.debug('[Search State Fail] Successfully marked search as failed', {
      userId,
      searchId,
      stage,
      message
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Search State Fail] Error marking search as failed:', error);
    return NextResponse.json(
      { error: 'Failed to mark search as failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
