import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

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

export default getDynamoDB;
