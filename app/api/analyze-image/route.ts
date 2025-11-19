import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/openai';

// Simple in-memory cache (expires after 1 hour)
const cache = new Map<string, { analysis: string; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Check cache
    const cached = cache.get(imageUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ analysis: cached.analysis });
    }

    // Analyze the image with GPT-4 Vision
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this cafe photo and describe its style, ambiance, and vibe in 2-3 descriptive words or short phrases. Focus on the most prominent characteristics like: minimalist, cozy, industrial, vintage, modern, rustic, bright, intimate, spacious, plant-filled, art-filled, etc. Be specific and concise. Return ONLY the comma-separated descriptive words/phrases, nothing else.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 50,
    });

    const analysis = response.choices[0]?.message?.content || '';

    // Cache the result
    cache.set(imageUrl, { analysis, timestamp: Date.now() });

    // Clean old cache entries
    if (cache.size > 200) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { analysis: '' },
      { status: 200 } // Return empty analysis instead of error
    );
  }
}

export const runtime = 'nodejs';
