'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CafeMatch, PlaceBasicInfo, VibeToggles, normalizeVibes } from '@/types';
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
import { generateSearchId, saveCompleteSearchState, initializeSearch, markSearchFailed, markSearchSuccessful } from '@/lib/search-state-manager';
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
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list'); // Mobile toggle

  // Pagination state
  const [currentSearchId, setCurrentSearchId] = useState<string>('');
  const [allCachedResults, setAllCachedResults] = useState<CafeMatch[]>([]);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  // Ref to prevent duplicate searches in React Strict Mode
  const isSearchInProgress = useRef(false);
  // Ref to track last executed search params to prevent duplicate executions
  const lastExecutedSearchParams = useRef<string>('');
  // Ref to preserve results when modifying search from results page
  const preservedResultsRef = useRef<CafeMatch[]>([]);

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
    
    // Normalize search params (remove refineSearch for comparison)
    const normalizeParams = (params: string) => {
      const urlParams = new URLSearchParams(params);
      urlParams.delete('refineSearch');
      return urlParams.toString();
    };
    
    const normalizedCurrent = normalizeParams(currentSearch);
    const normalizedLast = normalizeParams(lastExecutedSearchParams.current);
    
    console.log('[Results Page] useEffect triggered', {
      currentSearch,
      isSearchInProgress: isSearchInProgress.current,
      lastExecutedParams: lastExecutedSearchParams.current,
      paramsMatch: lastExecutedSearchParams.current === currentSearch,
      normalizedMatch: normalizedCurrent === normalizedLast,
    });

    // Prevent duplicate searches - only skip if we're actively executing the same search
    if (isSearchInProgress.current && lastExecutedSearchParams.current === currentSearch) {
      console.log('[Results Page] ⚠️ DUPLICATE DETECTED - Search already in progress for these params, skipping');
      logger.debug('[Results Page] Search already in progress for these params, skipping duplicate');
      return;
    }

    // If the only difference is refineSearch param being removed, skip the search
    // (This happens after a refinement completes and we clean up the URL)
    if (!isSearchInProgress.current && normalizedCurrent === normalizedLast && normalizedCurrent !== '') {
      console.log('[Results Page] ⚠️ SKIPPING - Only refineSearch param changed, not running new search');
      // Update lastExecutedParams to match current (without refineSearch)
      lastExecutedSearchParams.current = currentSearch;
      return;
    }
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
      // Preserve restored results for future refinements
      preservedResultsRef.current = [...restoredResults];
      // Restore map center if available
      if (savedState.mapCenter) {
        setMapCenter(savedState.mapCenter);
      }
      setIsLoading(false);
      // DON'T clear the saved state - keep it for future back/forward navigation
      // storage.setResultsState(null);
      return; // Don't run the search again
    }

    // New search or params changed
    // If this is a refinement (user modifying from results page), preserve current results
    // Only clear state if this is a fresh search from home page (not a refinement)
    
    // For refinements, try to preserve/restore results
    // First check if we have results in state, if not, check preserved ref
    if (isRefinement) {
      if (results.length > 0) {
        // We have results, preserve them
        preservedResultsRef.current = [...results];
        console.log('[Results] Preserved results for refinement:', results.length);
      } else if (preservedResultsRef.current.length > 0) {
        // Results were cleared, restore from preserved ref
        setResults([...preservedResultsRef.current]);
        console.log('[Results] Restored results from ref for refinement:', preservedResultsRef.current.length);
      } else {
        // No results and nothing preserved - try to get from savedState
        if (savedState && savedState.results && savedState.results.length > 0) {
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
              photoUrl: r.place.photoUrl,
            } as PlaceBasicInfo,
            score: r.score,
            reasoning: r.reasoning,
            matchedKeywords: r.matchedKeywords,
            distanceToCenter: r.distanceToCenter,
            imageAnalysis: r.imageAnalysis,
          }));
          setResults(restoredResults);
          preservedResultsRef.current = [...restoredResults];
          console.log('[Results] Restored results from savedState for refinement:', restoredResults.length);
        }
      }
    }
    
    setIsLoading(true);
    setError(null);
    
    // Only clear results/state if this is NOT a refinement (fresh search from home page)
    if (!isRefinement) {
      setResults([]);
      setSelectedResult(null);
      setSelectedIndex(null);
      preservedResultsRef.current = [];
      // Clear any old cached results since this is a new search
      if (savedState && savedState.searchParams !== currentSearch) {
        storage.setResultsState(null);
      }
    }
    // If isRefinement, don't clear anything - keep drawer open, keep results visible

    // Debug: Check auth state on results page load
    const userProfile = storage.getUserProfile();
    logger.debug('[Results Page] Loaded - auth state:', {
      hasProfile: !!userProfile,
      name: userProfile?.name,
      hasToken: !!userProfile?.token,
      tokenLength: userProfile?.token?.length,
    });

    const performSearch = async () => {
      const startTime = Date.now();
      console.log('[Results Page] Starting performSearch', { currentSearch });
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
          isSearchInProgress.current = false;
          return;
        }

        // Mark these params as being executed only after validation passes
        lastExecutedSearchParams.current = currentSearch;

        // Check rate limit before performing search
        const authToken = getAuthToken();
        const rateLimitHeaders: HeadersInit = {};
        if (authToken) {
          rateLimitHeaders['Authorization'] = `Bearer ${authToken}`;
        }

        let rateLimitData;
        try {
          console.log('[Results] Checking rate limit before search...');
          const rateLimitResponse = await fetch('/api/rate-limit/check', {
            method: 'POST',
            headers: rateLimitHeaders,
          });

          console.log('[Results] Rate limit response status:', rateLimitResponse.status);

          // Parse JSON even if status is not OK (429 still contains rate limit data)
          rateLimitData = await rateLimitResponse.json();

          if (!rateLimitResponse.ok) {
            logger.error('[Results] Rate limit API error:', rateLimitResponse.status, rateLimitResponse.statusText);
            // If response is not OK, rateLimitData.allowed should be false, but ensure it is
            if (rateLimitData.allowed !== false) {
              rateLimitData.allowed = false;
            }
          }

          console.log('[Results] Rate limit check result:', {
            allowed: rateLimitData.allowed,
            currentCount: rateLimitData.currentCount,
            remaining: rateLimitData.remaining,
            limit: rateLimitData.limit,
            blockedBy: rateLimitData.blockedBy,
          });
          logger.debug('[Results] Rate limit check:', {
            allowed: rateLimitData.allowed,
            currentCount: rateLimitData.currentCount,
            remaining: rateLimitData.remaining,
          });
        } catch (error) {
          console.error('[Results] Rate limit check failed:', error);
          logger.error('[Results] Rate limit check failed:', error);
          // On error, fail closed (block the request) to be safe
          setToastMessage('Unable to verify rate limit. Please try again later.');
          setToastType('error');
          setShowToast(true);
          setIsLoading(false);
          isSearchInProgress.current = false;
          return;
        }

        // Safety check: if rateLimitData is missing or allowed is false, block the search
        if (!rateLimitData || rateLimitData.allowed === false || !rateLimitData.allowed) {
          // Format reset time nicely
          const resetAt = rateLimitData?.resetAt ? new Date(rateLimitData.resetAt) : new Date(Date.now() + 12 * 60 * 60 * 1000);
          const now = new Date();
          const hoursUntilReset = Math.ceil((resetAt.getTime() - now.getTime()) / (1000 * 60 * 60));
          const minutesUntilReset = Math.ceil((resetAt.getTime() - now.getTime()) / (1000 * 60));
          
          let timeUntilReset: string;
          if (hoursUntilReset >= 1) {
            timeUntilReset = hoursUntilReset === 1 ? '1 hour' : `${hoursUntilReset} hours`;
          } else {
            timeUntilReset = minutesUntilReset === 1 ? '1 minute' : `${minutesUntilReset} minutes`;
          }

          const resetTime = resetAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          
          // Build message - only suggest sign-in if not already authenticated
          const isAuthenticated = rateLimitData?.isAuthenticated !== false; // Default to true if not provided
          const windowHours = rateLimitData?.windowHours || 12;
          const hoursText = windowHours === 1 ? 'hour' : 'hours';
          const limit = rateLimitData?.limit || 10;
          let message = `You've reached your search limit of ${limit} searches per ${windowHours} ${hoursText}. Your limit will refresh in ${timeUntilReset} (at ${resetTime}).`;
        
          // If this was a refinement, restore preserved results (they should never have been cleared, but be safe)
          if (isRefinement && preservedResultsRef.current.length > 0) {
            // Only restore if results are actually empty (defensive check)
            if (results.length === 0) {
              setResults(preservedResultsRef.current);
            }
          }
          
          // Don't change anything - results/state were never cleared, so nothing to restore
          // Just show the toast message
          setToastMessage(message);
          setToastType('info');
          setShowToast(true);
          setIsLoading(false);
          isSearchInProgress.current = false;
          
          // Don't change anything else - keep drawer open, keep results visible, don't reload
          return;
        }

        const vibes: VibeToggles = normalizeVibes(JSON.parse(vibesParam));

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

        // Check if this is a refinement that just shows more cached results (same searchId)
        // vs a modification (different searchId) - modifications should count toward rate limit
        let isJustShowingMoreResults = false;
        
        if (isRefinement) {
          // Check if searchId exists in cache (same search = just showing more results, don't count)
          // If searchId doesn't exist = modification (count it, rate limit already checked above)
          try {
            const authToken = getAuthToken();
            const headers: HeadersInit = {};
            if (authToken) {
              headers['Authorization'] = `Bearer ${authToken}`;
            }

            const existingStateResponse = await fetch(
              `/api/search-state?searchId=${encodeURIComponent(searchId)}`,
              { headers }
            );

            if (existingStateResponse.ok) {
              const { searchState } = await existingStateResponse.json();
              // If search state exists with this exact searchId, it's just showing more results
              if (searchState && searchState.searchId === searchId) {
                isJustShowingMoreResults = true;
              }
            }
          } catch (error) {
            logger.warn('[Results] Error checking if refinement is just showing more results:', error);
            // On error, assume it's a modification (count it)
          }
        }

        // If this is a refinement with same searchId (just showing more cached results), skip rate limit
        // Rate limit was already checked above for new searches and modifications
        if (isRefinement && isJustShowingMoreResults) {
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

                  // Reconstruct CafeMatch objects with all cached data
                  const cachedMatches: CafeMatch[] = nextBatch.map((r: any) => ({
                    place: {
                      id: r.placeId,
                      displayName: r.name,
                      photoUrl: r.photoUrl, // Include photoUrl from cache
                    } as PlaceBasicInfo,
                    score: r.score,
                    reasoning: r.reasoning || 'Similar vibe and quality.', // Use cached AI description
                    matchedKeywords: r.matchedKeywords || [],
                    distanceToCenter: r.distanceToCenter,
                    imageAnalysis: r.imageAnalysis, // Restore AI image analysis
                  }));

                  setResults(cachedMatches);
                  // Preserve cached results for future refinements
                  preservedResultsRef.current = [...cachedMatches];
                  setCurrentSearchId(searchId);
                  setIsLoading(false);
                  lastExecutedSearchParams.current = currentSearch; // Mark as executed
                  isSearchInProgress.current = false; // Reset flag since we're done

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

        // Initialize search history (register search as 'pending')
        // Get source place names for initialization
        let sourceNamesForInit: string[] = [];
        if (sourceNamesParam) {
          sourceNamesForInit = JSON.parse(sourceNamesParam);
        }
        const originPlacesForInit = sourcePlaceIds.map((id, idx) => ({
          placeId: id,
          name: sourceNamesForInit[idx] || 'Unknown',
        }));
        const vibesArray = Object.entries(vibes)
          .filter(([_, enabled]) => enabled)
          .map(([vibe]) => vibe);

        await initializeSearch(
          searchId,
          originPlacesForInit,
          destCity,
          vibesArray,
          freeText || undefined
        );

        // Load Google Maps with better error handling
        let google;
        try {
          google = await loadGoogleMaps();
        } catch (mapError) {
          logger.error('[Results] Failed to load Google Maps:', mapError);
          await markSearchFailed(
            searchId,
            'unknown',
            'Failed to load Google Maps. Please check your API key configuration.'
          );
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
        let geocodeResult;
        try {
          geocodeResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
            geocoder.geocode({ address: destCity }, (results, status) => {
              if (status === google.maps.GeocoderStatus.OK && results) {
                resolve(results);
              } else if (status === google.maps.GeocoderStatus.ZERO_RESULTS) {
                reject(new Error(`Could not find location for "${destCity}". Please try a more specific city or address.`));
              } else {
                reject(new Error(`Geocoding failed: ${status}`));
              }
            });
          });
        } catch (error: any) {
          logger.error('[Results] Geocoding error:', error);
          const errorMessage = error.message || 'Failed to geocode destination. Please try a different city or address.';
          await markSearchFailed(searchId, 'geocoding', errorMessage);
          setError(errorMessage);
          setIsLoading(false);
          isSearchInProgress.current = false;
          return;
        }

        if (!geocodeResult || !geocodeResult[0]) {
          const errorMessage = `Could not find location for "${destCity}". Please try a more specific city or address.`;
          await markSearchFailed(searchId, 'geocoding', errorMessage);
          setError(errorMessage);
          setIsLoading(false);
          isSearchInProgress.current = false;
          return;
        }

        const destResult = geocodeResult[0];
        const destGeometry = destResult.geometry;
        if (!destGeometry || !destGeometry.location) {
          const errorMessage = `Invalid location data for "${destCity}". Please try a different city or address.`;
          await markSearchFailed(searchId, 'geocoding', errorMessage);
          setError(errorMessage);
          setIsLoading(false);
          isSearchInProgress.current = false;
          return;
        }

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

        // Get places to penalize (seen but not saved)
        // Works for both logged-in users (by userId) and anonymous users (by IP)
        let placeIdsToPenalize: string[] = [];
        try {
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
            placeIdsToPenalize = data.placeIdsToPenalize || [];
            logger.debug('[Results] Found seen places to penalize:', placeIdsToPenalize.length);
          }
        } catch (error) {
          logger.warn('[Results] Failed to fetch filter list:', error);
          // Continue without filtering
        }

        // Set the search ID (already generated earlier)
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
          placeIdsToPenalize, // Pass places to penalize
          undefined, // pageToken
          freeText || '' // Pass free text for field relevance detection
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
        // Preserve results whenever they're set (for future refinements)
        preservedResultsRef.current = [...matchesWithReasoning];

        // Mark search as successful and save results
        const resultsToSave = matchesWithReasoning.map(r => {
          // Extract photoUrl from photos if available
          let photoUrl: string | undefined = undefined;
          try {
            if (r.place.photos?.[0]) {
              photoUrl = getPhotoUrl(r.place.photos[0], 400);
            }
          } catch (error) {
            // Ignore errors extracting photo URL
          }
          // Use existing photoUrl if available (from previous cache or details API)
          if (!photoUrl && r.place.photoUrl) {
            photoUrl = r.place.photoUrl;
          }

          return {
            placeId: r.place.id,
            name: r.place.displayName,
            score: r.score,
            photoUrl,
            reasoning: r.reasoning,
            matchedKeywords: r.matchedKeywords || [],
            distanceToCenter: r.distanceToCenter,
            imageAnalysis: r.imageAnalysis,
          };
        });

        const allResultsToSave = searchResult.allScoredResults.map(r => {
          // Extract photoUrl from photos if available
          let photoUrl: string | undefined = undefined;
          try {
            if (r.place.photos?.[0]) {
              photoUrl = getPhotoUrl(r.place.photos[0], 400);
            }
          } catch (error) {
            // Ignore errors extracting photo URL
          }
          // Use existing photoUrl if available (from previous cache or details API)
          if (!photoUrl && r.place.photoUrl) {
            photoUrl = r.place.photoUrl;
          }

          return {
            placeId: r.place.id,
            name: r.place.displayName,
            score: r.score,
            photoUrl,
            reasoning: r.reasoning,
            matchedKeywords: r.matchedKeywords || [],
            distanceToCenter: r.distanceToCenter,
            imageAnalysis: r.imageAnalysis,
          };
        });

        markSearchSuccessful(
          searchId,
          resultsToSave,
          allResultsToSave,
          searchResult.hasMorePages,
          searchResult.nextPageToken
        ).catch(err => logger.warn('[Results] Failed to mark search as successful:', err));

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
        console.log('[Results Page] Search completed successfully');
      } catch (err) {
        logger.error('Search error:', err);
        console.log('[Results Page] Search failed:', err);
        const errorMessage = err instanceof Error ? err.message : 'Search failed';

        // Mark search as failed if we have a searchId
        if (currentSearchId) {
          await markSearchFailed(currentSearchId, 'unknown', errorMessage);
        }

        setError(errorMessage);
        setIsLoading(false);
      } finally {
        console.log('[Results Page] Resetting isSearchInProgress flag');
        isSearchInProgress.current = false;
      }
    };

    performSearch();

    // Cleanup function - don't reset isSearchInProgress here as it's handled in finally block
    // Only reset if searchParams actually changed (not just a re-render)
    return () => {
      // Only reset if the params are different (component unmounting or params changed)
      if (lastExecutedSearchParams.current !== currentSearch) {
        isSearchInProgress.current = false;
      }
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

  // Don't show "No matches found" if we're still loading
  // Also don't show it if we have preserved results from a refinement (rate limit hit)
  const hasPreservedResults = preservedResultsRef.current.length > 0;
  if (results.length === 0 && !isLoading && !hasPreservedResults) {
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
        {/* Header - Sticky */}
        <div className="bg-white border-b border-gray-100 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0 sticky top-14 sm:top-16 z-40">
          <div className="max-w-7xl mx-auto">
            {/* Top row - Back button and title */}
            <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-0">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 hover:text-espresso transition-colors duration-800 group flex-shrink-0"
              >
                <div className="relative w-3 h-3 sm:w-4 sm:h-4 overflow-hidden">
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4 absolute transition-all duration-300 group-hover:-translate-x-full group-hover:opacity-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4 absolute translate-x-full opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </div>
                <span className="hidden sm:inline">New search</span>
              </button>
              <div className="h-4 sm:h-6 w-px bg-gray-200"></div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-xl font-semibold truncate">
                  {results.length} café{results.length !== 1 ? 's' : ''} found
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  {(() => {
                    const names = searchParams.get('sourceNames');
                    const sourceName = names ? JSON.parse(names).join(', ') : searchParams.get('sourceName');
                    return `${sourceName} → ${searchParams.get('destCity')}`;
                  })()}
                </p>
              </div>
            </div>

            {/* Bottom row - Action buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => {
                  analytics.refineSearchOpen();
                  setIsRefineModalOpen(true);
                }}
                className="btn-secondary text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3 flex-1 sm:flex-none whitespace-nowrap"
              >
                <span className="hidden sm:inline">I missed your vibe?</span>
                <span className="sm:hidden">Missed vibe?</span>
              </button>
              <button
                onClick={handleSaveAll}
                disabled={isSavingAll}
                className="btn-secondary text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3 flex-1 sm:flex-none"
              >
                {isSavingAll ? 'Saving...' : 'Save All'}
              </button>

              {/* Mobile view toggle */}
              <div className="lg:hidden flex gap-1 border border-gray-200 rounded-2xl p-1 flex-1 sm:flex-none">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-espresso text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    viewMode === 'map'
                      ? 'bg-espresso text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Map
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results grid */}
        <div className="flex-1">
          <div className="max-w-7xl mx-auto px-0 sm:px-8 py-0 sm:py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-8">
              {/* List - Show on mobile when viewMode is 'list', always show on desktop */}
              <div className={`${viewMode === 'list' ? 'block' : 'hidden'} lg:block h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)] overflow-visible`}>
                <ResultsList
                  results={results}
                  onSelectResult={handleSelectResult}
                  selectedIndex={selectedIndex}
                  hoveredIndex={hoveredIndex}
                  onHover={setHoveredIndex}
                />
              </div>

              {/* Map - Show on mobile when viewMode is 'map', always show on desktop */}
              <div className={`${viewMode === 'map' ? 'block' : 'hidden'} lg:block h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)]`}>
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
        currentVibes={normalizeVibes(JSON.parse(searchParams.get('vibes') || '{}'))}
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
