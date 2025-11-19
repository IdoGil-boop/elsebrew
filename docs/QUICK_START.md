# Quick Start - AWS Setup

## ⚡ 5-Minute Setup

### Step 1: Get AWS Credentials (2 min)

1. Open [AWS IAM Console](https://console.aws.amazon.com/iam/home#/users$new)
2. Create user: `elsebrew-db`
3. Attach policy: `AmazonDynamoDBFullAccess`
4. Create access key → Copy both keys

### Step 2: Update .env.local (1 min)

```bash
# Replace these lines in .env.local:
AWS_ACCESS_KEY_ID=AKIA...your_key...
AWS_SECRET_ACCESS_KEY=...your_secret...
AWS_REGION=us-east-1
```

### Step 3: Create Tables (1 min)

```bash
npm run setup-db
```

Expected output:
```
✓ Created table elsebrew-users
✓ Created table elsebrew-saved-places
✓ Created table elsebrew-search-history
✓ All tables created successfully!
```

### Step 4: Update Google Sign-In (1 min)

In [components/auth/GoogleSignIn.tsx](components/auth/GoogleSignIn.tsx), find where you save the profile and add the token:

```typescript
storage.setUserProfile({
  email: decoded.email,
  name: decoded.name,
  picture: decoded.picture,
  token: response.credential, // ← ADD THIS LINE
});
```

### Step 5: Test (30 sec)

```bash
npm run dev
```

1. Go to http://localhost:3000
2. Add 2 cafes → See chips appear ✅
3. Add free text: "quiet, outdoor seating" ✅
4. Search → Results load ✅
5. Click "Save All" → Success! ✅
6. Click "I missed your vibe?" → Modal opens ✅

---

## 🎯 New Features Available

| Feature | Where | How to Use |
|---------|-------|------------|
| **Multiple Cafes** | Home page | Add cafes one by one, they appear as chips |
| **Free Text** | Home page | "Additional preferences" textarea |
| **Save All** | Results page | Header button (requires sign-in) |
| **Refine Search** | Results page | "I missed your vibe?" button |
| **Analytics** | Auto-tracked | Check browser console in dev mode |

---

## 📊 Verify Setup

### Check DynamoDB Tables:
https://console.aws.amazon.com/dynamodb/home?region=us-east-1#tables:

Should see:
- ✓ elsebrew-users
- ✓ elsebrew-saved-places
- ✓ elsebrew-search-history

### Check Analytics Events:
Open browser console → Run search → Should see:
```
[Analytics] search_submit { source_city: "...", multi_cafe: true, has_free_text: true }
[Analytics] results_loaded { candidate_count: 2, latency_ms: 5234 }
```

---

## 🚨 Troubleshooting

| Error | Solution |
|-------|----------|
| `AccessDeniedException` | Check AWS credentials in .env.local |
| `ResourceNotFoundException` | Run `npm run setup-db` |
| `Unauthorized (401)` on Save All | Update GoogleSignIn.tsx to include token |
| Free text not working | Verify OPENAI_API_KEY in .env.local |
| Modal not opening | Check browser console for React errors |

---

## 💰 Costs

- DynamoDB: ~$2/month (1K users)
- OpenAI: ~$0.30/month (100 requests/day)
- **Total: ~$2.50/month**

---

## 📖 Full Docs

- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - What was built
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Detailed setup instructions

---

**Questions?** Check the IMPLEMENTATION_SUMMARY.md or test each feature using the checklist above.
