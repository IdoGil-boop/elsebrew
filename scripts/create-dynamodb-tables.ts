import { config } from 'dotenv';
import { resolve } from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

const client = new DynamoDBClient({
  region: process.env.DYNAMODB_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.DYNAMODB_ACCESS_KEY_ID!,
    secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY!,
  },
});

const TABLES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || 'elsebrew-users',
  SAVED_PLACES: process.env.DYNAMODB_SAVED_PLACES_TABLE || 'elsebrew-saved-places',
  SEARCH_HISTORY: process.env.DYNAMODB_SEARCH_HISTORY_TABLE || 'elsebrew-search-history',
  PLACE_INTERACTIONS: process.env.DYNAMODB_PLACE_INTERACTIONS_TABLE || 'elsebrew-place-interactions',
  RATE_LIMITS: process.env.DYNAMODB_RATE_LIMITS_TABLE || 'elsebrew-rate-limits',
  EMAIL_SUBSCRIPTIONS: process.env.DYNAMODB_EMAIL_SUBSCRIPTIONS_TABLE || 'elsebrew-email-subscriptions',
};

async function tableExists(tableName: string): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    return false;
  }
}

async function createUsersTable() {
  const tableName = TABLES.USERS;

  if (await tableExists(tableName)) {
    console.log(`✓ Table ${tableName} already exists`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST', // On-demand pricing
    })
  );
  console.log(`✓ Created table ${tableName}`);
}

async function createSavedPlacesTable() {
  const tableName = TABLES.SAVED_PLACES;

  if (await tableExists(tableName)) {
    console.log(`✓ Table ${tableName} already exists`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'placeId', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'placeId', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
  console.log(`✓ Created table ${tableName}`);
}

async function createSearchHistoryTable() {
  const tableName = TABLES.SEARCH_HISTORY;

  if (await tableExists(tableName)) {
    console.log(`✓ Table ${tableName} already exists`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'searchId', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'searchId', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
  console.log(`✓ Created table ${tableName}`);
}

async function createPlaceInteractionsTable() {
  const tableName = TABLES.PLACE_INTERACTIONS;

  if (await tableExists(tableName)) {
    console.log(`✓ Table ${tableName} already exists`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'placeId', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'placeId', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
  console.log(`✓ Created table ${tableName}`);
}

async function createRateLimitsTable() {
  const tableName = TABLES.RATE_LIMITS;

  if (await tableExists(tableName)) {
    console.log(`✓ Table ${tableName} already exists`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
      // Note: TTL is enabled via the table's TimeToLiveSpecification after creation
      // or can be set via AWS Console. The ttl attribute will be automatically cleaned up.
    })
  );
  console.log(`✓ Created table ${tableName}`);
  console.log(`  Note: Enable TTL on the 'ttl' attribute via AWS Console for automatic cleanup`);
}

async function createEmailSubscriptionsTable() {
  const tableName = TABLES.EMAIL_SUBSCRIPTIONS;

  if (await tableExists(tableName)) {
    console.log(`✓ Table ${tableName} already exists`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
  console.log(`✓ Created table ${tableName}`);
}

async function main() {
  console.log('Creating DynamoDB tables...\n');

  try {
    await createUsersTable();
    await createSavedPlacesTable();
    await createSearchHistoryTable();
    await createPlaceInteractionsTable();
    await createRateLimitsTable();
    await createEmailSubscriptionsTable();

    console.log('\n✓ All tables created successfully!');
    console.log('\nNote: Tables may take a few seconds to become active.');
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  }
}

main();
