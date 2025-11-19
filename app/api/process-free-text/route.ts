import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/openai';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    const { freeText } = await request.json();

    if (!freeText || typeof freeText !== 'string') {
      return NextResponse.json({ error: 'freeText is required' }, { status: 400 });
    }

    if (isDev) {
      console.log('🤖 [LLM] Processing free text:', freeText);
    }

    const startTime = Date.now();
    const client = getOpenAIClient();

    // First, detect language and translate to English if needed
    const detectAndTranslate = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a language detection and translation assistant.
If the user's text is NOT in English, translate it to English first.
If it's already in English, return it as-is.
Return ONLY the translated/English text, nothing else.`,
        },
        {
          role: 'user',
          content: freeText,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const translatedText = detectAndTranslate.choices[0].message.content?.trim() || freeText;

    if (isDev) {
      console.log('🌐 [Translation] Original:', freeText);
      console.log('🌐 [Translation] Translated:', translatedText);
    }

    // Use OpenAI to extract search keywords from translated free text
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that extracts search keywords for finding cafes.
Given user's free-form text describing what they want in a cafe, extract 3-5 relevant search keywords
that would be useful for finding matching cafes on Google Maps.

Focus on:
- Atmosphere (cozy, quiet, bright, etc.)
- Amenities (outdoor seating, wifi, etc.)
- Food/drink (pastries, specialty coffee, etc.)
- Style (modern, rustic, minimalist, etc.)

Return ONLY a JSON array of keywords in English, nothing else. Example: ["outdoor seating", "pastries", "quiet"]`,
        },
        {
          role: 'user',
          content: translatedText,
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const duration = Date.now() - startTime;
    const content = completion.choices[0].message.content?.trim() || '[]';

    if (isDev) {
      console.log('🤖 [LLM] OpenAI Response:', {
        model: 'gpt-4o-mini',
        duration: `${duration}ms`,
        tokens: completion.usage?.total_tokens,
        response: content,
      });
    }

    // Parse the JSON array
    let keywords: string[] = [];
    try {
      keywords = JSON.parse(content);
      if (!Array.isArray(keywords)) {
        if (isDev) console.error('❌ [LLM] Response is not an array:', content);
        keywords = [];
      }
    } catch (e) {
      if (isDev) console.error('❌ [LLM] Failed to parse OpenAI response:', content);
      keywords = [];
    }

    if (isDev) {
      console.log('✅ [LLM] Extracted keywords:', keywords);
    }

    return NextResponse.json({ keywords });
  } catch (error) {
    if (isDev) console.error('❌ [LLM] Error processing free text:', error);
    return NextResponse.json({ error: 'Failed to process free text' }, { status: 500 });
  }
}
