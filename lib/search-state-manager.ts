import { SearchState, CafeMatch, VibeToggles } from '@/types';
import { getAuthToken } from './storage';

/**
 * Initialize a search in pending status
 * Called immediately after rate limit check passes
 */
export async function initializeSearch(
  searchId: string,
  originPlaces: Array<{ placeId: string; name: string }>,
  destination: string,
  vibes: string[],
  freeText?: string
): Promise<void> {
  try {
    const authToken = getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    await fetch('/api/search-state/initialize', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        searchId,
        originPlaces,
        destination,
        vibes,
        freeText,
      }),
    });
  } catch (error) {
    console.error('[Search State Manager] Error initializing search:', error);
    // Don't throw - initialization is best effort
  }
}

/**
 * Mark search as failed with error details
 */
export async function markSearchFailed(
  searchId: string,
  stage: 'rate_limit' | 'geocoding' | 'place_search' | 'ai_analysis' | 'unknown',
  message: string
): Promise<void> {
  try {
    const authToken = getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    await fetch('/api/search-state/fail', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        searchId,
        stage,
        message,
      }),
    });
  } catch (error) {
    console.error('[Search State Manager] Error marking search as failed:', error);
    // Don't throw - failure tracking is best effort
  }
}

/**
 * Mark search as successful with results
 */
export async function markSearchSuccessful(
  searchId: string,
  results: Array<{
    placeId: string;
    name: string;
    score: number;
    photoUrl?: string;
    reasoning?: string;
    matchedKeywords?: string[];
    distanceToCenter?: number;
    imageAnalysis?: string;
  }>,
  allResults?: Array<{
    placeId: string;
    name: string;
    score: number;
    photoUrl?: string;
    reasoning?: string;
    matchedKeywords?: string[];
    distanceToCenter?: number;
    imageAnalysis?: string;
  }>,
  hasMorePages?: boolean,
  nextPageToken?: string
): Promise<void> {
  try {
    const authToken = getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    await fetch('/api/search-state/success', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        searchId,
        results,
        allResults,
        hasMorePages,
        nextPageToken,
      }),
    });
  } catch (error) {
    console.error('[Search State Manager] Error marking search as successful:', error);
    // Don't throw - success tracking is best effort
  }
}

/**
 * Generate a unique search ID based on search parameters
 */
export function generateSearchId(
  originPlaceIds: string[],
  destination: string,
  vibes: VibeToggles,
  freeText?: string
): string {
  const vibesArray = Object.entries(vibes)
    .filter(([_, enabled]) => enabled)
    .map(([vibe]) => vibe)
    .sort();

  const sortedOrigins = [...originPlaceIds].sort();

  return `${sortedOrigins.join('-')}_${destination}_${vibesArray.join('-')}_${freeText || ''}`;
}

/**
 * Check if two search states are the same (ignoring timestamps)
 */
export function areSearchStatesEqual(
  state1: Partial<SearchState>,
  state2: Partial<SearchState>
): boolean {
  // Compare origin places
  const origins1 = state1.originPlaces?.map(o => o.placeId).sort() || [];
  const origins2 = state2.originPlaces?.map(o => o.placeId).sort() || [];
  if (JSON.stringify(origins1) !== JSON.stringify(origins2)) return false;

  // Compare destination
  if (state1.destination !== state2.destination) return false;

  // Compare vibes
  const vibes1Sorted = Object.entries(state1.vibes || {})
    .filter(([_, enabled]) => enabled)
    .map(([vibe]) => vibe)
    .sort();
  const vibes2Sorted = Object.entries(state2.vibes || {})
    .filter(([_, enabled]) => enabled)
    .map(([vibe]) => vibe)
    .sort();
  if (JSON.stringify(vibes1Sorted) !== JSON.stringify(vibes2Sorted)) return false;

  // Compare free text
  if ((state1.freeText || '') !== (state2.freeText || '')) return false;

  return true;
}

/**
 * Get next batch of results from cached search state
 * Returns null if need to fetch from Google
 */
