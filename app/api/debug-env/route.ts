import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  // Return info about what env vars are available
  const allEnvKeys = Object.keys(process.env);
  const dynamoKeys = allEnvKeys.filter(k => k.startsWith('DYNAMODB_'));
  const openaiKeys = allEnvKeys.filter(k => k.includes('OPENAI') || k.includes('LLM'));
  const googleKeys = allEnvKeys.filter(k => k.includes('GOOGLE'));
  const paypalKeys = allEnvKeys.filter(k => k.includes('PAYPAL'));
  
  const envInfo = {
    hasDynamoDBAccessKey: !!process.env.DYNAMODB_ACCESS_KEY_ID,
    hasDynamoDBSecretKey: !!process.env.DYNAMODB_SECRET_ACCESS_KEY,
    hasDynamoDBRegion: !!process.env.DYNAMODB_REGION,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasGoogleMapsApiKey: !!process.env.GOOGLE_MAPS_API_KEY,
    hasPayPalPlanId: !!process.env.PAYPAL_PLAN_ID,
    hasPayPalClientId: !!process.env.PAYPAL_CLIENT_ID,
    hasPayPalClientSecret: !!process.env.PAYPAL_CLIENT_SECRET,
    hasPayPalEnvironment: !!process.env.PAYPAL_ENVIRONMENT,

    // Show prefixes (safe to show)
    dynamodbAccessKeyPrefix: process.env.DYNAMODB_ACCESS_KEY_ID?.substring(0, 8) || 'NOT_SET',
    dynamodbRegion: process.env.DYNAMODB_REGION || 'NOT_SET',
    googleMapsApiKeyPrefix: process.env.GOOGLE_MAPS_API_KEY?.substring(0, 10) || 'NOT_SET',
    paypalPlanId: process.env.PAYPAL_PLAN_ID || 'NOT_SET',
    paypalEnvironment: process.env.PAYPAL_ENVIRONMENT || 'NOT_SET',

    // List all env var names (not values) that start with relevant prefixes
    availableEnvVars: {
      dynamodb: dynamoKeys,
      openai: openaiKeys,
      google: googleKeys,
      paypal: paypalKeys,
    },
    
    // Diagnostic info
    totalEnvVarCount: allEnvKeys.length,
    awsRegion: process.env.AWS_REGION,
    nodeEnv: process.env.NODE_ENV,
    amplifyEnv: process.env.AMPLIFY_ENV,
    // Show first few env var names (for debugging, not values)
    sampleEnvKeys: allEnvKeys.slice(0, 30).filter(k => !k.includes('SECRET') && !k.includes('KEY')),
  };

  return NextResponse.json(envInfo);
}
