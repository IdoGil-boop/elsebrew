import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getClientIp } from '@/lib/ip-utils';
import { checkAndIncrementRateLimit, getRateLimitConfig } from '@/lib/dynamodb';
import { getUserSubscription } from '@/lib/subscription';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Get user ID and IP address
    const user = await getUserFromRequest(request);
    const ip = getClientIp(request);

    let userId: string;
    if (user) {
      userId = user.sub;
    } else {
      userId = `ip-${ip}`;
    }

    // Get user's subscription tier
    const subscription = await getUserSubscription(user?.sub);

    // Get rate limit configuration based on tier
    const { maxSearches, windowHours } = getRateLimitConfig(subscription.tier);

    // Premium users bypass rate limiting
    if (subscription.tier === 'premium') {
      logger.debug('[Rate Limit API] Premium user - bypassing rate limit:', {
        userId,
      });
      return NextResponse.json({
        allowed: true,
        remaining: 999999,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        currentCount: 0,
        limit: 999999,
        windowHours: 24,
        isAuthenticated: !!user,
        isPremium: true,
      });
    }

    // Check and increment rate limit for BOTH user ID and IP (OR condition)
    const rateLimit = await checkAndIncrementRateLimit(userId, ip);

    logger.debug('[Rate Limit API] Check result:', {
      userId,
      ip,
      allowed: rateLimit.allowed,
      currentCount: rateLimit.currentCount,
      blockedBy: rateLimit.blockedBy,
    });

    if (!rateLimit.allowed) {
      logger.info('[Rate Limit API] Request blocked:', {
        userId,
        ip,
        currentCount: rateLimit.currentCount,
        blockedBy: rateLimit.blockedBy,
      });
      return NextResponse.json(
        {
          allowed: false,
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
          currentCount: rateLimit.currentCount,
          limit: maxSearches,
          windowHours: windowHours,
          blockedBy: rateLimit.blockedBy,
          isAuthenticated: !!user,
        },
        { status: 429 } // Too Many Requests
      );
    }

    return NextResponse.json({
      allowed: true,
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt,
      currentCount: rateLimit.currentCount,
      limit: maxSearches,
      windowHours: windowHours,
      isAuthenticated: !!user,
    });
  } catch (error) {
    logger.error('[Rate Limit API] Error:', error);
    // On error, fail closed (block) to prevent abuse
    // This is safer than failing open
    const { maxSearches, windowHours } = getRateLimitConfig();
    return NextResponse.json(
      {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + windowHours * 60 * 60 * 1000).toISOString(),
        currentCount: 999, // Indicate error state
        limit: maxSearches,
        windowHours: windowHours,
        isAuthenticated: false,
        error: 'Rate limit check failed',
      },
      { status: 429 }
    );
  }
}

