import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/openai';
import { logger } from '@/lib/logger';

// Simple in-memory cache (expires after 5 minutes)
const cache = new Map<string, { reasonings: string[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, candidates, city, vibes } = body;

    // Generate cache key based on all cafe names
    const cacheKey = `${source.name}:${candidates.map((c: any) => c.name).join(',')}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ reasonings: cached.reasonings });
    }

    // Build the enhanced system prompt
    const systemPrompt = `You are Elsebrew, an AI that matches coffee shops based on their characteristics, vibe, community reputation, visual aesthetics, and place type similarities.

Your job is to create compelling, personality-rich explanations of why cafés match a source café.

CRITICAL REQUIREMENTS:
1. Generate ${candidates.length} UNIQUE descriptions, one for each café listed
2. Each description MUST be distinctly different from the others
3. Each description MUST start with a DIFFERENT short, punchy descriptor (3-5 words max)
4. Vary your approach for each café - emphasize different aspects (ambiance, community, quality, location, style, amenities, etc.)
5. Naturally synthesize ALL the data provided - don't just list features, weave them into compelling narratives
6. When multiple characteristics are listed, pick the most distinctive ones that set this café apart

FORMAT for each description:
- First sentence: A SHORT, punchy descriptor that captures the café's MOST DOMINANT characteristic
- Following sentences: Weave together the data into a natural, flowing explanation - mention the most compelling amenities, aesthetic, community reputation, or unique features
- Total length: 2-3 sentences maximum per café
- Be specific and avoid generic fluff
- NEVER use labels like "Amenities:" or "Serves:" - instead naturally incorporate features into sentences

VARIETY IS ESSENTIAL:
- Use different starting phrases for each café
- Emphasize different strengths for each (one focuses on Reddit buzz, another on visual style, another on ratings, etc.)
- Vary sentence structure and tone
- Make each description feel unique and specific to that café

Examples of DIVERSE starting phrases:
- "Hip third-wave spot"
- "Known among coffee enthusiasts"
- "Industrial-chic neighborhood gem"
- "Bright, Instagram-worthy space"
- "Local favorite with loyal following"
- "Minimalist specialty coffee bar"
- "Cozy community gathering spot"
- "High-rated artisanal roastery"

Return ONLY a JSON array of ${candidates.length} description strings, nothing else.`;

    // Build candidate descriptions
    const candidatesText = candidates.map((candidate: any, index: number) => {
      const parts: string[] = [`CAFÉ ${index + 1}: ${candidate.name}`];

      // Rating and reviews
      if (candidate.rating) {
        parts.push(`${candidate.rating}/5 stars from ${candidate.user_ratings_total || 0} reviews`);
      }

      // Price level
      if (candidate.price_level) {
        parts.push(`Price range: ${candidate.price_level ? '$'.repeat(candidate.price_level) : 'N/A'}`);
      }

      // Editorial summary
      if (candidate.editorial_summary) {
        parts.push(candidate.editorial_summary);
      }

      // Visual style
      if (candidate.imageAnalysis) {
        parts.push(`Aesthetic: ${candidate.imageAnalysis}`);
      }

      // Reddit community insights
      if (candidate.redditData?.totalMentions > 0) {
        const sentiment = candidate.redditData.averageScore > 10 ? 'highly praised' :
                         candidate.redditData.averageScore > 5 ? 'well-liked' : 'discussed';
        parts.push(`${candidate.redditData.totalMentions} community mentions, ${sentiment}`);
      }

      // Type overlap (naturalistically)
      if (candidate.typeOverlapDetails) {
        parts.push(candidate.typeOverlapDetails);
      }

      // Amenities & Atmosphere (natural list for LLM to interpret)
      const features: string[] = [];

      // Space & Setting
      if (candidate.outdoorSeating) features.push('has outdoor seating');
      if (candidate.goodForGroups) features.push('good for groups');
      if (candidate.goodForChildren) features.push('family-friendly');
      if (candidate.allowsDogs) features.push('welcomes dogs');
      if (candidate.liveMusic) features.push('features live music');
      if (candidate.goodForWatchingSports) features.push('great for watching sports');

      // Service Options
      if (candidate.dineIn) features.push('offers dine-in');
      if (candidate.takeout) features.push('takeout available');
      if (candidate.delivery) features.push('delivers');
      if (candidate.reservable) features.push('takes reservations');

      // Food & Drink Offerings
      if (candidate.servesBreakfast) features.push('serves breakfast');
      if (candidate.servesBrunch) features.push('serves brunch');
      if (candidate.servesLunch) features.push('serves lunch');
      if (candidate.servesDinner) features.push('serves dinner');
      if (candidate.servesCoffee) features.push('specialty coffee');
      if (candidate.servesBeer) features.push('serves beer');
      if (candidate.servesWine) features.push('serves wine');
      if (candidate.servesVegetarianFood) features.push('vegetarian-friendly');

      // Add all features as a natural sentence fragment
      if (features.length > 0) {
        parts.push(features.join(', '));
      }

      return parts.join('\n');
    }).join('\n\n---\n\n');

    // Build user preferences text
    const vibePreferences = vibes ? Object.entries(vibes)
      .filter(([_, value]) => value)
      .map(([key]) => {
        const vibeMap: Record<string, string> = {
          roastery: 'Roastery (on-site roasting)',
          lightRoast: 'Light roast / third-wave coffee',
          laptopFriendly: 'Laptop-friendly workspace',
          nightOwl: 'Open late night',
          cozy: 'Cozy atmosphere',
          minimalist: 'Minimalist aesthetic',
        };
        return vibeMap[key] || key;
      })
      .join(', ') : '';

    const userPrompt = `Source café: ${source.name}
Rating: ${source.rating || 'N/A'}/5
Price: ${source.price_level ? '$'.repeat(source.price_level) : 'N/A'}
Location: ${city || 'Unknown'}
${vibePreferences ? `User preferences: ${vibePreferences}` : ''}

IMPORTANT: When describing matches, consider the user's preferences (${vibePreferences || 'general quality match'}). If they want "Open late night", emphasize extended hours. If they want "Laptop-friendly", mention workspace amenities. Match the vibe preferences to the café characteristics.

Here are ${candidates.length} candidate cafés to match. Create a UNIQUE, DIVERSE description for EACH ONE:

${candidatesText}

Return a JSON array of ${candidates.length} strings, where each string is a complete, unique description. Make each one DIFFERENT from the others.`;

    // Call OpenAI API
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.9, // Higher temperature for more variety
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content || '{}';
    let reasonings: string[] = [];

    try {
      const parsed = JSON.parse(responseContent);
      // Handle different possible JSON structures
      if (Array.isArray(parsed)) {
        reasonings = parsed;
      } else if (parsed.descriptions && Array.isArray(parsed.descriptions)) {
        reasonings = parsed.descriptions;
      } else if (parsed.reasonings && Array.isArray(parsed.reasonings)) {
        reasonings = parsed.reasonings;
      } else {
        // Extract first array found in the response
        const firstArray = Object.values(parsed).find(v => Array.isArray(v));
        reasonings = firstArray as string[] || [];
      }
    } catch (err) {
      logger.error('[Reason Batch] Failed to parse OpenAI response:', err);
    }

    // Fallback: If we didn't get enough reasonings, fill with defaults
    while (reasonings.length < candidates.length) {
      reasonings.push('Similar vibe and quality.');
    }

    // Cache the result
    cache.set(cacheKey, { reasonings, timestamp: Date.now() });

    // Clean old cache entries
    if (cache.size > 100) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json({ reasonings });
  } catch (error) {
    logger.error('[Reason Batch] Error generating batch reasoning:', error);
    // Return default reasonings based on number of candidates
    try {
      const body = await request.json();
      const defaultReasoning = Array(body.candidates?.length || 1).fill('Similar atmosphere and quality.');
      return NextResponse.json(
        { reasonings: defaultReasoning },
        { status: 200 }
      );
    } catch (parseError) {
      logger.error('[Reason Batch] Failed to parse request body in error handler:', parseError);
      return NextResponse.json(
        { reasonings: ['Similar atmosphere and quality.'] },
        { status: 200 }
      );
    }
  }
}

export const runtime = 'nodejs';
