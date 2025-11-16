import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const systemPrompt = `You are Elsebrew, an AI that matches coffee shops based on their characteristics, vibe, community reputation, and visual aesthetics.

Your job is to create compelling, personality-rich explanations of why cafés match a source café.

CRITICAL REQUIREMENTS:
1. Generate ${candidates.length} UNIQUE descriptions, one for each café listed
2. Each description MUST be distinctly different from the others
3. Each description MUST start with a DIFFERENT short, punchy descriptor (3-5 words max)
4. Vary your approach for each café - emphasize different aspects (ambiance, community, quality, location, style, etc.)

FORMAT for each description:
- First sentence: A SHORT, punchy descriptor that captures the café's MOST DOMINANT characteristic
- Following sentences: Explain the match using multiple data sources
- Total length: 2-3 sentences maximum per café
- Be specific and avoid generic fluff

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
      const redditInsights = candidate.redditData?.totalMentions > 0
        ? `Reddit: ${candidate.redditData.totalMentions} mentions (${
            candidate.redditData.averageScore > 10 ? 'highly praised' :
            candidate.redditData.averageScore > 5 ? 'well-liked' : 'discussed'
          }). `
        : '';

      return `
CAFÉ ${index + 1}: ${candidate.name}
Rating: ${candidate.rating || 'N/A'}/5 (${candidate.user_ratings_total || 0} reviews)
Price: ${candidate.price_level ? '$'.repeat(candidate.price_level) : 'N/A'}
${candidate.editorial_summary ? `Google: ${candidate.editorial_summary}` : ''}
${candidate.imageAnalysis ? `Visual style: ${candidate.imageAnalysis}` : ''}
${redditInsights}
Matched attributes: ${candidate.keywords?.join(', ') || 'Similar quality'}
`;
    }).join('\n---\n');

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
    const completion = await openai.chat.completions.create({
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
      console.error('Failed to parse OpenAI response:', err);
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
    console.error('Error generating batch reasoning:', error);
    // Return default reasonings based on number of candidates
    const body = await request.json();
    const defaultReasoning = Array(body.candidates?.length || 1).fill('Similar atmosphere and quality.');
    return NextResponse.json(
      { reasonings: defaultReasoning },
      { status: 200 }
    );
  }
}

export const runtime = 'nodejs';
