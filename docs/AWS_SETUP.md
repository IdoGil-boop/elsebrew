# AWS DynamoDB Setup (Optional)

## Current Status
✅ **Save All works with localStorage fallback**

The AWS credentials in your `.env.local` are currently invalid, so the app automatically falls back to localStorage. This means:
- ✅ Save All works immediately
- ✅ Cafes saved locally in browser
- ❌ No cross-device sync (yet)

## The AWS Credentials Issue

Your `.env.local` has these credentials (example - replace with your own):
```
AWS_ACCESS_KEY_ID=AKIA... (your access key)
AWS_SECRET_ACCESS_KEY=... (your secret key)
```

These credentials are returning this error:
```
UnrecognizedClientException: The security token included in the request is invalid.
```

This means either:
1. The credentials are wrong/expired
2. The IAM user was deleted
3. The IAM user doesn't have DynamoDB permissions

## Option 1: Use localStorage Only (Current Setup)

**No action needed!** The app already works with localStorage:
- Sign in → Save All → Cafes saved locally
- Fast and simple
- No AWS costs
- No cross-device sync

## Option 2: Fix AWS Setup (For Cross-Device Sync)

If you want cross-device sync, you need valid AWS credentials:

### Step 1: Create New IAM User

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click "Users" → "Create user"
3. Username: `elsebrew-app`
4. Select "Access key - Programmatic access"
5. Click "Next"

### Step 2: Attach DynamoDB Permissions

1. Click "Attach policies directly"
2. Search for `AmazonDynamoDBFullAccess`
3. Check the box
4. Click "Next" → "Create user"

### Step 3: Save Credentials

1. After user created, click "Create access key"
2. Choose "Application running outside AWS"
3. Copy the Access Key ID and Secret Access Key
4. **Save these somewhere safe - you can't view the secret again!**

### Step 4: Update .env.local

Replace the values in `.env.local`:
```bash
AWS_ACCESS_KEY_ID=AKIA... (your new key)
AWS_SECRET_ACCESS_KEY=... (your new secret)
AWS_REGION=us-east-1
```

### Step 5: Create DynamoDB Tables

```bash
npm run setup-db
```

You should see:
```
✓ Created table: elsebrew-users
✓ Created table: elsebrew-saved-places
✓ Created table: elsebrew-search-history
All tables created successfully!
```

### Step 6: Restart Dev Server

```bash
# Stop the server (Ctrl+C)
npm run dev
```

Now Save All will use DynamoDB for cross-device sync!

## Option 3: Remove AWS Credentials (Simplest)

If you don't need cross-device sync, just remove the invalid credentials:

Edit `.env.local`:
```bash
# AWS DynamoDB Configuration (Optional - remove if not using)
# AWS_ACCESS_KEY_ID=your_aws_access_key_here
# AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
# AWS_REGION=us-east-1
```

This will make the app skip AWS checks entirely and use localStorage directly.

## Current Behavior

Right now, when you click "Save All":

1. ✅ API receives request with valid JWT token
2. ✅ API verifies authentication
3. ⚠️  API tries to use DynamoDB with invalid credentials
4. ✅ API catches the error and returns `localStorage: true`
5. ✅ Client saves cafes to localStorage
6. ✅ Success toast appears
7. ✅ Cafes visible in `/saved` page

**So everything works, just without cross-device sync!**

## Recommendation

**For now: Just use localStorage (Option 3 - comment out the credentials)**

This gives you:
- ✅ Working Save All feature
- ✅ No AWS costs
- ✅ Simpler setup
- ✅ Faster development

**Later: Set up AWS when you need cross-device sync (Option 2)**

Only do this if you actually need users to access saved cafes from multiple devices.

## Testing Save All Now

With the current setup (localStorage fallback), test it:

1. Start dev server: `npm run dev`
2. Sign in with Google
3. Run a search
4. Click "Save All"
5. You should see: "Successfully saved 2 cafés!"
6. Go to `/saved` page
7. Your cafes should be there!

The app now gracefully handles AWS errors and falls back to localStorage automatically.
