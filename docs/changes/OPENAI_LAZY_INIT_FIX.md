# OpenAI Client Lazy Initialization Fix

## Problem

AWS Amplify build was failing with error:
```
Error: The OPENAI_API_KEY environment variable is missing or empty
```

## Root Cause

**Module-Level Instantiation:**
```typescript
// ❌ This runs at build time
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
```

When Next.js builds, it evaluates module-level code to statically analyze routes. The OpenAI client was being instantiated during build time, but `OPENAI_API_KEY` only exists at runtime (stored in AWS Secrets Manager, not in build environment).

## Solution

**Lazy Initialization Pattern:**
```typescript
// ✅ This runs at request time
let openai: OpenAI | null = null;

function getOpenAIClient() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

// Then in handler:
const client = getOpenAIClient();
const response = await client.chat.completions.create({...});
```

## Why This Works

### Build Time (Static Analysis)
- Module is imported but `getOpenAIClient()` is never called
- No OpenAI instantiation occurs
- No error about missing API key
- ✅ Build succeeds

### Runtime (API Request)
- User makes request to API endpoint
- Handler calls `getOpenAIClient()`
- Client is instantiated with API key from AWS Secrets Manager
- Client is cached in module-level variable for subsequent requests
- ✅ API works normally

## Files Updated

1. **[app/api/process-free-text/route.ts](app/api/process-free-text/route.ts)** - Free text keyword extraction
2. **[app/api/reason-batch/route.ts](app/api/reason-batch/route.ts)** - Batch reasoning generation
3. **[app/api/reason/route.ts](app/api/reason/route.ts)** - Single reasoning generation
4. **[app/api/analyze-image/route.ts](app/api/analyze-image/route.ts)** - Image analysis with GPT-4 Vision

## Commit

**Commit:** `732304d`
**Message:** "Fix build failure: Implement lazy OpenAI client initialization"

## Benefits

1. **Build Success** - No longer requires API key at build time
2. **Works with Secrets Manager** - API key accessed at runtime from AWS Secrets
3. **Zero Performance Impact** - Client cached after first use
4. **Standard Pattern** - Recommended approach for Next.js API routes with external clients
5. **Better Error Handling** - Runtime errors are catchable, build errors are blocking

## Trade-offs

### Pros ✅
- Separates build-time from runtime concerns
- Compatible with serverless environments
- Works with any secrets management system
- Client instance reused across requests (singleton pattern)

### Cons ⚠️
- Configuration errors discovered at runtime, not build time
- Slightly more verbose code (getter function)
- First request has ~1ms overhead to create client

## Alternatives Considered

### Option 1: Dummy Key for Build
```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build'
});
```
**Rejected:** Hides configuration errors, fails silently in production

### Option 2: Environment-Specific Init
```typescript
const openai = process.env.NODE_ENV === 'production'
  ? null
  : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```
**Rejected:** Different behavior in different environments, confusing

### Option 3: Lazy Init (Chosen) ✅
```typescript
function getOpenAIClient() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}
```
**Chosen:** Explicit, predictable, works everywhere

## Testing

### Local Build Test
```bash
npm run build
```
Should succeed even without `.env.local` file.

### Runtime Test
```bash
# Ensure .env.local has OPENAI_API_KEY
npm run dev

# Test API endpoint
curl -X POST http://localhost:3000/api/process-free-text \
  -H "Content-Type: application/json" \
  -d '{"freeText":"cozy cafe with wifi"}'
```

### AWS Amplify
1. Push to main branch
2. Amplify triggers build
3. Build phase: No OpenAI instantiation, succeeds ✅
4. Runtime: API requests create client with secrets ✅

## Related Documentation

- [Next.js API Routes Best Practices](https://nextjs.org/docs/api-routes/introduction)
- [AWS Amplify SSR Framework Support](https://docs.aws.amazon.com/amplify/latest/userguide/amplify-ssr-framework-support.html)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)

## Future Improvements

Consider adding:
1. **Health check endpoint** that validates OpenAI connection
2. **Monitoring/alerting** on OpenAI API failures
3. **Integration tests** that actually call OpenAI (in staging)
4. **Circuit breaker** pattern for OpenAI failures
