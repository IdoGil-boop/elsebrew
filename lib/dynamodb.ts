import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger';

// Lazy initialization of DynamoDB client
let dynamoDB: DynamoDBDocumentClient | null = null;
let initializationError: Error | null = null;
let credentialsCache: { accessKeyId: string; secretAccessKey: string; region: string } | null = null;
let initializationPromise: Promise<void> | null = null;

function getCredentials(): { accessKeyId: string; secretAccessKey: string; region: string } {
  // Always check fresh from env vars (don't rely on cache if we're retrying)
  const accessKeyId = process.env.DYNAMODB_ACCESS_KEY_ID;
  const secretAccessKey = process.env.DYNAMODB_SECRET_ACCESS_KEY;
  const region = process.env.DYNAMODB_REGION || 'us-east-1';

  // Log what we found for debugging
  logger.debug('[DynamoDB] Checking credentials', {
    hasAccessKey: !!accessKeyId,
    hasSecretKey: !!secretAccessKey,
    hasRegion: !!region,
    accessKeyPrefix: accessKeyId ? accessKeyId.substring(0, 8) + '...' : 'MISSING',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('DYNAMODB')).join(', '),
  });

  if (!accessKeyId || !secretAccessKey) {
    const availableVars = Object.keys(process.env).filter(k => k.startsWith('DYNAMODB_'));
    const error = new Error(
      'AWS credentials not configured. Set DYNAMODB_ACCESS_KEY_ID and DYNAMODB_SECRET_ACCESS_KEY environment variables. ' +
      'In AWS Amplify: Go to Environment Variables -> Add as Secrets -> Redeploy. ' +
      `Found ${availableVars.length} DYNAMODB_* vars: ${availableVars.join(', ') || 'none'}`
    );
    logger.error('[DynamoDB] Credentials check failed', {
      hasAccessKey: !!accessKeyId,
      hasSecretKey: !!secretAccessKey,
      availableEnvVars: availableVars,
      allEnvVarCount: Object.keys(process.env).length,
    });
    throw error;
  }

  // Validate credentials format
  if (!accessKeyId.startsWith('AKIA') && !accessKeyId.startsWith('ASIA')) {
    throw new Error('Invalid DYNAMODB_ACCESS_KEY_ID format. It should start with AKIA or ASIA.');
  }

  // Cache for future use
  credentialsCache = { accessKeyId, secretAccessKey, region };
  logger.debug('[DynamoDB] Credentials validated and cached', {
    region,
    accessKeyPrefix: accessKeyId.substring(0, 8) + '...',
  });

  return credentialsCache;
}

export async function initializeDynamoDB(): Promise<void> {
  if (dynamoDB) {
    return; // Already initialized
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      const { accessKeyId, secretAccessKey, region } = getCredentials();

      const client = new DynamoDBClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        // Add timeout and retry configuration for cross-region reliability
        maxAttempts: 3,
        requestHandler: {
          requestTimeout: 10000, // 10 second timeout
        } as any,
      });

      dynamoDB = DynamoDBDocumentClient.from(client);
      initializationError = null; // Clear any previous errors
      logger.debug('[DynamoDB] Client initialized successfully');
    } catch (error: any) {
      logger.error('[DynamoDB] Failed to initialize client:', error);
      initializationError = error;

      // Clear state so we can retry on next request
      credentialsCache = null;
      dynamoDB = null;
      initializationPromise = null;

      throw error;
    }
  })();

  await initializationPromise;
}

