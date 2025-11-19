import { config } from 'dotenv';
import { resolve } from 'path';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

async function testCredentials() {
  const accessKeyId = process.env.DYNAMODB_ACCESS_KEY_ID;
  const secretAccessKey = process.env.DYNAMODB_SECRET_ACCESS_KEY;
  const region = process.env.DYNAMODB_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    console.error('❌ AWS credentials not found in environment variables');
    console.log('Make sure DYNAMODB_ACCESS_KEY_ID and DYNAMODB_SECRET_ACCESS_KEY are set');
    process.exit(1);
  }

  console.log('Testing AWS credentials...');
  console.log(`Access Key ID: ${accessKeyId.substring(0, 8)}...`);
  console.log(`Region: ${region}`);

  try {
    const client = new DynamoDBClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Try to list tables (requires minimal permissions)
    const result = await client.send(new ListTablesCommand({}));
    console.log('✅ Credentials are valid!');
    console.log(`Found ${result.TableNames?.length || 0} tables`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Credentials are invalid or insufficient permissions');
    console.error('Error:', error.message);
    if (error.name === 'UnrecognizedClientException') {
      console.error('\nThis means:');
      console.error('1. The access key ID is wrong');
      console.error('2. The secret access key is wrong');
      console.error('3. The IAM user was deleted');
      console.error('4. The access key was disabled');
    }
    process.exit(1);
  }
}

testCredentials();

