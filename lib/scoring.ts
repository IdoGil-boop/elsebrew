import { PlaceBasicInfo, VibeToggles } from '@/types';
import { getVibeById } from './vibes';

/**
 * Calculate type overlap score between a candidate place and multiple origin places.
 * Prioritizes candidates that share types (especially primaryType) with ALL origin places.
 *
 * Based on Google Places API documentation:
 * - primaryType: The single most significant classification for a place
 * - types: Array of all applicable type classifications
 *
 * @param candidate - The place being scored
 * @param origins - Array of origin places (e.g., coffee shops the user loves)
 * @returns Score based on type overlap (0-10 scale)
 */
export const calculateTypeOverlapScore = (
  candidate: PlaceBasicInfo,
  origins: PlaceBasicInfo[]
): { score: number; matchedOrigins: string[] } => {
  if (!candidate.types || candidate.types.length === 0 || origins.length === 0) {
    return { score: 0, matchedOrigins: [] };
  }

  let totalScore = 0;
  const matchedOrigins: string[] = [];
  const candidateTypes = new Set(candidate.types);
  const candidatePrimaryType = candidate.primaryType;

  // For each origin, calculate overlap
  origins.forEach((origin) => {
    if (!origin.types || origin.types.length === 0) {
      return;
    }

    let originScore = 0;
    const originTypes = new Set(origin.types);
    const originPrimaryType = origin.primaryType;

    // 1. Primary type match (highest weight) - +4 points
    // If candidate's primary type matches origin's primary type exactly
    if (candidatePrimaryType && originPrimaryType && candidatePrimaryType === originPrimaryType) {
      originScore += 6;
    }
    // 2. Primary type in types array - +3 points
    // If origin's primary type appears anywhere in candidate's types
    else if (originPrimaryType && candidateTypes.has(originPrimaryType)) {
      originScore += 5;
    }
    // 3. Candidate's primary type matches any origin type - +2 points
    else if (candidatePrimaryType && originTypes.has(candidatePrimaryType)) {
      originScore += 4;
    }

    // 4. Count general type overlaps (excluding common generic types) - +0.5 per match, max +2
    const GENERIC_TYPES = new Set([
      'point_of_interest',
      'establishment',
      'food',
      'store',
      'place_of_worship', // unlikely but just in case
    ]);

    let typeOverlapCount = 0;
    for (const type of candidateTypes) {
      if (originTypes.has(type) && !GENERIC_TYPES.has(type)) {
        typeOverlapCount++;
      }
    }

    // Cap the overlap bonus at 3 points (4 overlapping types max)
    const overlapBonus = Math.min(typeOverlapCount * 0.5, 3);
    originScore += overlapBonus;

    // Track if this origin had meaningful overlap
    if (originScore > 0) {
      matchedOrigins.push(origin.displayName);
      totalScore += originScore;
    }
  });

  // Normalize score to 0-10 scale
  // If we have N origins, max possible score is roughly N * 6 (4 for primary + 2 for overlap)
  // We'll use a more conservative cap to keep scores reasonable
  const maxPossibleScore = origins.length * 6;
  const normalizedScore = Math.min((totalScore / maxPossibleScore) * 10, 10);

  return { score: normalizedScore, matchedOrigins };
};

export const buildSearchKeywords = (
  sourcePlaceInfo: PlaceBasicInfo,
  _vibes: VibeToggles
): string[] => {
  // Base coffee keywords - vibes are now handled by actual place data fields
  const keywords: string[] = ['cafe', 'coffee', 'specialty coffee'];

  return keywords;
};