async function getDynamoDB(): Promise<DynamoDBDocumentClient> {
  // Check if credentials have changed (if we have cached credentials)
  const currentAccessKey = process.env.DYNAMODB_ACCESS_KEY_ID;
  if (credentialsCache && currentAccessKey && credentialsCache.accessKeyId !== currentAccessKey) {
    logger.debug('[DynamoDB] Credentials changed, clearing cache');
    credentialsCache = null;
    dynamoDB = null;
    initializationPromise = null;
  }

  // If we have a previous error but credentials are now available, clear everything and retry
  if (initializationError && currentAccessKey) {
    logger.debug('[DynamoDB] Credentials now available, clearing error state and retrying');
    initializationError = null;
    credentialsCache = null;
    dynamoDB = null;
    initializationPromise = null;
  }

  // Ensure initialization
  if (!dynamoDB) {
    await initializeDynamoDB();
  }

  if (!dynamoDB) {
    throw new Error('DynamoDB client failed to initialize');
  }

  return dynamoDB;
}

// Table names
export const TABLES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || 'elsebrew-users',
  SAVED_PLACES: process.env.DYNAMODB_SAVED_PLACES_TABLE || 'elsebrew-saved-places',
  SEARCH_HISTORY: process.env.DYNAMODB_SEARCH_HISTORY_TABLE || 'elsebrew-search-history',
  PLACE_INTERACTIONS: process.env.DYNAMODB_PLACE_INTERACTIONS_TABLE || 'elsebrew-place-interactions',
  RATE_LIMITS: process.env.DYNAMODB_RATE_LIMITS_TABLE || 'elsebrew-rate-limits',
  EMAIL_SUBSCRIPTIONS: process.env.DYNAMODB_EMAIL_SUBSCRIPTIONS_TABLE || 'elsebrew-email-subscriptions',
};

// Types
export interface UserProfile {
  userId: string; // Google user ID
  email: string;
  name: string;
  picture?: string;
  createdAt: string;
  updatedAt: string;
  preferences?: {
    defaultVibes?: string[];
    defaultRadius?: number;
  };
}

export interface SavedPlace {
  userId: string;
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  savedAt: string;
  tags?: string[]; // e.g., 'favorite', 'want-to-visit'
  notes?: string;
}

export interface SearchHistoryItem {
  userId: string;
  searchId: string; // timestamp-based ID
  originPlaces: Array<{
    placeId: string;
    name: string;
  }>;
  destination: string;
  vibes: string[];
  freeText?: string;
  results: Array<{
    placeId: string;
    name: string;
    score: number;
    photoUrl?: string; // Photo URL for cached results
    reasoning?: string; // AI-generated description
    matchedKeywords?: string[]; // Keywords that matched
    distanceToCenter?: number; // Distance to destination center
    imageAnalysis?: string; // AI image analysis
  }>;
  timestamp: string;
  // Search status tracking
  status: 'pending' | 'success' | 'failed';
  initiatedAt: string; // When search was started
  completedAt?: string; // When search completed (success or failure)
  error?: {
    stage: 'rate_limit' | 'geocoding' | 'place_search' | 'ai_analysis' | 'unknown';
    message: string;
    timestamp: string;
  };
  // Pagination state
  allResults?: Array<{
    placeId: string;
    name: string;
    score: number;
    photoUrl?: string; // Photo URL for cached results
    reasoning?: string; // AI-generated description
    matchedKeywords?: string[]; // Keywords that matched
    distanceToCenter?: number; // Distance to destination center
    imageAnalysis?: string; // AI image analysis
  }>; // All fetched results from Google (not just top 5)
  shownPlaceIds?: string[]; // Place IDs already shown to user
  currentPage?: number; // Which page of Google results we're on
  hasMorePages?: boolean; // Whether Google has more results
  nextPageToken?: string; // Token for fetching next page
}

export interface PlaceInteraction {
  userId: string; // Can be user ID (sub) or IP address for anonymous users
  placeId: string; // sort key
  placeName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  viewCount: number;
  searchContext: {
    destination: string;
    vibes: string[];
    freeText?: string;
    originPlaceIds: string[];
  };
  isSaved: boolean;
  savedAt?: string;
  isAnonymous?: boolean; // Flag to identify IP-based records
}

