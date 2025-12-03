import { AdvancedPlaceFieldValues } from './googlePlaceFields';
import { VIBE_DEFINITIONS, VibeDefinition } from './vibes';

/**
 * Analyze source cafes and recommend vibes based on their characteristics
 */
export async function getRecommendedVibes(
  sourcePlaces: Array<{
    placeId: string;
    advancedFields?: AdvancedPlaceFieldValues;
    types?: string[];
  }>
): Promise<string[]> {
  console.log('[getRecommendedVibes] Called with', {
    sourcePlacesCount: sourcePlaces.length,
    places: sourcePlaces.map(p => ({
      placeId: p.placeId,
      hasAdvancedFields: !!p.advancedFields,
      fieldCount: p.advancedFields ? Object.keys(p.advancedFields).length : 0,
      fields: p.advancedFields ? Object.keys(p.advancedFields) : [],
    })),
  });

  const vibeScores: Record<string, number> = {};
  let placesWithFields = 0;

  // Analyze each source place
  for (const place of sourcePlaces) {
    if (!place.advancedFields) {
      console.log('[getRecommendedVibes] Skipping place (no advancedFields):', place.placeId);
      continue;
    }

    placesWithFields++;
    const placeMatches: string[] = [];

    // Check each vibe definition to see if this place matches
    for (const [vibeId, vibeDef] of Object.entries(VIBE_DEFINITIONS)) {
      // Skip if vibe has no Google field mapping
      if (!vibeDef.googleField) continue;

      const fieldValue = place.advancedFields[vibeDef.googleField];

      // Boolean fields
      if (typeof fieldValue === 'boolean' && fieldValue === true) {
        vibeScores[vibeId] = (vibeScores[vibeId] || 0) + 1;
        placeMatches.push(vibeId);
      }

      // Object fields (e.g., accessibilityOptions, parkingOptions)
      if (typeof fieldValue === 'object' && fieldValue !== null) {
        // If the field exists and is not empty, count it
        const hasValues = Object.values(fieldValue).some(v => v === true || (v && typeof v === 'object'));
        if (hasValues) {
          vibeScores[vibeId] = (vibeScores[vibeId] || 0) + 1;
          placeMatches.push(vibeId);
        }
      }
    }

    if (placeMatches.length > 0) {
      console.log('[getRecommendedVibes] Place matched vibes:', {
        placeId: place.placeId,
        matches: placeMatches,
      });
    }
  }

  console.log('[getRecommendedVibes] Analysis complete:', {
    placesWithFields,
    totalVibesChecked: Object.keys(VIBE_DEFINITIONS).length,
    vibesWithScores: Object.keys(vibeScores).length,
    vibeScores,
  });

  // Sort vibes by score (how many source places have this characteristic)
  const sortedVibes = Object.entries(vibeScores)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .map(([vibeId]) => vibeId);

  console.log('[getRecommendedVibes] Sorted vibes:', sortedVibes);

  // Return top 3 recommended vibes
  const result = sortedVibes.slice(0, 3);
  console.log('[getRecommendedVibes] Returning top 3:', result);
  return result;
}

/**
 * Get recommended vibe definitions with scores
 */
export async function getRecommendedVibeDefinitions(
  sourcePlaces: Array<{
    placeId: string;
    advancedFields?: AdvancedPlaceFieldValues;
    types?: string[];
  }>
): Promise<Array<{ vibe: VibeDefinition; matchCount: number }>> {
  const vibeScores: Record<string, number> = {};

  // Analyze each source place
  for (const place of sourcePlaces) {
    if (!place.advancedFields) continue;

    // Check each vibe definition to see if this place matches
    for (const [vibeId, vibeDef] of Object.entries(VIBE_DEFINITIONS)) {
      // Skip if vibe has no Google field mapping
      if (!vibeDef.googleField) continue;

      const fieldValue = place.advancedFields[vibeDef.googleField];

      // Boolean fields
      if (typeof fieldValue === 'boolean' && fieldValue === true) {
        vibeScores[vibeId] = (vibeScores[vibeId] || 0) + 1;
      }

      // Object fields (e.g., accessibilityOptions, parkingOptions)
      if (typeof fieldValue === 'object' && fieldValue !== null) {
        // If the field exists and is not empty, count it
        const hasValues = Object.values(fieldValue).some(v => v === true || (v && typeof v === 'object'));
        if (hasValues) {
          vibeScores[vibeId] = (vibeScores[vibeId] || 0) + 1;
        }
      }
    }
  }

  // Sort vibes by score and return top 3 with definitions
  return Object.entries(vibeScores)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .slice(0, 3)
    .map(([vibeId, matchCount]) => ({
      vibe: VIBE_DEFINITIONS[vibeId],
      matchCount,
    }));
}
