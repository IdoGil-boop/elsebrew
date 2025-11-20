# AWS Deployment Guide - Elsebrew

This guide walks you through deploying Elsebrew to AWS Amplify.

## Prerequisites

- AWS account
- Git repository (GitHub, GitLab, Bitbucket, or CodeCommit)
- All environment variables configured (see below)

## Step 1: Push to Git Repository

Make sure your code is pushed to a Git repository:

```bash
git add .
git commit -m "Prepare for AWS deployment"
git push origin main
```

## Step 2: Deploy via AWS Amplify Console

### Option A: Deploy via AWS Console (Recommended)

1. **Go to AWS Amplify Console**
   - Sign in to [AWS Console](https://console.aws.amazon.com/)
   - Navigate to **AWS Amplify** service
   - Click **"New app"** → **"Host web app"**

2. **Connect Repository**
   - Choose your Git provider (GitHub, GitLab, Bitbucket, or CodeCommit)
   - Authorize AWS Amplify to access your repository
   - Select your repository and branch (usually `main` or `master`)

3. **Configure Build Settings**
   - AWS Amplify should auto-detect Next.js from `amplify.yml`
   - Verify the build settings:
     - **Build command:** `npm run build`
     - **Output directory:** `.next`
   - If auto-detection fails, use these settings:
     ```yaml
     version: 1
     frontend:
       phases:
         preBuild:
           commands:
             - npm ci
         build:
           commands:
             - npm run build
       artifacts:
         baseDirectory: .next
         files:
           - '**/*'
     ```

4. **Add Environment Variables**
   Click **"Environment variables"** and add all required variables:

   **Required:**
   ```
   # Client-side key (for Maps JS API in browser)
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...

   # Server-side key (for Places API from Next.js API routes)
   GOOGLE_MAPS_API_KEY=AIzaSy...

   NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=123456789-abc...apps.googleusercontent.com
   OPENAI_API_KEY=sk-...

   # DynamoDB credentials
   DYNAMODB_ACCESS_KEY_ID=AKIA...
   DYNAMODB_SECRET_ACCESS_KEY=...
   DYNAMODB_REGION=us-east-1
   ```

   **Optional:**
   ```
   NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
   NEXT_PUBLIC_BUYMEACOFFEE_URL=https://www.buymeacoffee.com/yourname
   MAILCHIMP_FORM_ACTION=https://XXXXX.usX.list-manage.com/subscribe/post?u=...&id=...
   ```

5. **Review and Deploy**
   - Review settings
   - Click **"Save and deploy"**
   - Wait for build to complete (~5-10 minutes)

6. **Get Your URL**
   - After deployment, you'll get a URL like: `https://main.xxxxx.amplifyapp.com`
   - You can also set up a custom domain in Amplify settings

### Option B: Deploy via AWS CLI

1. **Install AWS CLI**
   ```bash
   # macOS
   brew install awscli
   
   # Or download from https://aws.amazon.com/cli/
   ```

2. **Configure AWS CLI**
   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Enter default region (e.g., us-east-1)
   # Enter default output format (json)
   ```

3. **Install Amplify CLI**
   ```bash
   npm install -g @aws-amplify/cli
   amplify configure
   ```

4. **Initialize Amplify**
   ```bash
   amplify init
   # Follow prompts:
   # - Project name: elsebrew
   # - Environment: production
   # - Default editor: your choice
   # - App type: javascript
   # - Framework: react
   # - Source directory: ./
   # - Distribution directory: .next
   # - Build command: npm run build
   # - Start command: npm start
   ```

5. **Add Hosting**
   ```bash
   amplify add hosting
   # Select: Hosting with Amplify Console
   # Select: Manual deployment
   ```

6. **Deploy**
   ```bash
   amplify publish
   ```

## Step 3: Update Google Cloud Settings

After deployment, update your Google Cloud API key restrictions:

1. **Google Maps API Key**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to APIs & Services → Credentials
   - Edit your API key
   - Under "Application restrictions" → "HTTP referrers", add:
     - `https://*.amplifyapp.com/*` (for Amplify default domain)
     - `https://yourdomain.com/*` (if using custom domain)

2. **Google OAuth Client ID**
   - Go to APIs & Services → Credentials
   - Edit your OAuth 2.0 Client ID
   - Under "Authorized JavaScript origins", add:
     - `https://your-amplify-app.amplifyapp.com`
     - `https://yourdomain.com` (if using custom domain)
   - Under "Authorized redirect URIs", add:
     - `https://your-amplify-app.amplifyapp.com`
     - `https://yourdomain.com` (if using custom domain)

## Step 4: Set Up Custom Domain (Optional)

1. In Amplify Console, go to **"Domain management"**
2. Click **"Add domain"**
3. Enter your domain name
4. Follow DNS configuration instructions
5. Wait for SSL certificate provisioning (~30 minutes)

## Step 5: Verify Deployment

1. Visit your Amplify URL
2. Test the search functionality
3. Verify Google Maps loads correctly
4. Test Google Sign-In
5. Check browser console for errors

## Troubleshooting

### Build Fails

- Check build logs in Amplify Console
- Verify all environment variables are set
- Ensure `package.json` has correct build script
- Check Node.js version (Amplify uses Node 18 by default)

### API Routes Not Working

- Verify environment variables are set (especially `OPENAI_API_KEY`)
- Check API route logs in Amplify Console
- Ensure API routes are in `app/api/` directory

### Google Maps Not Loading

- Verify `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
- Check API key restrictions include your Amplify domain
- Verify Maps JavaScript API is enabled in Google Cloud

### OAuth Not Working

- Verify `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` is set
- Check authorized origins include your Amplify domain
- Verify redirect URIs are configured correctly

## Cost Estimate

**AWS Amplify:**
- Free tier: 15 GB storage, 5 GB served per month
- After free tier: ~$0.15/GB served
- Estimated cost: $0-10/month for low traffic

**Other Services:**
- Google Maps: Free tier available, then pay-as-you-go
- OpenAI: Pay-as-you-go (~$0.0001 per search)

## Continuous Deployment

Amplify automatically deploys when you push to your connected branch. To disable:

1. Go to Amplify Console → App settings → Build settings
2. Edit build specification
3. Remove or comment out auto-deploy triggers

## Additional Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Next.js on Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/deploy-nextjs-app.html)
- [Amplify Console](https://console.aws.amazon.com/amplify/)

