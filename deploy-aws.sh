#!/bin/bash

# Quick AWS Amplify Deployment Helper
# This script helps you prepare for AWS Amplify deployment

echo "🚀 Elsebrew AWS Deployment Helper"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "❌ Git not initialized. Run: git init"
    exit 1
fi

# Check if code is committed
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if amplify.yml exists
if [ ! -f amplify.yml ]; then
    echo "❌ amplify.yml not found!"
    exit 1
fi

echo "✅ amplify.yml found"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Push your code to Git:"
echo "   git add ."
echo "   git commit -m 'Prepare for AWS deployment'"
echo "   git push origin main"
echo ""
echo "2. Go to AWS Amplify Console:"
echo "   https://console.aws.amazon.com/amplify/"
echo ""
echo "3. Click 'New app' → 'Host web app'"
echo ""
echo "4. Connect your Git repository"
echo ""
echo "5. Add environment variables in Amplify Console:"
echo "   - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (client-side, for Maps JS API)"
echo "   - GOOGLE_MAPS_API_KEY (server-side, for Places API)"
echo "   - NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID"
echo "   - OPENAI_API_KEY"
echo "   - DYNAMODB_ACCESS_KEY_ID"
echo "   - DYNAMODB_SECRET_ACCESS_KEY"
echo "   - DYNAMODB_REGION"
echo "   - (Optional) NEXT_PUBLIC_GA4_MEASUREMENT_ID"
echo "   - (Optional) NEXT_PUBLIC_BUYMEACOFFEE_URL"
echo "   - (Optional) MAILCHIMP_FORM_ACTION"
echo ""
echo "6. Deploy!"
echo ""
echo "📖 See AWS_DEPLOYMENT.md for detailed instructions"
echo ""