export async function getNextResultsBatch(
  currentSearchId: string,
  batchSize: number = 5
): Promise<{ results: CafeMatch[]; searchState: any } | null> {
  try {
    const authToken = getAuthToken();
    const headers: HeadersInit = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(
      `/api/search-state?searchId=${encodeURIComponent(currentSearchId)}`,
      { headers }
    );

    if (!response.ok) {
      return null;
    }

    const { searchState } = await response.json();

    if (!searchState || !searchState.allResults) {
      return null;
    }

    // Get place IDs already shown
    const shownIds = new Set(searchState.shownPlaceIds || []);

    // Find unseen results
    const unseenResults = searchState.allResults.filter(
      (r: any) => !shownIds.has(r.placeId)
    );

    if (unseenResults.length === 0) {
      // No more cached results, need to fetch next page from Google
      return null;
    }

    // Return next batch
    const nextBatch = unseenResults.slice(0, batchSize);

    return {
      results: nextBatch,
      searchState,
    };
  } catch (error) {
    console.error('[Search State Manager] Error getting next batch:', error);
    return null;
  }
}

/**
 * Update search state with newly shown results
 */
export async function markResultsAsShown(
  searchId: string,
  newlyShownPlaceIds: string[]
): Promise<void> {
  try {
    const authToken = getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // First get current state
    const getResponse = await fetch(
      `/api/search-state?searchId=${encodeURIComponent(searchId)}`,
      { headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {} }
    );

    if (!getResponse.ok) {
      console.error('[Search State Manager] Failed to get current state');
      return;
    }

    const { searchState } = await getResponse.json();
    const currentShownIds = searchState.shownPlaceIds || [];
    const updatedShownIds = [...new Set([...currentShownIds, ...newlyShownPlaceIds])];

    // Update with new shown IDs
    await fetch('/api/search-state', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        searchId,
        updates: {
          shownPlaceIds: updatedShownIds,
        },
      }),
    });
  } catch (error) {
    console.error('[Search State Manager] Error marking results as shown:', error);
  }
}

/**
 * Save complete search state
 */
export async function saveCompleteSearchState(
  searchId: string,
  originPlaces: Array<{ placeId: string; name: string }>,
  destination: string,
  vibes: string[],
  freeText: string | undefined,
  displayedResults: CafeMatch[],
  allResults: CafeMatch[],
  hasMorePages: boolean,
  nextPageToken?: string
): Promise<void> {
  try {
    const authToken = getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    await fetch('/api/search-state', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        searchId,
        originPlaces,
        destination,
        vibes,
        freeText,
        results: displayedResults.map(r => {
          // Extract photoUrl from photos if available
          let photoUrl: string | undefined = undefined;
          try {
            if (r.place.photos?.[0]) {
              const photo = r.place.photos[0] as any;
              if (typeof photo.getURI === 'function') {
                photoUrl = photo.getURI({ maxWidth: 400 });
              } else if (typeof photo.getUrl === 'function') {
                photoUrl = photo.getUrl({ maxWidth: 400 });
              }
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
            imageAnalysis: r.imageAnalysis, // Store AI image analysis
          };
        }),
        allResults: allResults.map(r => {
          // Extract photoUrl from photos if available
          let photoUrl: string | undefined = undefined;
          try {
            if (r.place.photos?.[0]) {
              const photo = r.place.photos[0] as any;
              if (typeof photo.getURI === 'function') {
                photoUrl = photo.getURI({ maxWidth: 400 });
              } else if (typeof photo.getUrl === 'function') {
                photoUrl = photo.getUrl({ maxWidth: 400 });
              }
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
            imageAnalysis: r.imageAnalysis, // Store AI image analysis
          };
        }),
        shownPlaceIds: displayedResults.map(r => r.place.id),
        currentPage: 0,
        hasMorePages,
        nextPageToken,
      }),
    });
  } catch (error) {
    console.error('[Search State Manager] Error saving search state:', error);
  }
}
