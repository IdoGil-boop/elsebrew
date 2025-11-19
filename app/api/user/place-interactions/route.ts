import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  recordPlaceView,
  markPlaceAsSaved,
  markPlaceAsUnsaved,
  getSeenButUnsavedPlaces,
  PlaceInteraction,
} from '@/lib/dynamodb';
import { getClientIp, hashIp } from '@/lib/ip-utils';

export const runtime = 'nodejs';

// POST /api/user/place-interactions - Record place view or update save status
// Works for both logged-in users (with auth) and anonymous users (by IP)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);

  // Get user ID or IP hash
  let userId: string;
  let isAnonymous = false;

  if ('error' in auth) {
    // User not logged in - use IP address
    const ip = getClientIp(request);
    userId = await hashIp(ip);
    isAnonymous = true;
  } else {
    userId = auth.user.sub;
  }

  try {
    const body = await request.json();
    const { action, placeId, placeName, searchContext } = body;

    if (!action || !placeId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, placeId' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'view':
        if (!placeName || !searchContext) {
          return NextResponse.json(
            { error: 'Missing required fields for view: placeName, searchContext' },
            { status: 400 }
          );
        }
        await recordPlaceView(userId, placeId, placeName, searchContext, isAnonymous);
        return NextResponse.json({ success: true });

      case 'save':
        if (isAnonymous) {
          return NextResponse.json(
            { error: 'Must be logged in to save places' },
            { status: 401 }
          );
        }
        await markPlaceAsSaved(userId, placeId);
        return NextResponse.json({ success: true });

      case 'unsave':
        if (isAnonymous) {
          return NextResponse.json(
            { error: 'Must be logged in to unsave places' },
            { status: 401 }
          );
        }
        await markPlaceAsUnsaved(userId, placeId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling place interaction:', error);
    return NextResponse.json(
      { error: 'Failed to process place interaction' },
      { status: 500 }
    );
  }
}
