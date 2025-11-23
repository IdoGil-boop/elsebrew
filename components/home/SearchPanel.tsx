'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { loadGoogleMaps } from '@/lib/maps-loader';
import { VibeToggles } from '@/types';
import { analytics } from '@/lib/analytics';
import Toast from '@/components/shared/Toast';
import { getAuthToken } from '@/lib/storage';

export default function SearchPanel() {
  const router = useRouter();
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [sourcePlaces, setSourcePlaces] = useState<google.maps.places.PlaceResult[]>([]);
  const [currentSourceInput, setCurrentSourceInput] = useState('');
  const [destPlace, setDestPlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [freeText, setFreeText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [vibes, setVibes] = useState<VibeToggles>({
    roastery: false,
    lightRoast: false,
    laptopFriendly: false,
    nightOwl: false,
    cozy: false,
    minimalist: false,
    allowsDogs: false,
    servesVegetarian: false,
    brunch: false,
  });

  useEffect(() => {
    const initAutocomplete = async () => {
      const google = await loadGoogleMaps();

      if (sourceInputRef.current) {
        const sourceAutocomplete = new google.maps.places.Autocomplete(
          sourceInputRef.current,
          {
            types: ['establishment'],
            fields: ['place_id', 'name', 'geometry', 'formatted_address', 'types', 'rating', 'user_ratings_total', 'price_level', 'opening_hours', 'photos', 'editorial_summary'],
          }
        );

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

      if (destInputRef.current) {
        // Use types: ['(regions)'] which includes cities, neighborhoods, and addresses but not countries
        // Combined with types: ['establishment'] for specific businesses like hotels
        // However, since 'establishment' cannot be mixed, we'll use 'geocode' and filter client-side
        const autocompleteOptions = {
          types: ['(regions)'], // Includes cities, neighborhoods, but should exclude countries
          fields: ['place_id', 'name', 'geometry', 'formatted_address', 'types'],
        };

        const destAutocomplete = new google.maps.places.Autocomplete(
          destInputRef.current,
          autocompleteOptions
        );

        destAutocomplete.addListener('place_changed', () => {
          const place = destAutocomplete.getPlace();

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
    };

    initAutocomplete();

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleVibe = (key: keyof VibeToggles) => {
    setVibes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedVibesCount = Object.values(vibes).filter(Boolean).length;

  const removeSourcePlace = (placeId: string) => {
    setSourcePlaces(prev => prev.filter(p => p.place_id !== placeId));
  };

  const handleSearch = async () => {
    if (sourcePlaces.length === 0 || !destPlace || !destPlace.name) {
      alert('Please select at least one source café and a destination city');
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

  const vibeOptions: { key: keyof VibeToggles; label: string }[] = [
    { key: 'roastery', label: 'Roastery' },
    { key: 'lightRoast', label: 'Light roast / filter-first' },
    { key: 'laptopFriendly', label: 'Laptop-friendly' },
    { key: 'nightOwl', label: 'Night-owl' },
    { key: 'cozy', label: 'Cozy' },
    { key: 'minimalist', label: 'Minimalist' },
    { key: 'allowsDogs', label: 'Allows dogs' },
    { key: 'servesVegetarian', label: 'Serves vegetarian' },
    { key: 'brunch', label: 'Brunch' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="card p-8 max-w-2xl mx-auto"
    >
      <div className="space-y-6">
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

        {/* Destination */}
        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-charcoal mb-2">
            Where are you going?
          </label>
          <input
            ref={destInputRef}
            id="destination"
            type="text"
            placeholder="e.g., Brooklyn, Times Square, Shibuya Hotel, etc."
            className="input-field"
          />
        </div>

        {/* Vibe preferences dropdown */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-medium text-charcoal mb-2">
            Vibe preferences (optional)
          </label>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="input-field w-full flex items-center justify-between"
          >
            <span className="text-gray-700">
              {selectedVibesCount > 0
                ? `${selectedVibesCount} selected`
                : 'Select preferences'}
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-200 p-2"
            >
              {vibeOptions.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={vibes[key]}
                    onChange={() => toggleVibe(key)}
                    className="w-4 h-4 text-espresso border-gray-300 rounded focus:ring-espresso focus:ring-2"
                  />
                  <span className="ml-3 text-sm text-charcoal">{label}</span>
                </label>
              ))}
            </motion.div>
          )}
        </div>

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
    </motion.div>
  );
}
