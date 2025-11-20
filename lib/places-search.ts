import { PlaceBasicInfo, VibeToggles, CafeMatch } from '@/types';
import { buildSearchKeywords, scoreCafe, calculateDistance } from './scoring';
import { AdvancedPlaceFieldValues } from './googlePlaceFields';

async function fetchAdvancedPlaceFields(
  placeIds: string[],
  vibes: VibeToggles,
  keywords: string[],
  freeText: string = '',
): Promise<Record<string, AdvancedPlaceFieldValues>> {
  if (!placeIds.length) {
    return {};
  }

  const uniqueIds = Array.from(new Set(placeIds)).slice(0, 20); // searchByText caps at 20 anyway

  try {
    const response = await fetch('/api/google/places/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeIds: uniqueIds,
        vibes,
        keywords,
        freeText,
      }),
    });

    if (!response.ok) {
      console.warn(
        '[Places Search] Advanced fields API returned non-OK status:',
        response.status,
        response.statusText,
      );
      return {};
    }

    const data = await response.json();
    if (!data || typeof data !== 'object' || !data.fieldsByPlaceId) {
      console.warn(
        '[Places Search] Advanced fields API responded without fieldsByPlaceId payload',
      );
      return {};
    }

    return data.fieldsByPlaceId as Record<string, AdvancedPlaceFieldValues>;
  } catch (error) {
    console.warn(
      '[Places Search] Failed to fetch advanced place fields:',
      error instanceof Error ? error.message : error,
    );
    return {};
  }
}

export interface SearchCafesResult {
  results: CafeMatch[];
  allScoredResults: CafeMatch[]; // All results after filtering and scoring (not sliced to top 5)
  hasMorePages: boolean;
  nextPageToken?: string;
}

/**
 * Map vibes to Google Place types that should be included/preferred in search
 * These types will influence what Google returns
 */
function vibeToPlaceTypes(vibes: VibeToggles): string[] {
  const types: string[] = [];

  if (vibes.roastery) {
    types.push('coffee_roastery'); // Not a real Google type, will be used in text query
  }

  if (vibes.laptopFriendly) {
    types.push('workspace'); // Will be used in text query
  }

  if (vibes.nightOwl) {
    types.push('night_club', 'bar'); // Late-night establishments
  }

  if (vibes.cozy) {
    types.push('cafe'); // Prefer cafe over coffee_shop for cozier vibes
  }

  if (vibes.minimalist) {
    types.push('modern'); // Will be used in text query
  }

  return types;
}

/**
 * Build enhanced text query that includes vibe-related keywords
 */
function buildVibeEnhancedQuery(baseKeywords: string[], vibes: VibeToggles): string {
  const vibeKeywords: string[] = [];

  if (vibes.roastery) {
    vibeKeywords.push('roastery', 'roaster');
  }

  if (vibes.lightRoast) {
    vibeKeywords.push('light roast', 'specialty coffee');
  }

  if (vibes.laptopFriendly) {
    vibeKeywords.push('workspace', 'wifi', 'laptop friendly');
  }

  if (vibes.nightOwl) {
    vibeKeywords.push('late night', 'open late');
  }

  if (vibes.cozy) {
    vibeKeywords.push('cozy', 'intimate');
  }

  if (vibes.minimalist) {
    vibeKeywords.push('minimalist', 'modern', 'clean design');
  }

  if (vibes.allowsDogs) {
    vibeKeywords.push('dog friendly', 'pet friendly');
  }

  if (vibes.servesVegetarian) {
    vibeKeywords.push('vegetarian', 'vegan options');
  }

  if (vibes.brunch) {
    vibeKeywords.push('brunch', 'breakfast');
  }

  // Combine base keywords with top 2 vibe keywords
  const allKeywords = [...baseKeywords.slice(0, 2), ...vibeKeywords.slice(0, 2)];
  return allKeywords.slice(0, 5).join(' ');
}

