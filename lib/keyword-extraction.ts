import { PlaceBasicInfo, VibeToggles } from '@/types';
import { devLog } from './dev-logger';

/**
 * Extract relevant keywords from cafe reviews
 * This helps match cafes based on what people say about them in comments
 */
export async function extractKeywordsFromReviews(
  placeId: string,
  googleMaps: any
): Promise<string[]> {
  devLog.maps('Fetching reviews', { placeId });

  const google = googleMaps;
  const map = new google.maps.Map(document.createElement('div'));
  const service = new google.maps.places.PlacesService(map);

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: ['reviews'],
      },
      (place: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.reviews) {
          devLog.log('warning', 'No reviews found', { placeId, status });
          resolve([]);
          return;
        }

        devLog.log('info', `Found ${place.reviews.length} reviews`, { placeId });

        const keywords = extractKeywordsFromText(
          place.reviews.map(r => r.text).join(' ')
        );

        devLog.keywords('Review extraction', keywords);
        resolve(keywords);
      }
    );
  });
}

/**
 * Extract keywords from text using frequency analysis
 * Focus on coffee/cafe-related terms
 */
function extractKeywordsFromText(text: string): string[] {
  const lowerText = text.toLowerCase();

  // Relevant coffee/cafe keywords to look for
  const relevantTerms = [
    // Coffee types
    'espresso', 'cappuccino', 'latte', 'cortado', 'macchiato', 'americano',
    'pour over', 'filter', 'drip', 'cold brew', 'nitro',

    // Coffee quality
    'single origin', 'specialty', 'third wave', 'artisan', 'craft',
    'light roast', 'dark roast', 'medium roast',

    // Atmosphere
    'cozy', 'quiet', 'spacious', 'minimal', 'modern', 'rustic',
    'industrial', 'warm', 'bright', 'intimate',

    // Work-friendly
    'wifi', 'laptop', 'workspace', 'study', 'work', 'outlets',
    'co-working', 'meeting',

    // Food
    'pastries', 'croissant', 'sandwich', 'breakfast', 'lunch',
    'avocado toast', 'bagel', 'muffin',

    // Service & quality
    'friendly', 'knowledgeable', 'barista', 'roaster', 'roastery',
    'fresh', 'quality', 'excellent', 'amazing',

    // Ambiance
    'music', 'seating', 'outdoor', 'patio', 'garden', 'view',
    'late night', 'open late', 'early morning',
  ];

  const foundKeywords: string[] = [];

  for (const term of relevantTerms) {
    // Count occurrences
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = lowerText.match(regex);

    if (matches && matches.length >= 2) { // At least 2 mentions
      foundKeywords.push(term);
    }
  }

  // Return top 5 most relevant keywords
  return foundKeywords.slice(0, 5);
}

/**
 * Combine keywords from multiple origin cafes
 */
export async function extractKeywordsFromMultipleCafes(
  placesInfo: PlaceBasicInfo[],
  vibes: VibeToggles,
  googleMaps: any
): Promise<string[]> {
  devLog.search('Multi-cafe keyword extraction', {
    cafeCount: placesInfo.length,
    cafes: placesInfo.map(p => p.name),
  });

  // Extract keywords from all cafes in parallel
  const keywordArrays = await Promise.all(
    placesInfo.map(place => extractKeywordsFromReviews(place.place_id, googleMaps))
  );

  devLog.keywords('Per-cafe keywords', keywordArrays);

  // Flatten and count frequency
  const keywordFrequency = new Map<string, number>();

  for (const keywords of keywordArrays) {
    for (const keyword of keywords) {
      keywordFrequency.set(keyword, (keywordFrequency.get(keyword) || 0) + 1);
    }
  }

  devLog.log('debug', 'Keyword frequency map', Object.fromEntries(keywordFrequency));

  // Get keywords that appear in multiple cafes (consensus)
  const consensusKeywords = Array.from(keywordFrequency.entries())
    .filter(([_, count]) => count >= Math.min(2, placesInfo.length)) // At least 2 cafes or all if less
    .sort((a, b) => b[1] - a[1]) // Sort by frequency
    .map(([keyword]) => keyword)
    .slice(0, 3); // Top 3 consensus keywords

  devLog.keywords('Consensus keywords', consensusKeywords);

  // Add vibe keywords
  const vibeKeywords = buildVibeKeywords(vibes);

  devLog.keywords('Vibe keywords', vibeKeywords);

  // Combine: vibe keywords + consensus keywords + base
  const finalKeywords = ['cafe', 'coffee', ...vibeKeywords, ...consensusKeywords];

  devLog.keywords('Final combined keywords', finalKeywords);

  return finalKeywords;
}

/**
 * Build vibe-based keywords
 */
function buildVibeKeywords(vibes: VibeToggles): string[] {
  const keywords: string[] = [];

  if (vibes.roastery) {
    keywords.push('single origin', 'roastery');
  }

  if (vibes.lightRoast) {
    keywords.push('filter', 'pour over');
  }

  if (vibes.laptopFriendly) {
    keywords.push('laptop', 'wifi');
  }

  if (vibes.nightOwl) {
    keywords.push('late', 'night');
  }

  if (vibes.cozy) {
    keywords.push('cozy');
  }

  if (vibes.minimalist) {
    keywords.push('minimalist', 'modern');
  }

  return keywords;
}

/**
 * Process free text using OpenAI to extract search-relevant keywords
 */
export async function processFreeTextWithAI(freeText: string): Promise<string[]> {
  devLog.llm('Processing free text', { prompt: freeText });

  try {
    const startTime = Date.now();

    const response = await fetch('/api/process-free-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freeText }),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      devLog.log('error', 'Failed to process free text', { status: response.status });
      return [];
    }

    const { keywords } = await response.json();

    devLog.llm('Free text processed', {
      response: keywords,
      duration: `${duration}ms`
    });

    devLog.keywords('Free text keywords', keywords || []);

    return keywords || [];
  } catch (error) {
    devLog.log('error', 'Error processing free text', error);
    return [];
  }
}
