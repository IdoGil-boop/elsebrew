import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from './logger';

// Lazy initialization of DynamoDB client
let dynamoDB: DynamoDBDocumentClient | null = null;
let initializationError: Error | null = null;
let credentialsCache: { accessKeyId: string; secretAccessKey: string; region?: string } | null = null;
let initializationPromise: Promise<void> | null = null;

async function getCredentialsFromSecretsManager(): Promise<{ accessKeyId: string; secretAccessKey: string; region?: string } | null> {
  // Try multiple possible secret names/patterns
  const possibleSecretNames = [
    process.env.AWS_SECRETS_MANAGER_SECRET_NAME,
    'amplify/elsebrew/aws-credentials',
    'elsebrew/aws-credentials',
    'aws-credentials',
  ].filter(Boolean) as string[];
  
  const region = process.env.AWS_REGION || 'us-east-1';
  
  for (const secretName of possibleSecretNames) {
    try {
      // Use default credential chain (IAM role in Lambda, or env vars locally)
      const client = new SecretsManagerClient({
        region,
        // Don't specify credentials - let it use IAM role in Lambda or default chain
      });

      const response = await client.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );

      if (!response.SecretString) {
        continue;
      }

      const secret = JSON.parse(response.SecretString);
      const result = {
        accessKeyId: secret.AWS_ACCESS_KEY_ID || secret.accessKeyId,
        secretAccessKey: secret.AWS_SECRET_ACCESS_KEY || secret.secretAccessKey,
        region: secret.AWS_REGION || secret.region || region,
      };
      
      if (result.accessKeyId && result.secretAccessKey) {
        logger.debug('[DynamoDB] Found credentials in Secrets Manager', { secretName });
        return result;
      }
    } catch (error: any) {
      // If secret doesn't exist, try next name
      if (error.name === 'ResourceNotFoundException') {
        logger.debug(`[DynamoDB] Secret not found: ${secretName}, trying next...`);
        continue;
      }
      logger.debug(`[DynamoDB] Failed to get secret ${secretName}:`, error);
    }
  }
  
  return null;
}

async function getCredentials(): Promise<{ accessKeyId: string; secretAccessKey: string; region?: string }> {
  let accessKeyId: string | undefined;
  let secretAccessKey: string | undefined;
  let region: string | undefined;
  let source = 'unknown';

  // Use cached credentials if available
  if (credentialsCache) {
    accessKeyId = credentialsCache.accessKeyId;
    secretAccessKey = credentialsCache.secretAccessKey;
    region = credentialsCache.region;
    source = 'cache';
  } else {
    // Priority 1: Check environment variables first
    // Amplify Secrets are injected as environment variables at runtime
    accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    region = process.env.AWS_REGION;
    
    if (accessKeyId && secretAccessKey) {
      source = 'environment';
      // Cache for future use
      credentialsCache = { accessKeyId, secretAccessKey, region };
    } else {
      // Priority 2: Fall back to Secrets Manager (for custom setups)
      logger.debug('[DynamoDB] No env vars found, trying Secrets Manager');
      const secrets = await getCredentialsFromSecretsManager();
      if (secrets) {
        credentialsCache = secrets;
        accessKeyId = secrets.accessKeyId;
        secretAccessKey = secrets.secretAccessKey;
        region = secrets.region;
        source = 'secrets-manager';
      }
    }
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in Amplify Secrets (or environment variables)');
  }

  logger.debug('[DynamoDB] Using credentials', {
    source,
    hasAccessKey: !!accessKeyId,
    hasSecretKey: !!secretAccessKey,
    region: region || 'us-east-1',
    accessKeyPrefix: accessKeyId?.substring(0, 8) + '...',
  });

  return { accessKeyId, secretAccessKey, region };
}

export async function initializeDynamoDB(): Promise<void> {
  // If we previously failed to initialize, throw the same error
  if (initializationError) {
    throw initializationError;
  }

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
      const { accessKeyId, secretAccessKey, region: credRegion } = await getCredentials();
      const region = credRegion || process.env.AWS_REGION || 'us-east-1';

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
      logger.debug('[DynamoDB] Client initialized successfully');
    } catch (error: any) {
      initializationError = error as Error;
      logger.error('[DynamoDB] Failed to initialize client:', error);
      
      // If credentials are invalid, clear everything so we can retry with fresh credentials
      if (error?.name === 'UnrecognizedClientException' || 
          error?.__type === 'com.amazon.coral.service#UnrecognizedClientException') {
        logger.warn('[DynamoDB] Invalid credentials detected, clearing cache and error state');
        credentialsCache = null;
        dynamoDB = null;
        initializationError = null; // Clear error so we can retry
        initializationPromise = null; // Clear promise so we can retry
      }
      
      throw error;
    }
  })();

  await initializationPromise;
}

async function getDynamoDB(): Promise<DynamoDBDocumentClient> {
  // Check if credentials have changed (if we have cached credentials)
  const currentAccessKey = process.env.AWS_ACCESS_KEY_ID;
  if (credentialsCache && currentAccessKey && credentialsCache.accessKeyId !== currentAccessKey) {
    logger.debug('[DynamoDB] Credentials changed, clearing cache');
    credentialsCache = null;
    dynamoDB = null;
    initializationError = null;
    initializationPromise = null;
  }

  // If we previously failed to initialize, throw the same error
  if (initializationError) {
    throw initializationError;
  }

  // Ensure initialization
  if (!dynamoDB) {
    await initializeDynamoDB();
  }

  return dynamoDB!;
}

// Table names
export const TABLES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || 'elsebrew-users',
  SAVED_PLACES: process.env.DYNAMODB_SAVED_PLACES_TABLE || 'elsebrew-saved-places',
  SEARCH_HISTORY: process.env.DYNAMODB_SEARCH_HISTORY_TABLE || 'elsebrew-search-history',
  PLACE_INTERACTIONS: process.env.DYNAMODB_PLACE_INTERACTIONS_TABLE || 'elsebrew-place-interactions',
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
  }>;
  timestamp: string;
  // Pagination state
  allResults?: Array<{
    placeId: string;
    name: string;
    score: number;
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

export default getDynamoDB;
