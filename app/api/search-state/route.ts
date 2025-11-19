import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getSearchState, saveSearchHistory, updateSearchState } from '@/lib/dynamodb';
import { getClientIp } from '@/lib/ip-utils';
import { logger } from '@/lib/logger';

// GET: Retrieve search state
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const searchId = searchParams.get('searchId');

    if (!searchId) {
      return NextResponse.json({ error: 'Missing searchId' }, { status: 400 });
    }

    // Try to get authenticated user, fall back to IP-based ID
    let userId: string;
    const user = await getUserFromRequest(request);
    if (user) {
      userId = user.sub;
    } else {
      userId = `ip-${getClientIp(request)}`;
    }

    const searchState = await getSearchState(userId, searchId);

    if (!searchState) {
      return NextResponse.json({ error: 'Search state not found' }, { status: 404 });
    }

    return NextResponse.json({ searchState });
  } catch (error) {
    logger.error('[Search State API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve search state' },
      { status: 500 }
    );
  }
}

// POST: Create or update search state
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      searchId,
      originPlaces,
      destination,
      vibes,
      freeText,
      results,
      allResults,
      shownPlaceIds,
      currentPage,
      hasMorePages,
      nextPageToken,
    } = body;

    if (!searchId || !originPlaces || !destination || !vibes) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Try to get authenticated user, fall back to IP-based ID
    let userId: string;
    const user = await getUserFromRequest(request);
    if (user) {
      userId = user.sub;
    } else {
      userId = `ip-${getClientIp(request)}`;
    }

    const searchState = {
      userId,
      searchId,
      originPlaces,
      destination,
      vibes,
      freeText,
      results,
      allResults,
      shownPlaceIds,
      currentPage: currentPage || 0,
      hasMorePages: hasMorePages || false,
      nextPageToken,
      timestamp: new Date().toISOString(),
    };

    await saveSearchHistory(searchState);

    return NextResponse.json({ success: true, searchId });
  } catch (error) {
    logger.error('[Search State API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save search state' },
      { status: 500 }
    );
  }
}

// PATCH: Update existing search state (for pagination)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchId, updates } = body;

    if (!searchId || !updates) {
      return NextResponse.json(
        { error: 'Missing searchId or updates' },
        { status: 400 }
      );
    }

    // Try to get authenticated user, fall back to IP-based ID
    let userId: string;
    const user = await getUserFromRequest(request);
    if (user) {
      userId = user.sub;
    } else {
      userId = `ip-${getClientIp(request)}`;
    }

    await updateSearchState(userId, searchId, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Search State API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update search state' },
      { status: 500 }
    );
  }
}
