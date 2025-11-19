import { SavedCafe, UserProfile } from '@/types';

const STORAGE_KEYS = {
  USER_PROFILE: 'elsebrew_user_profile',
  SAVED_CAFES: 'elsebrew_saved_cafes',
  NAVIGATION_STATE: 'elsebrew_navigation_state',
  RESULTS_STATE: 'elsebrew_results_state',
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
  getResultsState: (): { searchParams: string; results: any[]; mapCenter?: { lat: number; lng: number } } | null => {
    if (typeof window === 'undefined') return null;
    const data = sessionStorage.getItem(STORAGE_KEYS.RESULTS_STATE);
    return data ? JSON.parse(data) : null;
  },

  setResultsState: (searchParams: string | null, results?: any[], mapCenter?: { lat: number; lng: number }) => {
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
      }));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.RESULTS_STATE);
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
