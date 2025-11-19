import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Lazy initialization of DynamoDB client
let dynamoDB: DynamoDBDocumentClient | null = null;

function getDynamoDB(): DynamoDBDocumentClient {
  if (!dynamoDB) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local');
    }

    const client = new DynamoDBClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    dynamoDB = DynamoDBDocumentClient.from(client);
  }

  return dynamoDB;
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
  const result = await getDynamoDB().send(
    new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId },
    })
  );
  return result.Item as UserProfile || null;
}

export async function createOrUpdateUser(user: UserProfile): Promise<void> {
  await getDynamoDB().send(
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
  const result = await getDynamoDB().send(
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
  await getDynamoDB().send(
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
  await getDynamoDB().send(
    new DeleteCommand({
      TableName: TABLES.SAVED_PLACES,
      Key: { userId, placeId },
    })
  );
}

// Search history operations
export async function getSearchHistory(userId: string, limit = 20): Promise<SearchHistoryItem[]> {
  const result = await getDynamoDB().send(
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
  await getDynamoDB().send(
    new PutCommand({
      TableName: TABLES.SEARCH_HISTORY,
      Item: history,
    })
  );
}

export async function getSearchState(userId: string, searchId: string): Promise<SearchHistoryItem | null> {
  const result = await getDynamoDB().send(
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

  await getDynamoDB().send(
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
  const existing = await getDynamoDB().send(
    new GetCommand({
      TableName: TABLES.PLACE_INTERACTIONS,
      Key: { userId, placeId },
    })
  );

  if (existing.Item) {
    // Update existing record
    const item = existing.Item as PlaceInteraction;
    await getDynamoDB().send(
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
    await getDynamoDB().send(
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

  const existing = await getDynamoDB().send(
    new GetCommand({
      TableName: TABLES.PLACE_INTERACTIONS,
      Key: { userId, placeId },
    })
  );

  if (existing.Item) {
    await getDynamoDB().send(
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
  const existing = await getDynamoDB().send(
    new GetCommand({
      TableName: TABLES.PLACE_INTERACTIONS,
      Key: { userId, placeId },
    })
  );

  if (existing.Item) {
    const { savedAt, ...rest } = existing.Item;
    await getDynamoDB().send(
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
  const result = await getDynamoDB().send(
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

    console.log(`[Migration] Migrating ${ipInteractions.length} interactions from IP ${ipAddress} to user ${userId}`);

    let migratedCount = 0;
    let errors = 0;

    // Get existing user interactions to avoid duplicates
    const userInteractions = await getPlaceInteractions(userId);
    const userPlaceIds = new Set(userInteractions.map(i => i.placeId));

    for (const ipInteraction of ipInteractions) {
      try {
        if (userPlaceIds.has(ipInteraction.placeId)) {
          // User already has this place interaction, merge view counts
          const userInteraction = userInteractions.find(i => i.placeId === ipInteraction.placeId);
          if (userInteraction) {
            await getDynamoDB().send(
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
          await getDynamoDB().send(
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
        await getDynamoDB().send(
          new DeleteCommand({
            TableName: TABLES.PLACE_INTERACTIONS,
            Key: { userId: ipAddress, placeId: ipInteraction.placeId },
          })
        );

        migratedCount++;
      } catch (error) {
        console.error(`[Migration] Error migrating place ${ipInteraction.placeId}:`, error);
        errors++;
      }
    }

    console.log(`[Migration] Complete: ${migratedCount} migrated, ${errors} errors`);
    return { migratedCount, errors };
  } catch (error) {
    console.error('[Migration] Failed to migrate anonymous data:', error);
    return { migratedCount: 0, errors: 1 };
  }
}

export default getDynamoDB;