export const searchCafes = async (
  googleMaps: any,
  sourcePlace: PlaceBasicInfo,
  destinationCenter: google.maps.LatLng,
  destinationBounds: google.maps.LatLngBounds,
  vibes: VibeToggles,
  customKeywords?: string[], // Optional custom keywords from multi-cafe + free text
  isRefinement: boolean = false, // Flag to prioritize refinement keywords
  destinationTypes: string[] = [], // Destination types to determine if it's an area or point
  destinationPlaceId?: string, // Place ID for reverse geocoding verification
  originPlaces: PlaceBasicInfo[] = [], // All origin places for type overlap scoring
  placeIdsToFilter: string[] = [], // Place IDs to filter out (seen but unsaved)
  pageToken?: string, // Token for fetching next page of results
  freeText: string = '' // Free text query for field relevance detection
): Promise<SearchCafesResult> => {
  const google = googleMaps;
  const keywords = customKeywords || buildSearchKeywords(sourcePlace, vibes);

  // Extract unique types from all origin places to enhance the search query
  const originTypes = new Set<string>();
  if (originPlaces.length > 0) {
    originPlaces.forEach(origin => {
      // Add primaryType if available
      if (origin.primaryType) {
        originTypes.add(origin.primaryType);
      }
      // Add other significant types (excluding generic ones)
      if (origin.types) {
        const GENERIC_TYPES = new Set([
          'point_of_interest',
          'establishment',
          'food',
          'store',
          'place_of_worship',
        ]);
        origin.types.forEach(type => {
          if (!GENERIC_TYPES.has(type) && type !== 'coffee_shop' && type !== 'cafe') {
            originTypes.add(type);
          }
        });
      }
    });
  }

  // Build personalized text query from keywords, origin types, and vibes
  // Include origin types (converted to readable text) in the query to bias results
  const typeKeywords = Array.from(originTypes)
    .map(type => type.replace(/_/g, ' ')) // Convert snake_case to readable text
    .slice(0, 3); // Limit to additional type keywords

  const allKeywords = [...keywords.slice(0, 3), ...typeKeywords];

  // Enhance query with vibe-specific keywords to influence Google's results
  const textQuery = buildVibeEnhancedQuery(allKeywords, vibes);

  // Determine if destination is an area (city, country, etc.) or a specific point (hotel, restaurant)
  const AREA_TYPES = [
    'locality', // city
    'sublocality', // neighborhood
    'administrative_area_level_1', // state/province
    'administrative_area_level_2', // county
    'country',
    'sublocality_level_1',
    'city',
    'continent',
    'postal_code',
    'neighborhood',
    'colloquial_area',
  ];

  const isAreaDestination = destinationTypes.some(type => AREA_TYPES.includes(type));

  console.log('[Places Search] Starting search', {
    sourcePlace: sourcePlace.displayName,
    destinationCenter: { lat: destinationCenter.lat(), lng: destinationCenter.lng() },
    destinationTypes,
    isAreaDestination,
    keywords,
    originTypes: Array.from(originTypes),
    textQuery,
    vibes,
  });

  // Use new Text Search API with personalized query + type filtering
  // Note: Atmosphere & amenity fields are fetched separately via REST API
  // because the JavaScript SDK doesn't support them yet
  // Reference: https://developers.google.com/maps/documentation/places/web-service/data-fields
  const searchRequest: any = {
    textQuery, // Personalized query from user's loved cafe vibes
    fields: [
      // Basic Data fields - these are available in searchByText
      'id',
      'displayName',
      'location',
      'rating',
      'userRatingCount',
      'priceLevel',
      'formattedAddress',
      'types',
      'primaryType',
      'regularOpeningHours',
      'photos',
      'editorialSummary',
    ],
    includedType: 'coffee_shop',
    maxResultCount: 20, // Increased from 15 to get more results per page
    useStrictTypeFiltering: true,
  };

  // Add page token if this is a pagination request
  if (pageToken) {
    searchRequest.pageToken = pageToken;
    console.log('[Places Search] Fetching next page with token:', pageToken);
  }

  // Use different location strategies based on destination type
  if (isAreaDestination) {
    // For areas (cities, countries, etc.), check if bounds are reasonable
    const ne = destinationBounds.getNorthEast();
    const sw = destinationBounds.getSouthWest();
    const diagonalDistance = calculateDistance(ne, sw); // in km

    // If area is too large (>100km diagonal), use center with max radius
    // Otherwise use locationRestriction with exact bounds
    const MAX_AREA_DIAGONAL_KM = 100;

    if (diagonalDistance > MAX_AREA_DIAGONAL_KM) {
      console.log('[Places Search] Area too large, creating bounding box from center with max radius', {
        diagonalDistance: `${diagonalDistance.toFixed(1)}km`,
      });
      // Create a bounding box from center with max radius (50km)
      // Approximate: 1 degree latitude ≈ 111km, longitude varies by latitude
      const radiusKm = 50; // 50km max
      const latDelta = radiusKm / 111; // degrees
      const lngDelta = radiusKm / (111 * Math.cos((destinationCenter.lat() * Math.PI) / 180)); // degrees

      searchRequest.locationRestriction = {
        north: Math.min(90, destinationCenter.lat() + latDelta),
        south: Math.max(-90, destinationCenter.lat() - latDelta),
        east: destinationCenter.lng() + lngDelta,
        west: destinationCenter.lng() - lngDelta,
      };
      console.log('[Places Search] Using bounding box from center', {
        center: { lat: destinationCenter.lat(), lng: destinationCenter.lng() },
        radiusKm,
        bounds: searchRequest.locationRestriction,
      });
    } else {
      searchRequest.locationRestriction = {
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng(),
      };
      console.log('[Places Search] Using rectangle bounds for area destination', {
        sw: { lat: sw.lat(), lng: sw.lng() },
        ne: { lat: ne.lat(), lng: ne.lng() },
        diagonalDistance: `${diagonalDistance.toFixed(1)}km`,
      });
    }
  } else {
    // For specific points (hotels, restaurants, etc.), use circular restriction
    const ne = destinationBounds.getNorthEast();
    const sw = destinationBounds.getSouthWest();
    const radius = calculateDistance(ne, sw) * 1000 / 2; // Convert km to meters, use half diagonal
    const cappedRadius = Math.min(radius, 50000); // Cap at 50km (API max)

    console.log('[Places Search] Calculated radius for point destination', {
      radius: `${radius}m (${(radius / 1000).toFixed(1)}km)`,
      cappedRadius: `${cappedRadius}m (${(cappedRadius / 1000).toFixed(1)}km)`,
    });

    searchRequest.locationRestriction = {
      circle: {
        center: {
          latitude: destinationCenter.lat(),
          longitude: destinationCenter.lng(),
        },
        radius: cappedRadius,
      },
    };
    console.log('[Places Search] Using circular restriction for point destination', {
      center: { lat: destinationCenter.lat(), lng: destinationCenter.lng() },
      radius: `${cappedRadius}m (${(cappedRadius / 1000).toFixed(1)}km)`,
    });
  }

  console.log('[Places Search] 🔍 Calling searchByText API with:', {
    textQuery,
    locationStrategy: isAreaDestination ? 'rectangle' : 'circle',
    includedType: searchRequest.includedType,
    maxResultCount: searchRequest.maxResultCount,
    fieldCount: searchRequest.fields.length,
  });

  try {
    const response = await google.maps.places.Place.searchByText(searchRequest);
    const { places } = response;
    const nextPageToken = (response as any).nextPageToken; // Google may provide a token for next page

    console.log('[Places Search] Google Places API response', {
      resultCount: places?.length || 0,
      hasNextPage: !!nextPageToken,
    });

    if (!places || places.length === 0) {
      console.log('[Places Search] No results found');
      return {
        results: [],
        allScoredResults: [],
        hasMorePages: false,
      };
    }

    // Log all results with Google Maps links
    console.log('[Places Search] All results from Google (click to see location):');
    places.forEach((place: any, index: number) => {
      const lat = place.location?.lat();
      const lng = place.location?.lng();
      const mapsUrl = lat && lng
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${place.id}`
        : 'No coordinates';
      console.log(`  ${index + 1}. ${place.displayName} (${place.rating}★)`, {
        placeId: place.id,
        coordinates: lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : 'N/A',
        mapsLink: mapsUrl,
        address: place.formattedAddress,
      });
    });

    // Filter and prepare places (work directly with new API format)
    const filteredPlaces = places
      .filter((place: any) => {
        // Basic validation
        if (!place.id || !place.rating) return false;

        // Filter out places user has seen but not saved
        if (placeIdsToFilter.includes(place.id)) {
          console.log(`[Places Search] Filtering out seen place: ${place.displayName}`);
          return false;
        }
        return true;
      });

    const placeIds = filteredPlaces.map((place: any) => place.id);
    console.log('[Places Search] Fetching advanced fields for', placeIds.length, 'places');
    const advancedFieldsByPlaceId = await fetchAdvancedPlaceFields(
      placeIds,
      vibes,
      keywords,
      freeText,
    );
    const fieldsCount = Object.keys(advancedFieldsByPlaceId).length;
    const fieldsWithData = Object.values(advancedFieldsByPlaceId).filter(
      (fields) => Object.keys(fields).length > 0,
    ).length;
    console.log(
      `[Places Search] Advanced fields fetched: ${fieldsCount} places, ${fieldsWithData} with data`,
    );

    const validPlaces: PlaceBasicInfo[] = filteredPlaces.map((place: any) => {
      const advancedFields = advancedFieldsByPlaceId[place.id] || {};

      return {
        id: place.id,
        displayName: place.displayName || 'Unknown',
        formattedAddress: place.formattedAddress,
        location: place.location, // Already a google.maps.LatLng object
        types: place.types,
        primaryType: place.primaryType,
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        priceLevel: place.priceLevel,
        regularOpeningHours: place.regularOpeningHours,
        photos: place.photos ? place.photos.slice(0, 4) : undefined, // Limit to 4 photos to control costs
        editorialSummary: place.editorialSummary?.text || place.editorialSummary?.overview,
        // Atmosphere & Amenities
        outdoorSeating: advancedFields.outdoorSeating ?? place.outdoorSeating,
        takeout: advancedFields.takeout ?? place.takeout,
        delivery: advancedFields.delivery ?? place.delivery,
        dineIn: advancedFields.dineIn ?? place.dineIn,
        reservable: advancedFields.reservable ?? place.reservable,
        goodForGroups: advancedFields.goodForGroups ?? place.goodForGroups,
        goodForChildren: advancedFields.goodForChildren ?? place.goodForChildren,
        goodForWatchingSports:
          advancedFields.goodForWatchingSports ?? place.goodForWatchingSports,
        liveMusic: advancedFields.liveMusic ?? place.liveMusic,
        servesCoffee: advancedFields.servesCoffee ?? place.servesCoffee,
        servesBreakfast: advancedFields.servesBreakfast ?? place.servesBreakfast,
        servesBrunch: advancedFields.servesBrunch ?? place.servesBrunch,
        servesLunch: advancedFields.servesLunch ?? place.servesLunch,
        servesDinner: advancedFields.servesDinner ?? place.servesDinner,
        servesBeer: advancedFields.servesBeer ?? place.servesBeer,
        servesWine: advancedFields.servesWine ?? place.servesWine,
        servesVegetarianFood:
          advancedFields.servesVegetarianFood ?? place.servesVegetarianFood,
        allowsDogs: advancedFields.allowsDogs ?? place.allowsDogs,
        restroom: advancedFields.restroom ?? place.restroom,
        menuForChildren: advancedFields.menuForChildren ?? place.menuForChildren,
        accessibilityOptions:
          advancedFields.accessibilityOptions ?? place.accessibilityOptions,
        paymentOptions: advancedFields.paymentOptions ?? place.paymentOptions,
        parkingOptions: advancedFields.parkingOptions ?? place.parkingOptions,
      };
    });

    console.log('[Places Search] Valid places', {
      count: validPlaces.length,
    });

    // Filter places to only include those within the destination area (for area destinations)
    let verifiedPlaces = validPlaces;
    if (isAreaDestination && destinationPlaceId) {
      console.log('[Places Search] Post-filtering results to verify they are within destination area');

      const geocoder = new google.maps.Geocoder();
      const verificationPromises = validPlaces.map(async (place: PlaceBasicInfo) => {
        try {
          const result = await geocoder.geocode({
            location: place.location
          });

          if (result.results && result.results.length > 0) {
            // Check if the destination place ID appears in any of the geocoding results
            // This means the cafe's location is within that area
            const placeIds = result.results.map((r: any) => r.place_id);
            const isWithinDestination = placeIds.includes(destinationPlaceId);

            console.log(`  ${place.displayName}: ${isWithinDestination ? '✓ inside' : '✗ outside'}`, {
              address: result.results[0].formatted_address,
              placeIds: placeIds.slice(0, 3), // Log first 3 for brevity
            });

            return { place, isWithinDestination };
          }
          return { place, isWithinDestination: false };
        } catch (error) {
          console.warn(`[Places Search] Geocoding failed for ${place.displayName}:`, error);
          // If geocoding fails, include the place (fail open)
          return { place, isWithinDestination: true };
        }
      });

      const verificationResults = await Promise.all(verificationPromises);
      const beforeFilterCount = verifiedPlaces.length;
      verifiedPlaces = verificationResults
        .filter(r => r.isWithinDestination)
        .map(r => r.place);

      const filteredOutCount = beforeFilterCount - verifiedPlaces.length;
      if (filteredOutCount > 0) {
        console.log(`[Places Search] Filtered out ${filteredOutCount} place(s) outside destination area`);
      }
    }

    // Score and sort ALL results (don't slice yet)
    // Create a set of previously seen place IDs for quick lookup
    const seenPlaceIds = new Set(placeIdsToFilter);

    const allScoredResults: CafeMatch[] = verifiedPlaces
      .map((place: PlaceBasicInfo) => {
        const { score, matchedKeywords, typeOverlapDetails } = scoreCafe(
          place,
          sourcePlace,
          vibes,
          keywords,
          isRefinement,
          originPlaces.length > 0 ? originPlaces : [sourcePlace] // Pass all origins or just the source
        );
        const distanceToCenter = place.location
          ? calculateDistance(destinationCenter, place.location)
          : undefined;

        // Penalize previously seen places by reducing their score by 50%
        // This ensures fresh cafes appear first while keeping seen ones as fallback
        const wasPreviouslySeen = seenPlaceIds.has(place.id);
        const adjustedScore = wasPreviouslySeen ? score * 0.5 : score;

        if (wasPreviouslySeen) {
          console.log(`[Places Search] Penalizing previously seen place: ${place.displayName} (score: ${score.toFixed(2)} → ${adjustedScore.toFixed(2)})`);
        }

        return {
          place,
          score: adjustedScore,
          matchedKeywords,
          distanceToCenter,
          typeOverlapDetails, // Include type overlap details for LLM
        };
      })
      .sort((a: CafeMatch, b: CafeMatch) => b.score - a.score);

    // Return top 5 for immediate display, but also return all results for caching
    const topResults = allScoredResults.slice(0, 5);

    console.log('[Places Search] Final results', {
      totalCount: allScoredResults.length,
      displayedCount: topResults.length,
      hasMorePages: !!nextPageToken,
      results: topResults.map(r => ({
        name: r.place.displayName,
        score: r.score,
        keywords: r.matchedKeywords,
        distance: r.distanceToCenter ? `${r.distanceToCenter.toFixed(1)}km` : 'unknown',
      })),
    });

    return {
      results: topResults,
      allScoredResults,
      hasMorePages: !!nextPageToken,
      nextPageToken,
    };
  } catch (error) {
    console.error('[Places Search] Search failed:', error);
    throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