// User operations
export async function getUser(userId: string): Promise<UserProfile | null> {
  const db = await getDynamoDB();
  const result = await db.send(
    new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId },
    })
  );
  return result.Item as UserProfile || null;
}

export async function createOrUpdateUser(user: UserProfile): Promise<void> {
  const db = await getDynamoDB();
  await db.send(
    new PutCommand({
      TableName: TABLES.USERS,
      Item: {
        ...user,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

// Saved places operations
export async function getSavedPlaces(userId: string): Promise<SavedPlace[]> {
  const db = await getDynamoDB();
  const result = await db.send(
    new QueryCommand({
      TableName: TABLES.SAVED_PLACES,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Most recent first
    })
  );
  return result.Items as SavedPlace[] || [];
}

export async function savePlace(place: SavedPlace): Promise<void> {
  const db = await getDynamoDB();
  await db.send(
    new PutCommand({
      TableName: TABLES.SAVED_PLACES,
      Item: {
        ...place,
        savedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteSavedPlace(userId: string, placeId: string): Promise<void> {
  const db = await getDynamoDB();
  await db.send(
    new DeleteCommand({
      TableName: TABLES.SAVED_PLACES,
      Key: { userId, placeId },
    })
  );
}

// Search history operations
export async function getSearchHistory(userId: string, limit = 20): Promise<SearchHistoryItem[]> {
  const db = await getDynamoDB();
  const result = await db.send(
    new QueryCommand({
      TableName: TABLES.SEARCH_HISTORY,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    })
  );
  return result.Items as SearchHistoryItem[] || [];
}

/**
 * Initialize a new search history entry with 'pending' status
 * Called immediately after rate limit check passes
 */
export async function initializeSearchHistory(
  userId: string,
  searchId: string,
  originPlaces: Array<{ placeId: string; name: string }>,
  destination: string,
  vibes: string[],
  freeText?: string
): Promise<void> {
  const db = await getDynamoDB();
  const now = new Date().toISOString();

  await db.send(
    new PutCommand({
      TableName: TABLES.SEARCH_HISTORY,
      Item: {
        userId,
        searchId,
        originPlaces,
        destination,
        vibes,
        freeText,
        results: [],
        status: 'pending',
        initiatedAt: now,
        timestamp: now,
      },
    })
  );
}

/**
 * Mark search as failed with error details
 */
export async function markSearchAsFailed(
  userId: string,
  searchId: string,
  stage: 'rate_limit' | 'geocoding' | 'place_search' | 'ai_analysis' | 'unknown',
  message: string
): Promise<void> {
  const now = new Date().toISOString();
  await updateSearchState(userId, searchId, {
    status: 'failed',
    completedAt: now,
    error: {
      stage,
      message,
      timestamp: now,
    },
  });
}

/**
 * Mark search as successful and save results
 */
export async function markSearchAsSuccessful(
  userId: string,
  searchId: string,
  results: SearchHistoryItem['results'],
  allResults?: SearchHistoryItem['allResults'],
  hasMorePages?: boolean,
  nextPageToken?: string
): Promise<void> {
  const now = new Date().toISOString();
  const updates: Partial<SearchHistoryItem> = {
    status: 'success',
    completedAt: now,
    results,
    allResults,
    shownPlaceIds: results.map(r => r.placeId),
    currentPage: 0,
    hasMorePages: hasMorePages || false,
  };

  if (nextPageToken) {
    updates.nextPageToken = nextPageToken;
  }

  await updateSearchState(userId, searchId, updates);
}

export async function saveSearchHistory(history: SearchHistoryItem): Promise<void> {
  const db = await getDynamoDB();
  await db.send(
    new PutCommand({
      TableName: TABLES.SEARCH_HISTORY,
      Item: history,
    })
  );
}

export async function getSearchState(userId: string, searchId: string): Promise<SearchHistoryItem | null> {
  const db = await getDynamoDB();
  const result = await db.send(
    new GetCommand({
      TableName: TABLES.SEARCH_HISTORY,
      Key: { userId, searchId },
    })
  );
  return result.Item as SearchHistoryItem || null;
}

export async function updateSearchState(
  userId: string,
  searchId: string,
  updates: Partial<SearchHistoryItem>
): Promise<void> {
  // Build update expression dynamically
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'userId' && key !== 'searchId') { // Don't update keys
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }
  });

  if (updateExpressions.length === 0) return;

  const db = await getDynamoDB();
  await db.send(
    new UpdateCommand({
      TableName: TABLES.SEARCH_HISTORY,
      Key: { userId, searchId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
}

// Place interaction operations
export async function recordPlaceView(
  userId: string,
  placeId: string,
  placeName: string,
  searchContext: PlaceInteraction['searchContext'],
  isAnonymous: boolean = false
): Promise<void> {
  const now = new Date().toISOString();

  // Try to get existing interaction
  const db = await getDynamoDB();
  const existing = await db.send(
    new GetCommand({
      TableName: TABLES.PLACE_INTERACTIONS,
      Key: { userId, placeId },
    })
  );

  if (existing.Item) {
    // Update existing record
    const item = existing.Item as PlaceInteraction;
    await db.send(
      new PutCommand({
        TableName: TABLES.PLACE_INTERACTIONS,
        Item: {
          ...item,
          lastSeenAt: now,
          viewCount: (item.viewCount || 0) + 1,
          searchContext, // Update to latest search context
        },
      })
    );
  } else {
    // Create new record
    await db.send(
      new PutCommand({
        TableName: TABLES.PLACE_INTERACTIONS,
        Item: {
          userId,
          placeId,
          placeName,
          firstSeenAt: now,
          lastSeenAt: now,
          viewCount: 1,
          searchContext,
          isSaved: false,
          isAnonymous,
        },
      })
    );
  }
}

export async function markPlaceAsSaved(userId: string, placeId: string): Promise<void> {
  const now = new Date().toISOString();

  const db = await getDynamoDB();
  const existing = await db.send(
    new GetCommand({
      TableName: TABLES.PLACE_INTERACTIONS,
      Key: { userId, placeId },
    })
  );

  if (existing.Item) {
    await db.send(
      new PutCommand({
        TableName: TABLES.PLACE_INTERACTIONS,
        Item: {
          ...existing.Item,
          isSaved: true,
          savedAt: now,
        },
      })
    );
  }
}

export async function markPlaceAsUnsaved(userId: string, placeId: string): Promise<void> {
  const db = await getDynamoDB();
  const existing = await db.send(
    new GetCommand({
      TableName: TABLES.PLACE_INTERACTIONS,
      Key: { userId, placeId },
    })
  );

  if (existing.Item) {
    const { savedAt, ...rest } = existing.Item;
    await db.send(
      new PutCommand({
        TableName: TABLES.PLACE_INTERACTIONS,
        Item: {
          ...rest,
          isSaved: false,
        },
      })
    );
  }
}

export async function getPlaceInteractions(userId: string): Promise<PlaceInteraction[]> {
  const db = await getDynamoDB();
  const result = await db.send(
    new QueryCommand({
      TableName: TABLES.PLACE_INTERACTIONS,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    })
  );
  return result.Items as PlaceInteraction[] || [];
}

export async function getSeenButUnsavedPlaces(
  userId: string,
  searchContext: PlaceInteraction['searchContext']
): Promise<string[]> {
  const interactions = await getPlaceInteractions(userId);

  // Return ALL places seen but not saved in this destination
  // This ensures users don't see the same cafes across different searches in the same city
  return interactions
    .filter(interaction => {
      if (interaction.isSaved) return false; // Don't filter saved places

      // Filter by destination only - regardless of vibes, freeText, or origin places
      // This means if you saw a cafe in Tokyo before (and didn't save it),
      // it should be deprioritized in ALL future Tokyo searches
      return interaction.searchContext.destination === searchContext.destination;
    })
    .map(interaction => interaction.placeId);
}

// Migration: Merge anonymous IP data to user account
export async function migrateAnonymousDataToUser(
  ipAddress: string,
  userId: string
): Promise<{ migratedCount: number; errors: number }> {
  try {
    // Get all interactions for this IP
    const ipInteractions = await getPlaceInteractions(ipAddress);

    if (ipInteractions.length === 0) {
      return { migratedCount: 0, errors: 0 };
    }

    logger.debug(`[Migration] Migrating ${ipInteractions.length} interactions from IP ${ipAddress} to user ${userId}`);

    let migratedCount = 0;
    let errors = 0;

    // Get existing user interactions to avoid duplicates
    const userInteractions = await getPlaceInteractions(userId);
    const userPlaceIds = new Set(userInteractions.map(i => i.placeId));

    const db = await getDynamoDB();
    for (const ipInteraction of ipInteractions) {
      try {
        if (userPlaceIds.has(ipInteraction.placeId)) {
          // User already has this place interaction, merge view counts
          const userInteraction = userInteractions.find(i => i.placeId === ipInteraction.placeId);
          if (userInteraction) {
            await db.send(
              new PutCommand({
                TableName: TABLES.PLACE_INTERACTIONS,
                Item: {
                  ...userInteraction,
                  viewCount: (userInteraction.viewCount || 0) + (ipInteraction.viewCount || 0),
                  firstSeenAt: userInteraction.firstSeenAt < ipInteraction.firstSeenAt
                    ? userInteraction.firstSeenAt
                    : ipInteraction.firstSeenAt,
                  lastSeenAt: userInteraction.lastSeenAt > ipInteraction.lastSeenAt
                    ? userInteraction.lastSeenAt
                    : ipInteraction.lastSeenAt,
                  isAnonymous: false, // Now it's a logged-in user
                },
              })
            );
          }
        } else {
          // Create new interaction for user
          await db.send(
            new PutCommand({
              TableName: TABLES.PLACE_INTERACTIONS,
              Item: {
                ...ipInteraction,
                userId, // Change from IP to userId
                isAnonymous: false,
              },
            })
          );
        }

        // Delete the IP-based record
        await db.send(
          new DeleteCommand({
            TableName: TABLES.PLACE_INTERACTIONS,
            Key: { userId: ipAddress, placeId: ipInteraction.placeId },
          })
        );

        migratedCount++;
      } catch (error) {
        logger.error(`[Migration] Error migrating place ${ipInteraction.placeId}:`, error);
        errors++;
      }
    }

    logger.debug(`[Migration] Complete: ${migratedCount} migrated, ${errors} errors`);
    return { migratedCount, errors };
  } catch (error) {
    logger.error('[Migration] Failed to migrate anonymous data:', error);
    return { migratedCount: 0, errors: 1 };
  }
}

// Rate limiting operations
export interface RateLimitInfo {
  userId: string;
  searchCount: number;
  windowStart: string; // ISO timestamp
  resetAt: string; // ISO timestamp when limit resets
}

export interface EmailSubscription {
  email: string;
  subscribedAt: string;
  source?: string; // e.g., 'homepage', 'footer'
}

const RATE_LIMIT_WINDOW_HOURS = parseInt(process.env.RATE_LIMIT_WINDOW_HOURS || '12', 10);
const RATE_LIMIT_MAX_SEARCHES = parseInt(process.env.RATE_LIMIT_MAX_SEARCHES || '10', 10);

/**
 * Get rate limit configuration
 */
export function getRateLimitConfig(): { maxSearches: number; windowHours: number } {
  return {
    maxSearches: RATE_LIMIT_MAX_SEARCHES,
    windowHours: RATE_LIMIT_WINDOW_HOURS,
  };
}

/**
 * Get current rate limit info for a single identifier (without incrementing)
 * Internal helper function
 */
async function getRateLimitForId(userId: string): Promise<{
  currentCount: number;
  resetAt: string;
  windowStart: Date;
}> {
  const db = await getDynamoDB();
  const now = new Date();
  const windowMs = RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;

  const existing = await db.send(
    new GetCommand({
      TableName: TABLES.RATE_LIMITS,
      Key: { userId },
    })
  );

  if (!existing.Item) {
    return {
      currentCount: 0,
      resetAt: new Date(now.getTime() + windowMs).toISOString(),
      windowStart: now,
    };
  }

  const item = existing.Item as RateLimitInfo;
  const windowStartTime = new Date(item.windowStart);
  const elapsed = now.getTime() - windowStartTime.getTime();

  if (elapsed >= windowMs) {
    // Window expired
    return {
      currentCount: 0,
      resetAt: new Date(now.getTime() + windowMs).toISOString(),
      windowStart: now,
    };
  }

  return {
    currentCount: item.searchCount || 0,
    resetAt: new Date(windowStartTime.getTime() + windowMs).toISOString(),
    windowStart: windowStartTime,
  };
}

/**
 * Increment rate limit for a single identifier
 * Internal helper function
 */
async function incrementRateLimitForId(userId: string, windowStart: Date): Promise<void> {
  const db = await getDynamoDB();
  const now = new Date();
  const windowMs = RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;

  const existing = await db.send(
    new GetCommand({
      TableName: TABLES.RATE_LIMITS,
      Key: { userId },
    })
  );

  let searchCount = 1;
  let finalWindowStart = windowStart;
  let resetAt = new Date(windowStart.getTime() + windowMs);

  if (existing.Item) {
    const item = existing.Item as RateLimitInfo;
    const existingWindowStart = new Date(item.windowStart);
    const elapsed = now.getTime() - existingWindowStart.getTime();

    if (elapsed < windowMs) {
      // Still in existing window
      searchCount = (item.searchCount || 0) + 1;
      finalWindowStart = existingWindowStart;
      resetAt = new Date(existingWindowStart.getTime() + windowMs);
    } else {
      // Existing window expired, use new window
      searchCount = 1;
      finalWindowStart = windowStart;
      resetAt = new Date(windowStart.getTime() + windowMs);
    }
  }

  const ttl = Math.floor(resetAt.getTime() / 1000) + 3600;

  await db.send(
    new PutCommand({
      TableName: TABLES.RATE_LIMITS,
      Item: {
        userId,
        searchCount,
        windowStart: finalWindowStart.toISOString(),
        resetAt: resetAt.toISOString(),
        ttl,
      },
    })
  );
}

/**
 * Check and increment rate limit for a user
 * Checks BOTH user ID and IP address - if EITHER is at limit, blocks the request
 * Returns whether the search is allowed and current rate limit info
 */
export async function checkAndIncrementRateLimit(
  userId: string,
  ipAddress?: string
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: string;
  currentCount: number;
  blockedBy: 'user' | 'ip' | null;
}> {
  // First, check both limits WITHOUT incrementing
  const userLimit = await getRateLimitForId(userId);
  
  let ipLimit: { currentCount: number; resetAt: string; windowStart: Date } | null = null;
  // Only check IP limit if:
  // 1. IP address is provided
  // 2. User is authenticated (userId doesn't start with 'ip-')
  // 3. IP is different from the userId (to avoid double-checking)
  if (ipAddress && !userId.startsWith('ip-') && userId !== `ip-${ipAddress}`) {
    const ipUserId = `ip-${ipAddress}`;
    ipLimit = await getRateLimitForId(ipUserId);
  }

  // Check if either limit would be exceeded
  // Block if currentCount + 1 would exceed the limit (>= instead of >)
  const userWouldExceed = (userLimit.currentCount + 1) > RATE_LIMIT_MAX_SEARCHES;
  const ipWouldExceed = ipLimit && (ipLimit.currentCount + 1) > RATE_LIMIT_MAX_SEARCHES;
  
  logger.debug('[Rate Limit] Checking limits:', {
    userId,
    ipAddress,
    userCurrentCount: userLimit.currentCount,
    ipCurrentCount: ipLimit?.currentCount,
    maxSearches: RATE_LIMIT_MAX_SEARCHES,
    userWouldExceed,
    ipWouldExceed,
  });

  // OR condition: if EITHER limit would be exceeded, block
  if (userWouldExceed) {
    return {
      allowed: false,
      remaining: Math.max(0, RATE_LIMIT_MAX_SEARCHES - userLimit.currentCount),
      resetAt: userLimit.resetAt,
      currentCount: userLimit.currentCount,
      blockedBy: 'user',
    };
  }

  if (ipWouldExceed) {
    return {
      allowed: false,
      remaining: Math.max(0, RATE_LIMIT_MAX_SEARCHES - ipLimit!.currentCount),
      resetAt: ipLimit!.resetAt,
      currentCount: ipLimit!.currentCount,
      blockedBy: 'ip',
    };
  }

  // Both are allowed, increment both
  await incrementRateLimitForId(userId, userLimit.windowStart);
  if (ipLimit) {
    await incrementRateLimitForId(`ip-${ipAddress}`, ipLimit.windowStart);
  }

  // Return the more restrictive limit (fewer remaining)
  const userRemaining = RATE_LIMIT_MAX_SEARCHES - (userLimit.currentCount + 1);
  const ipRemaining = ipLimit ? RATE_LIMIT_MAX_SEARCHES - (ipLimit.currentCount + 1) : Infinity;
  
  if (ipRemaining < userRemaining) {
    return {
      allowed: true,
      remaining: ipRemaining,
      resetAt: ipLimit!.resetAt,
      currentCount: ipLimit!.currentCount + 1,
      blockedBy: null,
    };
  }

  return {
    allowed: true,
    remaining: userRemaining,
    resetAt: userLimit.resetAt,
    currentCount: userLimit.currentCount + 1,
    blockedBy: null,
  };
}

/**
 * Get current rate limit info without incrementing
 */
export async function getRateLimitInfo(userId: string): Promise<{
  remaining: number;
  resetAt: string;
  currentCount: number;
}> {
  const db = await getDynamoDB();
  const now = new Date();
  const windowMs = RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;

  const existing = await db.send(
    new GetCommand({
      TableName: TABLES.RATE_LIMITS,
      Key: { userId },
    })
  );

  if (!existing.Item) {
    return {
      remaining: RATE_LIMIT_MAX_SEARCHES,
      resetAt: new Date(now.getTime() + windowMs).toISOString(),
      currentCount: 0,
    };
  }

  const item = existing.Item as RateLimitInfo;
  const windowStartTime = new Date(item.windowStart);
  const elapsed = now.getTime() - windowStartTime.getTime();

  if (elapsed >= windowMs) {
    // Window expired
    return {
      remaining: RATE_LIMIT_MAX_SEARCHES,
      resetAt: new Date(now.getTime() + windowMs).toISOString(),
      currentCount: 0,
    };
  }

  const currentCount = item.searchCount || 0;
  const remaining = Math.max(0, RATE_LIMIT_MAX_SEARCHES - currentCount);
  const resetAt = new Date(windowStartTime.getTime() + windowMs);

  return {
    remaining,
    resetAt: resetAt.toISOString(),
    currentCount,
  };
}

/**
 * Merge rate limit data from IP to user account when user signs in
 */
export async function mergeRateLimitData(
  ipAddress: string,
  userId: string
): Promise<void> {
  try {
    const db = await getDynamoDB();
    const ipUserId = `ip-${ipAddress}`;
    const now = new Date();
    const windowMs = RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;

    // Get IP-based rate limit
    const ipLimit = await db.send(
      new GetCommand({
        TableName: TABLES.RATE_LIMITS,
        Key: { userId: ipUserId },
      })
    );

    // Get user-based rate limit
    const userLimit = await db.send(
      new GetCommand({
        TableName: TABLES.RATE_LIMITS,
        Key: { userId },
      })
    );

    // If no IP limit exists, nothing to merge
    if (!ipLimit.Item) {
      return;
    }

    const ipItem = ipLimit.Item as RateLimitInfo;
    const ipWindowStart = new Date(ipItem.windowStart);
    const ipElapsed = now.getTime() - ipWindowStart.getTime();

    // If IP window expired, nothing to merge
    if (ipElapsed >= windowMs) {
      // Clean up expired IP record
      await db.send(
        new DeleteCommand({
          TableName: TABLES.RATE_LIMITS,
          Key: { userId: ipUserId },
        })
      );
      return;
    }

    let finalSearchCount = ipItem.searchCount || 0;
    let finalWindowStart = ipWindowStart;
    let finalResetAt = new Date(ipWindowStart.getTime() + windowMs);

    // If user limit exists, merge them (take the higher count and earlier window start)
    if (userLimit.Item) {
      const userItem = userLimit.Item as RateLimitInfo;
      const userWindowStart = new Date(userItem.windowStart);
      const userElapsed = now.getTime() - userWindowStart.getTime();

      // If user window hasn't expired
      if (userElapsed < windowMs) {
        const userSearchCount = userItem.searchCount || 0;
        
        // Take the higher count
        finalSearchCount = Math.max(finalSearchCount, userSearchCount);
        
        // Take the earlier window start (more restrictive)
        if (userWindowStart < ipWindowStart) {
          finalWindowStart = userWindowStart;
          finalResetAt = new Date(userWindowStart.getTime() + windowMs);
        }
      }
    }

    // Update user limit with merged data
    const ttl = Math.floor(finalResetAt.getTime() / 1000) + 3600;
    await db.send(
      new PutCommand({
        TableName: TABLES.RATE_LIMITS,
        Item: {
          userId,
          searchCount: finalSearchCount,
          windowStart: finalWindowStart.toISOString(),
          resetAt: finalResetAt.toISOString(),
          ttl,
        },
      })
    );

    // Delete IP-based record
    await db.send(
      new DeleteCommand({
        TableName: TABLES.RATE_LIMITS,
        Key: { userId: ipUserId },
      })
    );

    logger.debug(`[Rate Limit Merge] Merged IP ${ipAddress} rate limit to user ${userId}: ${finalSearchCount} searches`);
  } catch (error) {
    logger.error('[Rate Limit Merge] Error merging rate limit data:', error);
    // Don't throw - merging is best effort
  }
}

// Email subscription operations
export async function subscribeEmail(email: string, source?: string): Promise<void> {
  const db = await getDynamoDB();
  await db.send(
    new PutCommand({
      TableName: TABLES.EMAIL_SUBSCRIPTIONS,
      Item: {
        email: email.toLowerCase().trim(),
        subscribedAt: new Date().toISOString(),
        source: source || 'homepage',
      },
    })
  );
}

export async function getEmailSubscription(email: string): Promise<EmailSubscription | null> {
  const db = await getDynamoDB();
  const result = await db.send(
    new GetCommand({
      TableName: TABLES.EMAIL_SUBSCRIPTIONS,
      Key: { email: email.toLowerCase().trim() },
    })
  );
  return result.Item as EmailSubscription || null;
}

export async function unsubscribeEmail(email: string): Promise<void> {
  const db = await getDynamoDB();
  await db.send(
    new DeleteCommand({
      TableName: TABLES.EMAIL_SUBSCRIPTIONS,
      Key: { email: email.toLowerCase().trim() },
    })
  );
}

export default getDynamoDB;
