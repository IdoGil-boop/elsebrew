# AWS Credentials Setup

## Overview

The app uses AWS DynamoDB for storing user data (saved places, search history). As of the latest update, we've simplified the credential management to use **environment variables only**.

## Environment Variables

Set these in your deployment platform (Vercel, AWS Amplify, etc.):

```bash
DYNAMODB_ACCESS_KEY_ID=AKIA...           # Your AWS access key (starts with AKIA or ASIA)
DYNAMODB_SECRET_ACCESS_KEY=...           # Your AWS secret key
DYNAMODB_REGION=us-east-1                # AWS region (optional, defaults to us-east-1)
```

**Note:** We use the `DYNAMODB_` prefix instead of `AWS_` because some platforms (like AWS Amplify) block environment variables starting with `AWS_` as they reserve that prefix for their internal use.

## What Changed

**Previous approach:** The app tried to use AWS Secrets Manager first, then fell back to environment variables. This required additional IAM permissions and was causing "The security token included in the request is invalid" errors.

**Current approach:** Direct environment variables only. Simpler, more reliable, and works out of the box.

## Deployment Instructions

### Vercel
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add the three AWS variables above
4. Redeploy

### AWS Amplify
1. Go to your app in Amplify console
2. Click "Environment variables" in the left menu
3. Add the three AWS variables as **Secrets** (not plain variables)
4. Save and redeploy

## Local Development

Add to your `.env.local`:

```bash
DYNAMODB_ACCESS_KEY_ID=AKIA...
DYNAMODB_SECRET_ACCESS_KEY=...
DYNAMODB_REGION=us-east-1
```

## Fallback Behavior

If AWS credentials are not configured or invalid, the app will automatically fall back to localStorage for saving places. Users will see a notice that their saved places are stored locally only.

## Security Notes

- Never commit `.env.local` to version control
- Use IAM users with minimal permissions (DynamoDB access only)
- Rotate credentials periodically
- In production, use your hosting platform's secret management features
