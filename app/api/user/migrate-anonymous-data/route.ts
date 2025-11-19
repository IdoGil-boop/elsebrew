import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { migrateAnonymousDataToUser } from '@/lib/dynamodb';
import { getClientIp, hashIp } from '@/lib/ip-utils';

export const runtime = 'nodejs';

// POST /api/user/migrate-anonymous-data - Migrate IP-based data to user account
// Called when user logs in to merge their anonymous browsing history
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Get IP hash for this user
    const ip = getClientIp(request);
    const ipHash = await hashIp(ip);

    console.log(`[Migration API] Starting migration for user ${auth.user.sub} from IP ${ip}`);

    // Migrate data
    const result = await migrateAnonymousDataToUser(ipHash, auth.user.sub);

    return NextResponse.json({
      success: true,
      migratedCount: result.migratedCount,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Migration API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate anonymous data' },
      { status: 500 }
    );
  }
}
