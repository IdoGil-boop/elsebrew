import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { markSearchAsSuccessful } from '@/lib/dynamodb';
import { getClientIp } from '@/lib/ip-utils';
import { logger } from '@/lib/logger';

/**
 * POST: Mark a search as successful and save results
 * Called when search completes successfully
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      searchId,
      results,
      allResults,
      hasMorePages,
      nextPageToken,
    } = body;

    if (!searchId || !results) {
      return NextResponse.json(
        { error: 'Missing required fields: searchId, results' },
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

    await markSearchAsSuccessful(
      userId,
      searchId,
      results,
      allResults,
      hasMorePages,
      nextPageToken
    );

    logger.debug('[Search State Success] Successfully marked search as successful', {
      userId,
      searchId,
      resultsCount: results.length,
      allResultsCount: allResults?.length || 0
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Search State Success] Error marking search as successful:', error);
    return NextResponse.json(
      { error: 'Failed to mark search as successful', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
