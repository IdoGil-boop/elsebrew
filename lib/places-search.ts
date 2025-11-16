import { PlaceBasicInfo, VibeToggles, CafeMatch } from '@/types';
import { buildSearchKeywords, scoreCafe, calculateDistance } from './scoring';

export const searchCafes = async (
  googleMaps: any,
  sourcePlace: PlaceBasicInfo,
  destinationCenter: google.maps.LatLng,
  destinationBounds: google.maps.LatLngBounds,
  vibes: VibeToggles,
  customKeywords?: string[], // Optional custom keywords from multi-cafe + free text
  isRefinement: boolean = false // Flag to prioritize refinement keywords
): Promise<CafeMatch[]> => {
  const google = googleMaps;
  const keywords = customKeywords || buildSearchKeywords(sourcePlace, vibes);
  const query = keywords.slice(0, 5).join(' '); // Limit query length

  // Calculate search radius from bounds
  const ne = destinationBounds.getNorthEast();
  const sw = destinationBounds.getSouthWest();
  const radius = calculateDistance(ne, sw) * 1000 / 2; // Convert km to meters, use half diagonal

  const map = new google.maps.Map(document.createElement('div'));
  const service = new google.maps.places.PlacesService(map);

  // Search for cafes
  const searchRequest: google.maps.places.TextSearchRequest = {
    query,
    location: destinationCenter,
    radius: Math.min(radius, 50000), // Cap at 50km
  };

  return new Promise((resolve, reject) => {
    service.textSearch(searchRequest, async (results: any, status: any) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
        reject(new Error(`Search failed: ${status}`));
        return;
      }

      // Filter results to only include places within destination bounds
      const candidates = results
        .filter((place: any) => {
          if (!place.place_id || !place.rating) return false;
          
          // Check if place is within destination bounds
          if (place.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            return destinationBounds.contains(new google.maps.LatLng(lat, lng));
          }
          
          // If no geometry, include it (will be filtered later when we get details)
          return true;
        })
        .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 6); // Reduced from 30 to 6

      // Get full details for top candidates
      const detailedCandidates = await Promise.all(
        candidates.map((place: any) =>
          getPlaceDetails(service, place.place_id!)
        )
      );

      // Score and sort, filtering by bounds again with full geometry
      const scored: CafeMatch[] = detailedCandidates
        .filter((place): place is PlaceBasicInfo => {
          if (!place) return false;
          
          // Double-check bounds with full geometry
          if (place.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            return destinationBounds.contains(new google.maps.LatLng(lat, lng));
          }
          
          return false; // Exclude if no geometry
        })
        .map(place => {
          const { score, matchedKeywords } = scoreCafe(place, sourcePlace, vibes, keywords, isRefinement);
          const distanceToCenter = place.geometry?.location
            ? calculateDistance(destinationCenter, place.geometry.location)
            : undefined;

          return {
            place,
            score,
            matchedKeywords,
            distanceToCenter,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 2); // Reduced from 8 to 2

      resolve(scored);
    });
  });
};

const getPlaceDetails = (
  service: google.maps.places.PlacesService,
  placeId: string
): Promise<PlaceBasicInfo | null> => {
  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: [
          'place_id',
          'name',
          'rating',
          'user_ratings_total',
          'price_level',
          'formatted_address',
          'geometry',
          'opening_hours',
          'photos',
          'types',
          'editorial_summary',
        ],
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          resolve({
            place_id: place.place_id!,
            name: place.name!,
            formatted_address: place.formatted_address,
            geometry: place.geometry,
            types: place.types,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            price_level: place.price_level,
            opening_hours: place.opening_hours,
            photos: place.photos,
            editorial_summary: (place as any).editorial_summary?.overview,
          });
        } else {
          resolve(null);
        }
      }
    );
  });
};
