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

    // Get existing user to preserve createdAt if it exists
    const existingUser = await getUser(auth.user.sub);
    const now = new Date().toISOString();

    const userProfile: UserProfile = {
      userId: auth.user.sub,
      email: auth.user.email,
      name: auth.user.name,
      picture: auth.user.picture,
      // Use fields from JWT (auth.user) if available, otherwise from body
      emailVerified: auth.user.email_verified ?? body.emailVerified ?? existingUser?.emailVerified ?? undefined,
      givenName: auth.user.given_name ?? body.givenName ?? existingUser?.givenName ?? undefined,
      familyName: auth.user.family_name ?? body.familyName ?? existingUser?.familyName ?? undefined,
      locale: auth.user.locale ?? body.locale ?? existingUser?.locale ?? undefined,
      createdAt: existingUser?.createdAt || body.createdAt || now,
      updatedAt: now,
      preferences: body.preferences || existingUser?.preferences,
    };

    await createOrUpdateUser(userProfile);

    return NextResponse.json({ success: true, user: userProfile });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}
