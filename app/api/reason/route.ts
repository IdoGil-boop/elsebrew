import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Lazy initialization of OpenAI client to avoid build-time errors
let openai: OpenAI | null = null;
function getOpenAIClient() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Simple in-memory cache (expires after 5 minutes)
const cache = new Map<string, { reasoning: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, candidate, keywords, redditData, imageAnalysis, city } = body;

    // Generate cache key
    const cacheKey = `${source.name}:${candidate.name}:${imageAnalysis || ''}:${redditData?.totalMentions || 0}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ reasoning: cached.reasoning });
    }

    // Extract personality insights from Reddit data
    let redditInsights = '';
    if (redditData && redditData.totalMentions > 0) {
      const topPosts = redditData.posts.slice(0, 3);
      const sentiment = redditData.averageScore > 10 ? 'highly praised' : redditData.averageScore > 5 ? 'well-liked' : 'discussed';

      const topics = topPosts.map((post: any) => post.title.toLowerCase()).join(' ');
      const hasLocalMention = topics.includes('local') || topics.includes('neighborhood') || topics.includes('hidden gem');
      const hasCoolMention = topics.includes('cool') || topics.includes('hip') || topics.includes('trendy');
      const hasQualityMention = topics.includes('best') || topics.includes('amazing') || topics.includes('excellent');

      redditInsights = `Reddit mentions: ${redditData.totalMentions} posts (${sentiment}). `;
      if (hasLocalMention) redditInsights += 'Known among locals. ';
      if (hasCoolMention) redditInsights += 'Considered hip/trendy. ';
      if (hasQualityMention) redditInsights += 'Praised for quality. ';
    }

    // Build enhanced prompt
    const systemPrompt = `You are Elsebrew, an AI that matches coffee shops based on their characteristics, vibe, community reputation, and visual aesthetics.

Your job is to create a compelling, personality-rich explanation of why a café matches another.

IMPORTANT FORMAT:
- First sentence: Start with a SHORT, punchy descriptor (3-5 words max) that captures the café's most dominant characteristic. Examples: "Cool cafe in hip neighborhood", "Known among locals", "Minimalist third-wave spot", "Cozy neighborhood favorite", "Industrial-chic roastery", "Bright, plant-filled space"
- Following sentences: Explain the match using multiple data sources: Google ratings, Reddit community sentiment, visual style from photos, reviewer personality types, years in business, location characteristics
- Total length: 2-3 sentences maximum
- Be specific and avoid generic fluff`;

    const userPrompt = `Source café: ${source.name}
${source.rating ? `Rating: ${source.rating}/5` : ''}
${source.price_level ? `Price level: ${'$'.repeat(source.price_level)}` : ''}

Candidate café: ${candidate.name}
${candidate.rating ? `Rating: ${candidate.rating}/5 (${candidate.user_ratings_total || 0} reviews)` : ''}
${candidate.price_level ? `Price level: ${'$'.repeat(candidate.price_level)}` : ''}
${candidate.editorial_summary ? `Google summary: ${candidate.editorial_summary}` : ''}
${imageAnalysis ? `Visual style: ${imageAnalysis}` : ''}
${redditInsights}
Matched attributes: ${keywords.join(', ') || 'Similar ratings'}
Location: ${city || 'Unknown'}

Create a compelling match description following the format rules above.`;

    // Call OpenAI API
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 150,
    });

    const reasoning = completion.choices[0]?.message?.content || 'Similar vibe and quality.';

    // Cache the result
    cache.set(cacheKey, { reasoning, timestamp: Date.now() });

    // Clean old cache entries (simple cleanup)
    if (cache.size > 100) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json({ reasoning });
  } catch (error) {
    console.error('Error generating reasoning:', error);
    return NextResponse.json(
      { reasoning: 'Similar atmosphere and quality.' },
      { status: 200 } // Return default reasoning instead of error
    );
  }
}

export const runtime = 'nodejs';
