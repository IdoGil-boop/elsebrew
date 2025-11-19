import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSavedPlaces, savePlace, deleteSavedPlace, SavedPlace, markPlaceAsSaved, markPlaceAsUnsaved } from '@/lib/dynamodb';

export const runtime = 'nodejs';

// GET /api/user/saved-places - Get all saved places for user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Check if AWS is configured
    const isAwsConfigured =
      process.env.DYNAMODB_ACCESS_KEY_ID &&
      process.env.DYNAMODB_ACCESS_KEY_ID !== 'your_aws_access_key_here' &&
      process.env.DYNAMODB_SECRET_ACCESS_KEY &&
      process.env.DYNAMODB_SECRET_ACCESS_KEY !== 'your_aws_secret_key_here';

    if (!isAwsConfigured) {
      // Return empty array - client will use localStorage
      return NextResponse.json({ places: [], localStorage: true });
    }

    try {
      const places = await getSavedPlaces(auth.user.sub);
      return NextResponse.json({ places });
    } catch (dbError: any) {
      console.error('DynamoDB error, client will use localStorage:', dbError.message);
      return NextResponse.json({ places: [], localStorage: true });
    }
  } catch (error) {
    console.error('Error fetching saved places:', error);
    return NextResponse.json({ error: 'Failed to fetch saved places' }, { status: 500 });
  }
}

// POST /api/user/saved-places - Save a place
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();

    // Check if AWS is configured
    const isAwsConfigured =
      process.env.DYNAMODB_ACCESS_KEY_ID &&
      process.env.DYNAMODB_ACCESS_KEY_ID !== 'your_aws_access_key_here' &&
      process.env.DYNAMODB_SECRET_ACCESS_KEY &&
      process.env.DYNAMODB_SECRET_ACCESS_KEY !== 'your_aws_secret_key_here';

    if (!isAwsConfigured) {
      console.log('[API] AWS not configured - returning success (client will use localStorage)');
      // Return success - client-side will handle localStorage storage
      return NextResponse.json({
        success: true,
        localStorage: true,
        message: 'Saved to browser storage. Configure AWS to sync across devices.'
      });
    }

    const place: SavedPlace = {
      userId: auth.user.sub,
      placeId: body.placeId,
      name: body.name,
      address: body.address,
      rating: body.rating,
      priceLevel: body.priceLevel,
      photoUrl: body.photoUrl,
      savedAt: new Date().toISOString(),
      tags: body.tags || [],
      notes: body.notes,
    };

    try {
      await savePlace(place);
      // Also update place interactions to mark as saved
      await markPlaceAsSaved(auth.user.sub, body.placeId);
      return NextResponse.json({ success: true, place });
    } catch (dbError: any) {
      // If DynamoDB fails (invalid credentials, table doesn't exist, etc.)
      // fall back to localStorage on client side
      console.error('DynamoDB error, using localStorage fallback:', dbError.message);
      return NextResponse.json({
        success: true,
        localStorage: true,
        message: 'Saved to browser storage. AWS credentials invalid or tables not created.'
      });
    }
  } catch (error) {
    console.error('Error saving place:', error);
    return NextResponse.json({ error: 'Failed to save place' }, { status: 500 });
  }
}

// DELETE /api/user/saved-places - Delete a saved place
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('placeId');

    if (!placeId) {
      return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
    }

    // Check if AWS is configured
    const isAwsConfigured =
      process.env.DYNAMODB_ACCESS_KEY_ID &&
      process.env.DYNAMODB_ACCESS_KEY_ID !== 'your_aws_access_key_here' &&
      process.env.DYNAMODB_SECRET_ACCESS_KEY &&
      process.env.DYNAMODB_SECRET_ACCESS_KEY !== 'your_aws_secret_key_here';

    if (!isAwsConfigured) {
      // Return success - client-side will handle localStorage deletion
      return NextResponse.json({
        success: true,
        localStorage: true,
        message: 'Deleted from browser storage. Configure AWS to sync across devices.'
      });
    }

    try {
      await deleteSavedPlace(auth.user.sub, placeId);
      // Also update place interactions to mark as unsaved
      await markPlaceAsUnsaved(auth.user.sub, placeId);
      return NextResponse.json({ success: true });
    } catch (dbError: any) {
      // If DynamoDB fails (invalid credentials, table doesn't exist, etc.)
      console.error('DynamoDB error, using localStorage fallback:', dbError.message);
      return NextResponse.json({
        success: true,
        localStorage: true,
        message: 'Deleted from browser storage. AWS credentials invalid or tables not created.'
      });
    }
  } catch (error) {
    console.error('Error deleting saved place:', error);
    return NextResponse.json({ error: 'Failed to delete saved place' }, { status: 500 });
  }
}
