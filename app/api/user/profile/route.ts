import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUser, createOrUpdateUser, UserProfile } from '@/lib/dynamodb';

export const runtime = 'nodejs';

// GET /api/user/profile - Get user profile
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const user = await getUser(auth.user.sub);
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

// POST /api/user/profile - Create or update user profile
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();

    const userProfile: UserProfile = {
      userId: auth.user.sub,
      email: auth.user.email,
      name: auth.user.name,
      picture: auth.user.picture,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: body.preferences,
    };

    await createOrUpdateUser(userProfile);

    return NextResponse.json({ success: true, user: userProfile });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}
