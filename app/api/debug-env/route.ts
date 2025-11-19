import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  // Return info about what env vars are available
  const envInfo = {
    hasDynamoDBAccessKey: !!process.env.DYNAMODB_ACCESS_KEY_ID,
    hasDynamoDBSecretKey: !!process.env.DYNAMODB_SECRET_ACCESS_KEY,
    hasDynamoDBRegion: !!process.env.DYNAMODB_REGION,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,

    // Show prefixes (safe to show)
    dynamodbAccessKeyPrefix: process.env.DYNAMODB_ACCESS_KEY_ID?.substring(0, 8) || 'NOT_SET',
    dynamodbRegion: process.env.DYNAMODB_REGION || 'NOT_SET',

    // List all env var names (not values) that start with DYNAMODB or OPENAI
    availableEnvVars: Object.keys(process.env).filter(key =>
      key.startsWith('DYNAMODB_') || key.startsWith('OPENAI_')
    ),
  };

  return NextResponse.json(envInfo);
}
