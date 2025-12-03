'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { loadGoogleMaps } from '@/lib/maps-loader';
import { analytics } from '@/lib/analytics';
import Toast from '@/components/shared/Toast';
import { getAuthToken, storage } from '@/lib/storage';
import VibeSelector from './VibeSelector';
import PricingModal from './PricingModal';
import { getRecommendedVibes } from '@/lib/recommendedVibes';

export default function SearchPanel() {
  const router = useRouter();
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  const [sourcePlaces, setSourcePlaces] = useState<google.maps.places.PlaceResult[]>([]);
  const [currentSourceInput, setCurrentSourceInput] = useState('');
  const [destPlace, setDestPlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [freeText, setFreeText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | ReactNode>('');
  const [showToast, setShowToast] = useState(false);

  // Premium features state
  const [isPremium, setIsPremium] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [recommendedVibeIds, setRecommendedVibeIds] = useState<string[]>([]);

  // Changed from VibeToggles to Record<string, boolean> for dynamic vibes
  const [vibes, setVibes] = useState<Record<string, boolean>>({});

  // Check subscription status on mount
  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const response = await fetch('/api/user/subscription');
        if (response.ok) {
          const subscription = await response.json();
          setIsPremium(subscription.tier === 'premium');
        }
      } catch (error) {
        console.error('[SearchPanel] Error checking subscription:', error);
      }
    };
    checkSubscription();
  }, []);

  // Fetch recommended vibes when source places change
  useEffect(() => {
    const fetchRecommendedVibes = async () => {
      console.log('[SearchPanel] fetchRecommendedVibes called', {
        sourcePlacesCount: sourcePlaces.length,
        isPremium,
        sourcePlaces: sourcePlaces.map(p => ({ name: p.name, place_id: p.place_id })),
      });

      // Fetch if user has source places (premium check happens in API)
      if (sourcePlaces.length === 0) {
        console.log('[SearchPanel] No source places, clearing recommendations');
        setRecommendedVibeIds([]);
        return;
      }

      try {
        // Fetch advanced fields for source places
        const placeIds = sourcePlaces.map(p => p.place_id).filter(Boolean) as string[];
        console.log('[SearchPanel] Place IDs to fetch:', placeIds);
        
        if (placeIds.length === 0) {
          console.warn('[SearchPanel] No valid place IDs found');
          setRecommendedVibeIds([]);
          return;
        }

        console.log('[SearchPanel] Fetching advanced fields from API...');
        const response = await fetch('/api/google/places/details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            placeIds,
            vibes: {}, // Empty vibes to get all fields for recommendations
            keywords: [],
            freeText: '',
            forRecommendations: true, // Flag to allow non-premium users to get fields for recommendations
          }),
        });

        console.log('[SearchPanel] API response status:', response.status, response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('[SearchPanel] Failed to fetch advanced fields for recommendations:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
          setRecommendedVibeIds([]);
          return;
        }

        const data = await response.json();
        console.log('[SearchPanel] API response data:', {
          hasFieldsByPlaceId: !!data?.fieldsByPlaceId,
          placeIdsInResponse: data?.fieldsByPlaceId ? Object.keys(data.fieldsByPlaceId) : [],
          fieldsSample: data?.fieldsByPlaceId ? Object.entries(data.fieldsByPlaceId).slice(0, 1).map(([id, fields]) => ({
            placeId: id,
            fieldCount: Object.keys(fields as object).length,
            fields: Object.keys(fields as object),
          })) : [],
        });

        if (!data?.fieldsByPlaceId) {
          console.warn('[SearchPanel] No fieldsByPlaceId in response');
          setRecommendedVibeIds([]);
          return;
        }

        // Convert to format expected by getRecommendedVibes
        const sourcePlacesWithFields = sourcePlaces.map(place => ({
          placeId: place.place_id || '',
          advancedFields: data.fieldsByPlaceId[place.place_id || ''] || {},
          types: place.types,
        }));

        console.log('[SearchPanel] Source places with fields:', sourcePlacesWithFields.map(sp => ({
          placeId: sp.placeId,
          hasAdvancedFields: Object.keys(sp.advancedFields || {}).length > 0,
          fieldCount: Object.keys(sp.advancedFields || {}).length,
        })));

        // Get recommended vibes
        console.log('[SearchPanel] Calling getRecommendedVibes...');
        const recommended = await getRecommendedVibes(sourcePlacesWithFields);
        console.log('[SearchPanel] Recommended vibes returned:', recommended);
        setRecommendedVibeIds(recommended);
      } catch (error) {
        console.error('[SearchPanel] Error fetching recommended vibes:', error);
        setRecommendedVibeIds([]); // Set empty on error
      }
    };

    fetchRecommendedVibes();
  }, [sourcePlaces, isPremium]);

  useEffect(() => {
    // Restore cached form state
    const cachedState = storage.getSearchFormState();
    if (cachedState) {
      setFreeText(cachedState.freeText || '');
      // Restore vibes as Record<string, boolean>
      setVibes(cachedState.vibes || {});
    }

    const initAutocomplete = async () => {
      const google = await loadGoogleMaps();

      // Initialize destination autocomplete first (matches DOM order)
      if (destInputRef.current) {
        // Explicitly include both geocode (cities, neighborhoods) and establishment (hotels, etc.)
        // Combining these types returns all place types
        const autocompleteOptions = {
          types: ['geocode', 'establishment'], // Includes both regions and establishments
          fields: ['place_id', 'name', 'geometry', 'formatted_address', 'types'],
        };

        const destAutocomplete = new google.maps.places.Autocomplete(
          destInputRef.current,
          autocompleteOptions
        );

        // Restore destination place if cached (after autocomplete is created)
        if (cachedState?.destPlace && destInputRef.current) {
          // Set the input value
          destInputRef.current.value = cachedState.destPlace.name;
          
          // Create a minimal place object for the cached destination
          const cachedDestPlace: google.maps.places.PlaceResult = {
            place_id: cachedState.destPlace.place_id,
            name: cachedState.destPlace.name,
            formatted_address: cachedState.destPlace.formatted_address,
          } as google.maps.places.PlaceResult;
          setDestPlace(cachedDestPlace);
        }

        destAutocomplete.addListener('place_changed', () => {
          const place = destAutocomplete.getPlace();
          
          console.log('[SearchPanel] Destination place selected:', {
            name: place.name,
            types: place.types,
            place_id: place.place_id,
            hasGeometry: !!place.geometry,
            hasViewport: !!place.geometry?.viewport,
          });

          // Filter out countries and continents
          const BLOCKED_TYPES = ['country', 'continent'];
          const hasBlockedType = place.types?.some((type: string) => BLOCKED_TYPES.includes(type));

          if (hasBlockedType) {
            console.warn('[SearchPanel] Blocked destination type:', place.types);
            setToastMessage('Oops! I still didn\'t get Elsebrew to support this large area, but I\'m working on it! Please try something a bit more specific like a city or neighborhood.');
            setShowToast(true);
            if (destInputRef.current) {
              destInputRef.current.value = '';
            }
            setDestPlace(null);
            return;
          }

          setDestPlace(place);
        });
      }

      // Initialize source (favorite places) autocomplete second
      if (sourceInputRef.current) {
        const sourceAutocomplete = new google.maps.places.Autocomplete(
          sourceInputRef.current,
          {
            types: ['establishment'],
            fields: ['place_id', 'name', 'geometry', 'formatted_address', 'types', 'rating', 'user_ratings_total', 'price_level', 'opening_hours', 'photos', 'editorial_summary'],
          }
        );

        // Restore source places if cached
        if (cachedState?.sourcePlaces && cachedState.sourcePlaces.length > 0) {
          const restoredPlaces: google.maps.places.PlaceResult[] = cachedState.sourcePlaces.map(sp => ({
            place_id: sp.place_id,
            name: sp.name,
            formatted_address: sp.formatted_address,
          } as google.maps.places.PlaceResult));
          setSourcePlaces(restoredPlaces);
        }

        sourceAutocomplete.addListener('place_changed', () => {
          const place = sourceAutocomplete.getPlace();
          if (place && place.place_id) {
            // Add to list if not already present
            setSourcePlaces(prev => {
              const exists = prev.some(p => p.place_id === place.place_id);
              if (exists) return prev;
              return [...prev, place];
            });
            // Clear input for next entry
            if (sourceInputRef.current) {
              sourceInputRef.current.value = '';
            }
            setCurrentSourceInput('');
          }
        });
      }
    };

    initAutocomplete();
  }, []);

  const removeSourcePlace = (placeId: string) => {
    setSourcePlaces(prev => prev.filter(p => p.place_id !== placeId));
  };

  const handleSearch = async () => {
    if (sourcePlaces.length === 0 || !destPlace || !destPlace.name) {
      alert('Please select at least one source café and a destination city');
      return;
    }

    // Check if user is authenticated
    const userProfile = storage.getUserProfile();
    if (!userProfile || !userProfile.token) {
      setToastMessage(
        <>
          Hey there! Please <strong>sign in</strong> with Google to start your search adventure. We&apos;d love to help you find your perfect café match! ✨
        </>
      );
      setShowToast(true);
      return;
    }

    setIsLoading(true);

    // Check rate limit before navigating
    try {
      const authToken = getAuthToken();
      const rateLimitHeaders: HeadersInit = {};
      if (authToken) {
        rateLimitHeaders['Authorization'] = `Bearer ${authToken}`;
      }

      const rateLimitResponse = await fetch('/api/rate-limit/check', {
        method: 'POST',
        headers: rateLimitHeaders,
      });

      const rateLimitData = await rateLimitResponse.json();

      if (!rateLimitData.allowed) {
        // Format reset time nicely
        const resetAt = new Date(rateLimitData.resetAt);
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
        const isAuthenticated = rateLimitData.isAuthenticated !== false;
        const windowHours = rateLimitData.windowHours || 12;
        const hoursText = windowHours === 1 ? 'hour' : 'hours';
        let message = `You've reached your search limit of ${rateLimitData.limit} searches per ${windowHours} ${hoursText}. Your limit will refresh in ${timeUntilReset} (at ${resetTime}).`;

        
        setToastMessage(message);
        setShowToast(true);
        setIsLoading(false);
        return; // Don't navigate
      }
    } catch (error) {
      console.error('[SearchPanel] Rate limit check failed:', error);
      // On error, allow the search (fail open for better UX)
    }

    // Track search
    analytics.searchSubmit({
      source_city: sourcePlaces.map(p => p.name).join(', '),
      dest_city: destPlace.name || '',
      toggles: vibes,
      multi_cafe: sourcePlaces.length > 1,
      has_free_text: !!freeText,
    });

    // Track additional events
    if (sourcePlaces.length > 1) {
      analytics.multiCafeSearch({ cafe_count: sourcePlaces.length });
    }
    if (freeText.trim()) {
      analytics.freeTextSearch({ has_text: true });
    }

    // Cache form state before navigating
    storage.setSearchFormState({
      sourcePlaces: sourcePlaces.map(p => ({
        place_id: p.place_id!,
        name: p.name || '',
        formatted_address: p.formatted_address,
      })),
      destPlace: destPlace ? {
        place_id: destPlace.place_id!,
        name: destPlace.name || '',
        formatted_address: destPlace.formatted_address,
      } : null,
      freeText,
      vibes,
    });

    // Navigate to results with query params
    const params = new URLSearchParams({
      sourcePlaceIds: JSON.stringify(sourcePlaces.map(p => p.place_id)),
      sourceNames: JSON.stringify(sourcePlaces.map(p => p.name || '')),
      destCity: destPlace.name || '',
      vibes: JSON.stringify(vibes),
    });

    if (freeText.trim()) {
      params.append('freeText', freeText.trim());
    }

    router.push(`/results?${params.toString()}`);
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="card p-8 max-w-2xl mx-auto"
    >
      <div className="space-y-6">
        {/* Destination */}
        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-charcoal mb-2">
            Where are you going?
            <span className="text-xs text-gray-500 ml-2 font-normal">
              Enter an area like a city or neighborhood, or a specific place like your hotel 
            </span>
          </label>
          <input
            ref={destInputRef}
            id="destination"
            type="text"
            placeholder="e.g., Brooklyn, Times Square, Shibuya Hotel, etc."
            className="input-field"
          />
        </div>

        {/* Source café(s) */}
        <div>
          <label htmlFor="source" className="block text-sm font-medium text-charcoal mb-2">
            Your favorite café(s)
            <span className="text-xs text-gray-500 ml-2 font-normal">
              You can add multiple cafes to find places that match all of them
            </span>
          </label>
          <input
            ref={sourceInputRef}
            id="source"
            type="text"
            placeholder="e.g., Cafelix, Florentin, Tel Aviv"
            className="input-field"
            value={currentSourceInput}
            onChange={(e) => setCurrentSourceInput(e.target.value)}
          />

          {/* Selected cafes */}
          {sourcePlaces.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {sourcePlaces.map((place) => (
                <motion.div
                  key={place.place_id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-espresso/10 text-espresso rounded-full text-sm"
                >
                  <span>{place.name}</span>
                  <button
                    onClick={() => removeSourcePlace(place.place_id!)}
                    className="hover:bg-espresso/20 rounded-full p-0.5 transition-colors"
                    aria-label="Remove cafe"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Vibe preferences - New searchable modal with 40+ vibes */}
        <VibeSelector
          selectedVibes={vibes}
          onVibesChange={setVibes}
          recommendedVibeIds={recommendedVibeIds}
          isPremium={isPremium}
          onUpgradeClick={() => setShowPricingModal(true)}
        />

        {/* Free text for additional preferences */}
        <div>
          <label htmlFor="freeText" className="block text-sm font-medium text-charcoal mb-2">
            Additional preferences (optional)
            <span className="text-xs text-gray-500 ml-2 font-normal">
              e.g., &quot;great pastries&quot;, &quot;outdoor seating&quot;, &quot;quiet atmosphere&quot;
            </span>
          </label>
          <textarea
            id="freeText"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Describe any other qualities you're looking for..."
            className="input-field min-h-[80px] resize-none"
            rows={3}
          />
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="btn-primary w-full text-lg"
        >
          {isLoading ? 'Searching...' : 'Find my twins'}
        </button>
      </div>

      {/* Toast notification */}
      <Toast
        message={toastMessage}
        type="warning"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={5000}
      />

      {/* Pricing Modal for Upgrade */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        source="vibe-selector"
      />
    </motion.div>
  );
}
