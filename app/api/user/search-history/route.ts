import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSearchHistory, saveSearchHistory, SearchHistoryItem } from '@/lib/dynamodb';

export const runtime = 'nodejs';

// GET /api/user/search-history - Get search history for user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const history = await getSearchHistory(auth.user.sub, limit);
    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching search history:', error);
    return NextResponse.json({ error: 'Failed to fetch search history' }, { status: 500 });
  }
}

// POST /api/user/search-history - Save a search to history
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();

    const searchItem: SearchHistoryItem = {
      userId: auth.user.sub,
      searchId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      originPlaces: body.originPlaces,
      destination: body.destination,
      vibes: body.vibes,
      freeText: body.freeText,
      results: body.results,
      timestamp: new Date().toISOString(),
      status: 'success', // Default to success for backward compatibility
      initiatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    await saveSearchHistory(searchItem);

    return NextResponse.json({ success: true, searchItem });
  } catch (error) {
    console.error('Error saving search history:', error);
    return NextResponse.json({ error: 'Failed to save search history' }, { status: 500 });
  }
}
