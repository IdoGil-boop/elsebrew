import { SavedCafe, UserProfile, VibeToggles } from '@/types';

const STORAGE_KEYS = {
  USER_PROFILE: 'elsebrew_user_profile',
  SAVED_CAFES: 'elsebrew_saved_cafes',
  NAVIGATION_STATE: 'elsebrew_navigation_state',
  RESULTS_STATE: 'elsebrew_results_state',
  SEARCH_FORM_STATE: 'elsebrew_search_form_state',
};

export const storage = {
  // User profile
  getUserProfile: (): UserProfile | null => {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[Storage] Error parsing user profile:', error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      return null;
    }
  },

  setUserProfile: (profile: UserProfile | null) => {
    if (typeof window === 'undefined') return;
    if (profile) {
      console.log('[Storage] Setting user profile', {
        name: profile.name,
        hasToken: !!profile.token,
        tokenLength: profile.token?.length,
      });
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } else {
      console.log('[Storage] Removing user profile');
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    }
  },

  // Saved cafes
  getSavedCafes: (): SavedCafe[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_CAFES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Storage] Error parsing saved cafes:', error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEYS.SAVED_CAFES);
      return [];
    }
  },

  saveCafe: (cafe: SavedCafe) => {
    if (typeof window === 'undefined') return;
    const saved = storage.getSavedCafes();
    const exists = saved.find(c => c.placeId === cafe.placeId);
    if (!exists) {
      saved.unshift(cafe);
      localStorage.setItem(STORAGE_KEYS.SAVED_CAFES, JSON.stringify(saved));
    }
  },

  removeSavedCafe: (placeId: string) => {
    if (typeof window === 'undefined') return;
    const saved = storage.getSavedCafes();
    const filtered = saved.filter(c => c.placeId !== placeId);
    localStorage.setItem(STORAGE_KEYS.SAVED_CAFES, JSON.stringify(filtered));
  },

  isCafeSaved: (placeId: string): boolean => {
    if (typeof window === 'undefined') return false;
    const saved = storage.getSavedCafes();
    return saved.some(c => c.placeId === placeId);
  },

  // Check if place is saved (from API or localStorage)
  async isPlaceSaved(placeId: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Check localStorage first (fast)
    if (storage.isCafeSaved(placeId)) {
      return true;
    }

    // Check API if user is logged in
    const userProfile = storage.getUserProfile();
    if (userProfile?.token) {
      try {
        const response = await fetch('/api/user/saved-places', {
          headers: {
            'Authorization': `Bearer ${userProfile.token}`,
          },
        });

        // Handle token expiration
        if (response.status === 401) {
          console.log('[Storage] Token expired - logging out user');
          storage.setUserProfile(null);
          return false;
        }

        if (response.ok) {
          const data = await response.json();
          if (data.places && Array.isArray(data.places)) {
            const isSaved = data.places.some((p: any) => p.placeId === placeId);
            // Cache in localStorage if found
            if (isSaved) {
              const place = data.places.find((p: any) => p.placeId === placeId);
              if (place) {
                storage.saveCafe({
                  placeId: place.placeId,
                  name: place.name,
                  savedAt: new Date(place.savedAt).getTime(),
                  photoUrl: place.photoUrl,
                  rating: place.rating,
                });
              }
            }
            return isSaved;
          }
        }
      } catch (error) {
        console.error('Error checking saved place:', error);
      }
    }

    return false;
  },

  // Navigation state
  getNavigationState: (): { previousRoute: string; searchParams?: string } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const data = sessionStorage.getItem(STORAGE_KEYS.NAVIGATION_STATE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[Storage] Error parsing navigation state:', error);
      sessionStorage.removeItem(STORAGE_KEYS.NAVIGATION_STATE);
      return null;
    }
  },

  setNavigationState: (state: { previousRoute: string; searchParams?: string } | null) => {
    if (typeof window === 'undefined') return;
    if (state) {
      sessionStorage.setItem(STORAGE_KEYS.NAVIGATION_STATE, JSON.stringify(state));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.NAVIGATION_STATE);
    }
  },

  // Results state (for restoring results page)
  getResultsState: (): {
    searchParams: string;
    results: any[];
    mapCenter?: { lat: number; lng: number };
    destinationCircle?: { center: { lat: number; lng: number }; radius: number } | null;
  } | null => {
    if (typeof window === 'undefined') return null;
    const data = sessionStorage.getItem(STORAGE_KEYS.RESULTS_STATE);
    return data ? JSON.parse(data) : null;
  },

  setResultsState: (
    searchParams: string | null,
    results?: any[],
    mapCenter?: { lat: number; lng: number },
    destinationCircle?: { center: { lat: number; lng: number }; radius: number } | null
  ) => {
    if (typeof window === 'undefined') return;
    if (searchParams && results) {
      // Store simplified results (without Google Maps objects which aren't serializable)
      const simplifiedResults = results.map(r => {
        // Handle photo URL extraction from new API format
        let photoUrl: string | undefined;
        try {
          if (r.place.photos?.[0]) {
            const photo = r.place.photos[0];
            // Check if getURI method exists (new API)
            if (typeof photo.getURI === 'function') {
              photoUrl = photo.getURI({ maxWidth: 400 });
            }
            // Fallback to getUrl if it exists (legacy API)
            else if (typeof photo.getUrl === 'function') {
              photoUrl = photo.getUrl({ maxWidth: 400 });
            }
          }
        } catch (error) {
          console.warn('[Storage] Error getting photo URL:', error);
        }

        // Extract location coordinates if available
        let location: { lat: number; lng: number } | undefined;
        if (r.place.location) {
          console.log('[Storage] Saving location for place:', r.place.id, {
            hasLocation: !!r.place.location,
            locationType: typeof r.place.location,
            latType: typeof (r.place.location as any).lat,
            locationValue: r.place.location,
          });
          if (typeof r.place.location.lat === 'function') {
            // google.maps.LatLng object
            location = {
              lat: r.place.location.lat(),
              lng: r.place.location.lng(),
            };
            console.log('[Storage] Extracted location from LatLng:', location);
          } else if (typeof r.place.location.lat === 'number') {
            // Already a plain object
            location = {
              lat: r.place.location.lat,
              lng: r.place.location.lng,
            };
            console.log('[Storage] Using plain location object:', location);
          } else {
            console.warn('[Storage] Unknown location format:', r.place.location);
          }
        } else {
          console.warn('[Storage] No location for place:', r.place.id);
        }

        return {
          place: {
            id: r.place.id,
            displayName: r.place.displayName,
            formattedAddress: r.place.formattedAddress,
            rating: r.place.rating,
            userRatingCount: r.place.userRatingCount,
            priceLevel: r.place.priceLevel,
            types: r.place.types,
            editorialSummary: r.place.editorialSummary,
            photoUrl,
            location, // Save location coordinates
          },
          score: r.score,
          reasoning: r.reasoning,
          matchedKeywords: r.matchedKeywords,
          distanceToCenter: r.distanceToCenter,
          imageAnalysis: r.imageAnalysis,
        };
      });
      sessionStorage.setItem(STORAGE_KEYS.RESULTS_STATE, JSON.stringify({
        searchParams,
        results: simplifiedResults,
        mapCenter: mapCenter || null,
        destinationCircle: destinationCircle || null,
      }));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.RESULTS_STATE);
    }
  },

  // Search form state (for restoring form inputs)
  getSearchFormState: (): {
    sourcePlaces: Array<{ place_id: string; name: string; formatted_address?: string }>;
    destPlace: { place_id: string; name: string; formatted_address?: string } | null;
    freeText: string;
    vibes: VibeToggles;
  } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SEARCH_FORM_STATE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[Storage] Error parsing search form state:', error);
      localStorage.removeItem(STORAGE_KEYS.SEARCH_FORM_STATE);
      return null;
    }
  },

  setSearchFormState: (state: {
    sourcePlaces: Array<{ place_id: string; name: string; formatted_address?: string }>;
    destPlace: { place_id: string; name: string; formatted_address?: string } | null;
    freeText: string;
    vibes: VibeToggles;
  } | null) => {
    if (typeof window === 'undefined') return;
    if (state) {
      localStorage.setItem(STORAGE_KEYS.SEARCH_FORM_STATE, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SEARCH_FORM_STATE);
    }
  },
};

/**
 * Get auth token from user profile
 */
export const getAuthToken = (): string | null => {
  const profile = storage.getUserProfile();
  return profile?.token || null;
};

/**
 * Check if a JWT token is expired
 * Returns true if token is expired (beyond the 24-hour grace period)
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    // Decode JWT token (base64url decode)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return true; // Invalid token format
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const decoded = JSON.parse(jsonPayload);
    const exp = decoded.exp;

    if (!exp) {
      return true; // No expiration claim
    }

    const expirationTime = exp * 1000;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    // Token is expired if it's more than 24 hours past expiration
    return now >= expirationTime + twentyFourHours;
  } catch (error) {
    console.error('[Storage] Error checking token expiration:', error);
    return true; // If we can't decode, consider it expired
  }
};

/**
 * Check and clear user profile if token is expired
 * Returns true if user was logged out, false otherwise
 */
export const checkAndClearExpiredToken = (): boolean => {
  const profile = storage.getUserProfile();
  if (!profile || !profile.token) {
    return false;
  }

  if (isTokenExpired(profile.token)) {
    console.log('[Storage] Token expired - logging out user');
    storage.setUserProfile(null);
    // Dispatch event for other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('elsebrew_auth_change'));
    }
    return true;
  }

  return false;
};
