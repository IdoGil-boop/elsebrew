import { PlaceBasicInfo, VibeToggles } from '@/types';

export const buildSearchKeywords = (
  sourcePlaceInfo: PlaceBasicInfo,
  vibes: VibeToggles
): string[] => {
  const keywords: string[] = ['cafe', 'coffee'];

  // Base specialty coffee keywords
  keywords.push('specialty coffee');

  // Vibe-based keywords
  if (vibes.roastery) {
    keywords.push('roastery', 'roaster', 'single origin');
  }

  if (vibes.lightRoast) {
    keywords.push('light roast', 'filter coffee', 'hand drip', 'pour over', 'third wave');
  }

  if (vibes.laptopFriendly) {
    keywords.push('co-working', 'wifi', 'workspace');
  }

  if (vibes.nightOwl) {
    keywords.push('late night', 'open late');
  }

  if (vibes.cozy) {
    keywords.push('cozy', 'intimate', 'warm');
  }

  if (vibes.minimalist) {
    keywords.push('minimalist', 'modern', 'clean');
  }

  return keywords;
};

export const scoreCafe = (
  candidate: PlaceBasicInfo,
  source: PlaceBasicInfo,
  vibes: VibeToggles,
  keywords: string[],
  isRefinement: boolean = false
): { score: number; matchedKeywords: string[] } => {
  let score = 0;
  const matchedKeywords: string[] = [];

  // Base score from rating (0-5 range, scale to 0-10)
  if (candidate.rating) {
    score += (candidate.rating / 5) * 10;
  }

  // Review count boost (log scale to prevent dominance)
  if (candidate.user_ratings_total && candidate.user_ratings_total > 0) {
    score += Math.log10(candidate.user_ratings_total);
  }

  // Price level match (+2 if within ±1 of source)
  if (source.price_level !== undefined && candidate.price_level !== undefined) {
    const priceDiff = Math.abs(source.price_level - candidate.price_level);
    if (priceDiff <= 1) {
      score += 2;
      matchedKeywords.push('Similar price');
    }
  }

  // Editorial summary keyword matching
  const editorialText = candidate.editorial_summary?.toLowerCase() || '';
  const typesText = candidate.types?.join(' ').toLowerCase() || '';
  const combinedText = `${editorialText} ${typesText}`;

  // Check for roastery/roaster
  if (vibes.roastery && (combinedText.includes('roast') || combinedText.includes('roaster'))) {
    score += 2;
    matchedKeywords.push('Roastery');
  }

  // Check for specialty coffee indicators
  if (combinedText.includes('specialty') || combinedText.includes('third wave') ||
      combinedText.includes('artisan') || combinedText.includes('craft')) {
    score += 1;
    matchedKeywords.push('Specialty coffee');
  }

  // Opening hours match
  if (vibes.nightOwl && candidate.opening_hours) {
    // Simple heuristic: if we have opening hours data, assume it might be open late
    // In a real implementation, we'd check actual hours
    score += 1;
    matchedKeywords.push('Extended hours');
  }

  // Photo bonus (indicates quality listing)
  if (candidate.photos && candidate.photos.length > 0) {
    score += 0.5;
  }

  // Laptop-friendly heuristic (look for cafe/coffee_shop type)
  if (vibes.laptopFriendly && candidate.types?.some(t =>
    ['cafe', 'coffee_shop'].includes(t))) {
    score += 1;
    matchedKeywords.push('Cafe setting');
  }

  // If this is a refinement, prioritize keywords from free text and vibes
  if (isRefinement) {
    const editorialText = candidate.editorial_summary?.toLowerCase() || '';
    const typesText = candidate.types?.join(' ').toLowerCase() || '';
    const combinedText = `${editorialText} ${typesText}`;
    
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

  return { score, matchedKeywords };
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