export const scoreCafe = (
  candidate: PlaceBasicInfo,
  source: PlaceBasicInfo,
  vibes: VibeToggles,
  keywords: string[],
  isRefinement: boolean = false,
  originPlaces: PlaceBasicInfo[] = []
): { score: number; matchedKeywords: string[]; typeOverlapDetails?: string } => {
  let score = 0;
  const matchedKeywords: string[] = [];
  let typeOverlapDetails: string | undefined;

  // Base score from rating (0-5 range, scale to 0-10)
  if (candidate.rating) {
    score += (candidate.rating / 5) * 10;
  }

  // Review count boost (log scale to prevent dominance)
  if (candidate.userRatingCount && candidate.userRatingCount > 0) {
    score += Math.log10(candidate.userRatingCount);
  }

  // Type overlap scoring - prioritize places with similar types to origin(s)
  // This is especially powerful when multiple origins are provided
  if (originPlaces.length > 0) {
    const { score: typeScore, matchedOrigins } = calculateTypeOverlapScore(candidate, originPlaces);
    score += typeScore;

    if (matchedOrigins.length > 0) {
      // Build detailed type overlap information for LLM
      const candidateTypesList = candidate.types?.filter(t =>
        !['point_of_interest', 'establishment', 'food', 'store'].includes(t)
      ).join(', ') || 'N/A';

      const originTypesList = originPlaces
        .map(origin => {
          const significantTypes = origin.types?.filter(t =>
            !['point_of_interest', 'establishment', 'food', 'store'].includes(t)
          );
          return `${origin.displayName} (${origin.primaryType || significantTypes?.[0] || 'cafe'})`;
        })
        .join(', ');

      typeOverlapDetails = `Shares ${candidate.primaryType || 'cafe'} characteristics with ${
        matchedOrigins.length === originPlaces.length ? 'all origins' : matchedOrigins.join(' and ')
      }. Origin types: ${originTypesList}. Candidate types: ${candidateTypesList}`;

      // If matched with multiple origins, that's a strong signal
      if (matchedOrigins.length === originPlaces.length) {
        matchedKeywords.push(`Type match: All ${originPlaces.length} origins`);
      } else if (matchedOrigins.length > 1) {
        matchedKeywords.push(`Type match: ${matchedOrigins.length} origins`);
      } else {
        matchedKeywords.push(`Type match: ${matchedOrigins[0]}`);
      }
    }
  }

  // Price level match (+2 if within ±1 of source)
  if (source.priceLevel !== undefined && candidate.priceLevel !== undefined) {
    const priceDiff = Math.abs(source.priceLevel - candidate.priceLevel);
    if (priceDiff <= 1) {
      score += 2;
      matchedKeywords.push('Similar price');
    }
  }

  // Photo bonus (indicates quality listing)
  if (candidate.photos && candidate.photos.length > 0) {
    score += 0.5;
  }

  // Amenity-based scoring (actual place data instead of keywords)
  if (candidate.outdoorSeating) {
    score += 1;
    matchedKeywords.push('Outdoor seating');
  }

  if (candidate.liveMusic) {
    score += 1;
    matchedKeywords.push('Live music');
  }

  if (candidate.goodForGroups) {
    score += 0.5;
    matchedKeywords.push('Good for groups');
  }

  if (candidate.servesBreakfast || candidate.servesBrunch) {
    score += 0.5;
    matchedKeywords.push('All-day dining');
  }

  // Vibe-based scoring - boost places that match selected vibes
  // Updated to support dynamic vibes (40+ vibes instead of hardcoded)
  Object.keys(vibes).forEach(vibeId => {
    if (!vibes[vibeId]) return; // Skip unselected vibes

    const vibeDef = getVibeById(vibeId);
    if (!vibeDef?.googleField) return; // Skip vibes without Google field mapping

    const fieldValue = (candidate as any)[vibeDef.googleField];

    // Boolean fields - check if true
    if (typeof fieldValue === 'boolean' && fieldValue === true) {
      score += 1.5;
      matchedKeywords.push(vibeDef.label);
    }

    // Object fields (e.g., accessibilityOptions) - check if exists and has values
    if (typeof fieldValue === 'object' && fieldValue !== null) {
      const hasValues = Object.values(fieldValue).some(v => v === true || (v && typeof v === 'object'));
      if (hasValues) {
        score += 1.5;
        matchedKeywords.push(vibeDef.label);
      }
    }
  });

  // If this is a refinement, prioritize keywords from free text and vibes
  if (isRefinement) {
    // Use types and display name for keyword matching since editorialSummary is no longer fetched
    const typesText = candidate.types?.join(' ').toLowerCase() || '';
    const nameText = candidate.displayName?.toLowerCase() || '';
    const combinedText = `${nameText} ${typesText}`;

    // Boost score for matching refinement keywords (from free text and vibes)
    keywords.forEach(keyword => {
      if (combinedText.includes(keyword.toLowerCase())) {
        score += 3; // Higher weight for refinement matches
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    });
  }

  return { score, matchedKeywords, typeOverlapDetails };
};

export const calculateDistance = (
  from: google.maps.LatLng | google.maps.LatLngLiteral,
  to: google.maps.LatLng | google.maps.LatLngLiteral
): number => {
  // Haversine formula for distance in km
  const R = 6371; // Earth's radius in km
  const lat1 = typeof from.lat === 'function' ? from.lat() : from.lat;
  const lon1 = typeof from.lng === 'function' ? from.lng() : from.lng;
  const lat2 = typeof to.lat === 'function' ? to.lat() : to.lat;
  const lon2 = typeof to.lng === 'function' ? to.lng() : to.lng;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
