'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CafeMatch, PlaceBasicInfo, VibeToggles } from '@/types';
import { loadGoogleMaps } from '@/lib/maps-loader';
import { searchCafes, SearchCafesResult } from '@/lib/places-search';
import { analytics } from '@/lib/analytics';
import { extractKeywordsFromMultipleCafes, processFreeTextWithAI } from '@/lib/keyword-extraction';
import ResultsList from '@/components/results/ResultsList';
import ResultsMap from '@/components/results/ResultsMap';
import DetailsDrawer from '@/components/results/DetailsDrawer';
import RefineSearchModal from '@/components/results/RefineSearchModal';
import Toast from '@/components/shared/Toast';
import { getAuthToken, storage } from '@/lib/storage';
import { generateSearchId, saveCompleteSearchState } from '@/lib/search-state-manager';
import { logger, suppressGoogleMapsWarnings } from '@/lib/logger';

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [results, setResults] = useState<CafeMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefineModalOpen, setIsRefineModalOpen] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<CafeMatch | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [showToast, setShowToast] = useState(false);

  // Pagination state
  const [currentSearchId, setCurrentSearchId] = useState<string>('');
  const [allCachedResults, setAllCachedResults] = useState<CafeMatch[]>([]);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  // Ref to prevent duplicate searches in React Strict Mode
  const isSearchInProgress = useRef(false);

  // Helper to get photo URL from new or legacy Google Places API
  const getPhotoUrl = (photo: any, maxWidth: number): string | undefined => {
    try {
      if (typeof photo.getURI === 'function') {
        return photo.getURI({ maxWidth });
      } else if (typeof photo.getUrl === 'function') {
        return photo.getUrl({ maxWidth });
      }
    } catch (error) {
      logger.warn('Error getting photo URL:', error);
    }
    return undefined;
  };

  useEffect(() => {
    // Suppress Google Maps warnings in production
    suppressGoogleMapsWarnings();

    const currentSearch = searchParams.toString();
    const savedState = storage.getResultsState();

    // Check if we're restoring from saved page with matching params
    // Also check if this is a refinement (has refineSearch param)
    const isRefinement = searchParams.get('refineSearch') === 'true';

    if (!isRefinement && savedState && savedState.searchParams === currentSearch && savedState.results) {
      // Restore cached results immediately
      const restoredResults: CafeMatch[] = savedState.results.map((r: any) => ({
        place: {
          id: r.place.id,
          displayName: r.place.displayName,
          formattedAddress: r.place.formattedAddress,
          rating: r.place.rating,
          userRatingCount: r.place.userRatingCount,
          priceLevel: r.place.priceLevel,
          types: r.place.types,
          primaryType: r.place.primaryType,
          editorialSummary: r.place.editorialSummary,
          photoUrl: r.place.photoUrl, // Include cached photo URL
        } as PlaceBasicInfo,
        score: r.score,
        reasoning: r.reasoning,
        matchedKeywords: r.matchedKeywords,
        distanceToCenter: r.distanceToCenter,
        imageAnalysis: r.imageAnalysis,
      }));
      setResults(restoredResults);
      // Restore map center if available
      if (savedState.mapCenter) {
        setMapCenter(savedState.mapCenter);
      }
      setIsLoading(false);
      // DON'T clear the saved state - keep it for future back/forward navigation
      // storage.setResultsState(null);
      return; // Don't run the search again
    }

    // New search or params changed - reset state and clear old cache
    setIsLoading(true);
    setError(null);
    setResults([]);
    setSelectedResult(null);
    setSelectedIndex(null);
    // Clear any old cached results since this is a new search
    if (savedState && savedState.searchParams !== currentSearch) {
      storage.setResultsState(null);
    }

    // Debug: Check auth state on results page load
    const userProfile = storage.getUserProfile();
    logger.debug('[Results Page] Loaded - auth state:', {
      hasProfile: !!userProfile,
      name: userProfile?.name,
      hasToken: !!userProfile?.token,
      tokenLength: userProfile?.token?.length,
    });

    // Prevent duplicate searches in React Strict Mode
    if (isSearchInProgress.current) {
      logger.debug('[Results Page] Search already in progress, skipping duplicate');
      return;
    }

    const performSearch = async () => {
      const startTime = Date.now();
      isSearchInProgress.current = true;

      try {
        // Support both old (single cafe) and new (multiple cafes) params
        const sourcePlaceIdsParam = searchParams.get('sourcePlaceIds');
        const sourceNamesParam = searchParams.get('sourceNames');
        const destCity = searchParams.get('destCity');
        const vibesParam = searchParams.get('vibes');
        const freeText = searchParams.get('freeText');

        if (!destCity || !vibesParam) {
          setError('Missing search parameters');
          setIsLoading(false);
          return;
        }

        const vibes: VibeToggles = JSON.parse(vibesParam);

        // Parse source place IDs early (needed for search ID generation)
        let sourcePlaceIds: string[] = [];
        if (sourcePlaceIdsParam) {
          sourcePlaceIds = JSON.parse(sourcePlaceIdsParam);
        } else {
          const legacyId = searchParams.get('sourcePlaceId');
          if (legacyId) sourcePlaceIds = [legacyId];
        }

        if (sourcePlaceIds.length === 0) {
          setError('No source cafes specified');
          setIsLoading(false);
          return;
        }

        // Generate search ID to check for cached results
        const searchId = generateSearchId(
          sourcePlaceIds,
          destCity,
          vibes,
          freeText || undefined
        );

        // If this is a refinement, try to serve next batch from cache first
        if (isRefinement) {
          logger.debug('[Results] Refinement detected, checking for cached results...');
          try {
            const authToken = getAuthToken();
            const headers: HeadersInit = {};
            if (authToken) {
              headers['Authorization'] = `Bearer ${authToken}`;
            }

            const cacheResponse = await fetch(
              `/api/search-state?searchId=${encodeURIComponent(searchId)}`,
              { headers }
            );

            if (cacheResponse.ok) {
              const { searchState } = await cacheResponse.json();

              if (searchState && searchState.allResults) {
                const shownIds = new Set(searchState.shownPlaceIds || []);
                const unseenResults = searchState.allResults.filter(
                  (r: any) => !shownIds.has(r.placeId)
                );

                if (unseenResults.length > 0) {
                  logger.debug(`[Results] Found ${unseenResults.length} cached unseen results, serving next batch`);

                  // Serve next 5 unseen results
                  const nextBatch = unseenResults.slice(0, 5);

                  // Reconstruct CafeMatch objects (without full place details for now)
                  // We'll need to fetch full details if needed, but for now just show what we have
                  const cachedMatches: CafeMatch[] = nextBatch.map((r: any) => ({
                    place: {
                      id: r.placeId,
                      displayName: r.name,
                    } as PlaceBasicInfo,
                    score: r.score,
                    matchedKeywords: [],
                    reasoning: 'From your previous search results',
                  }));

                  setResults(cachedMatches);
                  setCurrentSearchId(searchId);
                  setIsLoading(false);

                  // Mark these as shown
                  const newlyShownIds = nextBatch.map((r: any) => r.placeId);
                  const updatedShownIds = [...Array.from(shownIds), ...newlyShownIds];

                  fetch('/api/search-state', {
                    method: 'PATCH',
                    headers: {
                      ...headers,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      searchId,
                      updates: {
                        shownPlaceIds: updatedShownIds,
                      },
                    }),
                  }).catch(err => logger.warn('[Results] Failed to update shown IDs:', err));

                  return; // Exit early, don't call Google
                }
              }
            }

            logger.debug('[Results] No cached results available, fetching from Google...');
          } catch (cacheError) {
            logger.warn('[Results] Failed to check cache:', cacheError);
            // Continue to Google fetch
          }
        }

        // Load Google Maps with better error handling
        let google;
        try {
          google = await loadGoogleMaps();
        } catch (mapError) {
          logger.error('[Results] Failed to load Google Maps:', mapError);
          throw new Error('Failed to load Google Maps. Please check your API key configuration.');
        }

        // Get details for all source places
        const map = new google.maps.Map(document.createElement('div'));
        const service = new google.maps.places.PlacesService(map);

        const getPlaceDetails = (placeId: string): Promise<PlaceBasicInfo> => {
          return new Promise((resolve, reject) => {
            service.getDetails(
              {
                placeId,
                fields: [
                  'place_id',
                  'name',
                  'types',
                  'rating',
                  'user_ratings_total',
                  'price_level',
                  'opening_hours',
                  'photos',
                  'editorial_summary',
                ],
              },
              (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                  // For origin places, extract primaryType from types array
                  // (The legacy API doesn't have primaryType, but we can use the first type as a proxy)
                  const primaryType = place.types && place.types.length > 0 ? place.types[0] : undefined;

                  resolve({
                    id: place.place_id!,
                    displayName: place.name!,
                    types: place.types,
                    primaryType: primaryType,
                    rating: place.rating,
                    userRatingCount: place.user_ratings_total,
                    priceLevel: place.price_level,
                    regularOpeningHours: place.opening_hours,
                    photos: place.photos,
                    editorialSummary: (place as any).editorial_summary?.overview,
                  });
                } else {
                  logger.error('[Results] getPlaceDetails failed', {
                    placeId,
                    status,
                    statusName: google.maps.places.PlacesServiceStatus[status],
                  });
                  reject(new Error(`Failed to get source place details: ${status} (${google.maps.places.PlacesServiceStatus[status] || 'Unknown status'})`));
                }
              }
            );
          });
        };

        const sourcePlaces = await Promise.all(sourcePlaceIds.map(getPlaceDetails));

        // Use first source place as primary for compatibility
        const sourcePlace = sourcePlaces[0];

        // Geocode destination
        const geocoder = new google.maps.Geocoder();
        const geocodeResult = await geocoder.geocode({ address: destCity });

        if (!geocodeResult.results[0]) {
          throw new Error('Failed to geocode destination');
        }

        const destResult = geocodeResult.results[0];
        const destGeometry = destResult.geometry;
        const destCenter = destGeometry.location;
        const destBounds = destGeometry.viewport;
        const destTypes = destResult.types || [];

        setMapCenter({
          lat: destCenter.lat(),
          lng: destCenter.lng(),
        });

        // Extract keywords from multiple cafes and free text
        let customKeywords: string[] | undefined;

        if (sourcePlaces.length > 1 || freeText) {
          // Build keywords from multiple sources
          const baseKeywords = await extractKeywordsFromMultipleCafes(
            sourcePlaces,
            vibes,
            google
          );

          // Process free text if provided
          let freeTextKeywords: string[] = [];
          if (freeText) {
            freeTextKeywords = await processFreeTextWithAI(freeText);
          }

          // Combine all keywords, ensuring we don't exceed search limit
          customKeywords = [
            ...baseKeywords.slice(0, 3),
            ...freeTextKeywords.slice(0, 2),
          ].slice(0, 5);
        }

        // Get places to filter out (seen but not saved)
        // Works for both logged-in users (by userId) and anonymous users (by IP)
        let placeIdsToFilter: string[] = [];
        try {
          const vibesArray = Object.entries(vibes)
            .filter(([_, enabled]) => enabled)
            .map(([vibe]) => vibe);

          const authToken = getAuthToken();
          const headers: HeadersInit = {};
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
          }

          const filterResponse = await fetch(
            `/api/user/place-interactions/filter?` +
              new URLSearchParams({
                destination: destCity,
                vibes: JSON.stringify(vibesArray),
                freeText: freeText || '',
                originPlaceIds: JSON.stringify(sourcePlaceIds),
              }).toString(),
            { headers }
          );

          if (filterResponse.ok) {
            const data = await filterResponse.json();
            placeIdsToFilter = data.placeIdsToFilter || [];
            logger.debug('[Results] Filtering out seen places:', placeIdsToFilter.length);
          }
        } catch (error) {
          logger.warn('[Results] Failed to fetch filter list:', error);
          // Continue without filtering
        }

        // Set the search ID (already generated earlier)
        const vibesArray = Object.entries(vibes)
          .filter(([_, enabled]) => enabled)
          .map(([vibe]) => vibe);
        setCurrentSearchId(searchId);

        // Search for matching cafes
        const searchResult: SearchCafesResult = await searchCafes(
          google,
          sourcePlace,
          destCenter,
          destBounds,
          vibes,
          customKeywords,
          isRefinement, // Pass refinement flag
          destTypes, // Pass destination types to determine if it's an area or point
          destResult.place_id, // Pass destination place ID for boundary verification
          sourcePlaces, // Pass all origin places for type overlap scoring
          placeIdsToFilter // Pass places to filter out
        );

        const matches = searchResult.results; // Top 5 for display
        setAllCachedResults(searchResult.allScoredResults); // Store all results
        setHasMorePages(searchResult.hasMorePages);
        setNextPageToken(searchResult.nextPageToken);

        // Fetch image analysis for all matches in parallel with timeout
        const matchesWithData = await Promise.all(
          matches.map(async (match) => {
            // Use Promise.race with timeout to avoid slow API calls
            const fetchWithTimeout = async (promise: Promise<any>, timeoutMs: number) => {
              const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeoutMs)
              );
              try {
                return await Promise.race([promise, timeout]);
              } catch {
                return undefined;
              }
            };

            // Fetch image analysis with 3 second timeout
            const imageAnalysis = await fetchWithTimeout(
              (async () => {
                if (match.place.photos && match.place.photos.length > 0) {
                  const photoUrl = getPhotoUrl(match.place.photos[0], 800);
                  if (photoUrl) {
                    const response = await fetch('/api/analyze-image', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ imageUrl: photoUrl }),
                    });
                    if (response.ok) {
                      const data = await response.json();
                      return data.analysis;
                    }
                  }
                }
                return undefined;
              })(),
              3000 // 3 second timeout
            );

            return {
              ...match,
              imageAnalysis,
            };
          })
        );

        // Generate all reasonings in one batch request for diversity
        let matchesWithReasoning = matchesWithData;
        try {
          const batchResponse = await fetch('/api/reason-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: {
                name: sourcePlace.displayName,
                price_level: sourcePlace.priceLevel,
                rating: sourcePlace.rating,
              },
              candidates: matchesWithData.map(match => ({
                name: match.place.displayName,
                price_level: match.place.priceLevel,
                rating: match.place.rating,
                user_ratings_total: match.place.userRatingCount,
                editorial_summary: match.place.editorialSummary,
                keywords: match.matchedKeywords,
                imageAnalysis: match.imageAnalysis,
                typeOverlapDetails: match.typeOverlapDetails,
                // Atmosphere & Amenities
                outdoorSeating: match.place.outdoorSeating,
                takeout: match.place.takeout,
                delivery: match.place.delivery,
                dineIn: match.place.dineIn,
                reservable: match.place.reservable,
                goodForGroups: match.place.goodForGroups,
                goodForChildren: match.place.goodForChildren,
                goodForWatchingSports: match.place.goodForWatchingSports,
                liveMusic: match.place.liveMusic,
                servesCoffee: match.place.servesCoffee,
                servesBreakfast: match.place.servesBreakfast,
                servesBrunch: match.place.servesBrunch,
                servesLunch: match.place.servesLunch,
                servesDinner: match.place.servesDinner,
                servesBeer: match.place.servesBeer,
                servesWine: match.place.servesWine,
                servesVegetarianFood: match.place.servesVegetarianFood,
                allowsDogs: match.place.allowsDogs,
                restroom: match.place.restroom,
                menuForChildren: match.place.menuForChildren,
              })),
              city: destCity,
              vibes: vibes,
            }),
          });

          if (batchResponse.ok) {
            const { reasonings } = await batchResponse.json();
            matchesWithReasoning = matchesWithData.map((match, index) => ({
              ...match,
              reasoning: reasonings[index] || 'Similar vibe and quality.',
            }));
          }
        } catch (err) {
          logger.error('Failed to fetch batch reasoning:', err);
        }

        setResults(matchesWithReasoning);

        // Save search state with pagination info
        const originPlaceObjs = sourcePlaceIds.map((id, idx) => ({
          placeId: id,
          name: sourcePlaces[idx]?.displayName || 'Unknown',
        }));

        saveCompleteSearchState(
          searchId,
          originPlaceObjs,
          destCity,
          vibesArray,
          freeText || undefined,
          matchesWithReasoning,
          searchResult.allScoredResults,
          searchResult.hasMorePages,
          searchResult.nextPageToken
        ).catch(err => logger.warn('[Results] Failed to save search state:', err));

        // Record place views for all users (logged-in and anonymous)
        if (matchesWithReasoning.length > 0) {
          const searchContext = {
            destination: destCity,
            vibes: vibesArray,
            freeText: freeText || undefined,
            originPlaceIds: sourcePlaceIds,
          };

          const authToken = getAuthToken();
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          };
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
          }

          // Record all views in parallel (fire and forget, don't wait)
          matchesWithReasoning.forEach(match => {
            fetch('/api/user/place-interactions', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                action: 'view',
                placeId: match.place.id,
                placeName: match.place.displayName,
                searchContext,
              }),
            }).catch(err => logger.warn('[Results] Failed to record view:', err));
          });
        }

        // Remove refineSearch param from URL if it was a refinement
        if (isRefinement) {
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.delete('refineSearch');
          const newUrl = `/results?${newParams.toString()}`;
          router.replace(newUrl);
        }

        // Store results state for navigation back from saved page (only if not a refinement)
        if (!isRefinement) {
          const currentSearch = searchParams.toString();
          storage.setResultsState(currentSearch, matchesWithReasoning, {
            lat: destCenter.lat(),
            lng: destCenter.lng(),
          });
        }

        // Track results loaded
        const latency = Date.now() - startTime;
        analytics.resultsLoaded({
          candidate_count: matchesWithReasoning.length,
          latency_ms: latency,
        });

        setIsLoading(false);
      } catch (err) {
        logger.error('Search error:', err);
        setError(err instanceof Error ? err.message : 'Search failed');
        setIsLoading(false);
      } finally {
        isSearchInProgress.current = false;
      }
    };

    performSearch();

    // Cleanup function to reset the flag when searchParams change
    return () => {
      isSearchInProgress.current = false;
    };
  }, [searchParams]);

  const handleSelectResult = (result: CafeMatch, index: number) => {
    setSelectedResult(result);
    setSelectedIndex(index);
  };

  const handleCloseDrawer = () => {
    setSelectedResult(null);
    setSelectedIndex(null);
  };

  const handleMarkerClick = (index: number) => {
    setSelectedResult(results[index]);
    setSelectedIndex(index);
  };

  const showToastMessage = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };

  const handleSaveAll = async () => {
    // Check if user is logged in
    const userProfile = storage.getUserProfile();
    logger.debug('[SaveAll] Retrieved user profile', {
      hasProfile: !!userProfile,
      name: userProfile?.name,
      hasToken: !!userProfile?.token,
      tokenLength: userProfile?.token?.length,
    });

    if (!userProfile || !userProfile.token) {
      logger.debug('[SaveAll] Missing profile or token - showing sign-in message');
      showToastMessage('Please sign in to save cafes', 'info');
      return;
    }

    const token = userProfile.token;
    logger.debug('[SaveAll] Starting save operation', {
      cafeCount: results.length,
      tokenPreview: token.substring(0, 20) + '...',
    });
    setIsSavingAll(true);

    try {
      // Save all results to backend
      const responses = await Promise.all(
        results.map(({ place }) =>
          fetch('/api/user/saved-places', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              placeId: place.id,
              name: place.displayName,
              address: place.formattedAddress || '',
              rating: place.rating,
              priceLevel: place.priceLevel,
              photoUrl: place.photoUrl || (place.photos?.[0] && getPhotoUrl(place.photos[0], 400)),
            }),
          })
        )
      );

      // Check if any failed with 401 (token expired)
      const unauthorized = responses.filter(r => r.status === 401);
      if (unauthorized.length > 0) {
        logger.debug('[SaveAll] Token expired - logging out user');
        storage.setUserProfile(null);
        showToastMessage('Your session has expired. Please sign in again.', 'info');
        setIsSavingAll(false);
        return;
      }

      // Check if any failed
      const failed = responses.filter(r => !r.ok);
      if (failed.length > 0) {
        throw new Error(`Failed to save ${failed.length} cafe(s)`);
      }

      // Check if we need to save to localStorage (AWS not configured)
      const firstResponse = await responses[0]?.json();
      if (firstResponse?.localStorage) {
        logger.debug('[SaveAll] Saving to localStorage (AWS not configured)');
        // Save to localStorage
        results.forEach(({ place }) => {
          storage.saveCafe({
            placeId: place.id!,
            name: place.displayName!,
            savedAt: Date.now(),
            photoUrl: place.photoUrl || place.photos?.[0]?.getUrl({ maxWidth: 400 }),
            rating: place.rating,
          });
        });
      }

      analytics.saveAll({ count: results.length });
      showToastMessage(
        `Successfully saved ${results.length} café${results.length > 1 ? 's' : ''}!`,
        'success'
      );
    } catch (error) {
      logger.error('Error saving cafes:', error);
      showToastMessage('Failed to save cafes. Please try again.', 'error');
    } finally {
      setIsSavingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">☕</div>
          <div className="text-lg text-gray-600">Finding your café twins...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-espresso transition-colors mx-auto"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to search
          </button>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🤷</div>
          <h2 className="text-xl font-semibold mb-2">No matches found</h2>
          <p className="text-gray-600 mb-4">
            Try adjusting your vibe preferences or choosing a different destination
          </p>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-espresso transition-colors duration-800 mx-auto group"
          >
            <div className="relative w-4 h-4 overflow-hidden">
              <svg
                className="w-4 h-4 absolute transition-all duration-300 group-hover:-translate-x-full group-hover:opacity-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <svg
                className="w-4 h-4 absolute translate-x-full opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            New search
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-espresso transition-colors duration-800 group"
              >
                <div className="relative w-4 h-4 overflow-hidden">
                  <svg
                    className="w-4 h-4 absolute transition-all duration-300 group-hover:-translate-x-full group-hover:opacity-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <svg
                    className="w-4 h-4 absolute translate-x-full opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </div>
                New search
              </button>
              <div className="h-6 w-px bg-gray-200"></div>
              <div>
                <h1 className="text-xl font-semibold">
                  {results.length} café{results.length !== 1 ? 's' : ''} found
                </h1>
                <p className="text-sm text-gray-600">
                  {(() => {
                    const names = searchParams.get('sourceNames');
                    const sourceName = names ? JSON.parse(names).join(', ') : searchParams.get('sourceName');
                    return `${sourceName} → ${searchParams.get('destCity')}`;
                  })()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  analytics.refineSearchOpen();
                  setIsRefineModalOpen(true);
                }}
                className="btn-secondary text-sm"
              >
                I missed your vibe?
              </button>
              <button
                onClick={handleSaveAll}
                disabled={isSavingAll}
                className="btn-secondary text-sm"
              >
                {isSavingAll ? 'Saving...' : 'Save All'}
              </button>
            </div>
          </div>
        </div>

        {/* Results grid */}
        <div className="flex-1">
          <div className="max-w-7xl mx-auto px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* List */}
              <div className="h-[calc(100vh-90px)] overflow-visible">
                <ResultsList
                  results={results}
                  onSelectResult={handleSelectResult}
                  selectedIndex={selectedIndex}
                  hoveredIndex={hoveredIndex}
                  onHover={setHoveredIndex}
                />
              </div>

              {/* Map */}
              <div className="hidden lg:block h-[calc(100vh-180px)]">
                <ResultsMap
                  results={results}
                  center={mapCenter}
                  selectedIndex={selectedIndex}
                  hoveredIndex={hoveredIndex}
                  onMarkerClick={handleMarkerClick}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details drawer */}
      {selectedResult && (
        <DetailsDrawer result={selectedResult} onClose={handleCloseDrawer} />
      )}

      {/* Refine search modal */}
      <RefineSearchModal
        isOpen={isRefineModalOpen}
        onClose={() => setIsRefineModalOpen(false)}
        currentVibes={JSON.parse(searchParams.get('vibes') || '{}')}
        currentFreeText={searchParams.get('freeText') || ''}
        sourcePlaceIds={(() => {
          const ids = searchParams.get('sourcePlaceIds');
          if (ids) return JSON.parse(ids);
          const singleId = searchParams.get('sourcePlaceId');
          return singleId ? [singleId] : [];
        })()}
        sourceNames={(() => {
          const names = searchParams.get('sourceNames');
          if (names) return JSON.parse(names);
          const singleName = searchParams.get('sourceName');
          return singleName ? [singleName] : [];
        })()}
        destCity={searchParams.get('destCity') || ''}
      />

      {/* Toast notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-4xl animate-bounce">☕</div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
