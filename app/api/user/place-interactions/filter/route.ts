import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getSeenButUnsavedPlaces, PlaceInteraction } from '@/lib/dynamodb';
import { getClientIp } from '@/lib/ip-utils';
import { hashIp } from '@/lib/ip-utils';
import { logger } from '@/lib/logger';

// GET /api/user/place-interactions/filter - Get places to filter out from search results
// Works for both logged-in users and anonymous users
// Returns ALL seen-but-unsaved places in the specified destination
export async function GET(request: NextRequest) {
  // Get user ID or IP hash
  let userId: string;
  const user = await getUserFromRequest(request);

  if (user) {
    userId = user.sub;
  } else {
    // User not logged in - use IP address
    const ip = getClientIp(request);
    userId = await hashIp(ip);
  }

  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get('destination');
    const vibesParam = searchParams.get('vibes');
    const freeText = searchParams.get('freeText');
    const originPlaceIdsParam = searchParams.get('originPlaceIds');

    if (!destination || !vibesParam || !originPlaceIdsParam) {
      return NextResponse.json(
        { error: 'Missing required query params: destination, vibes, originPlaceIds' },
        { status: 400 }
      );
    }

    const searchContext: PlaceInteraction['searchContext'] = {
      destination,
      vibes: JSON.parse(vibesParam),
      freeText: freeText || undefined,
      originPlaceIds: JSON.parse(originPlaceIdsParam),
    };

    const placeIdsToPenalize = await getSeenButUnsavedPlaces(userId, searchContext);

    logger.debug(`[Filter API] Returning ${placeIdsToPenalize.length} seen places for ${destination}`);

    return NextResponse.json({ placeIdsToPenalize });
  } catch (error) {
    logger.error('[Filter API] Error fetching places to filter:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter list' },
      { status: 500 }
    );
  }
}
