'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { loadGoogleMaps } from '@/lib/maps-loader';
import { VibeToggles } from '@/types';
import { analytics } from '@/lib/analytics';

export default function SearchPanel() {
  const router = useRouter();
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [sourcePlace, setSourcePlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [destPlace, setDestPlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [vibes, setVibes] = useState<VibeToggles>({
    roastery: false,
    lightRoast: false,
    laptopFriendly: false,
    nightOwl: false,
    cozy: false,
    minimalist: false,
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
          setSourcePlace(place);
        });
      }

      if (destInputRef.current) {
        const destAutocomplete = new google.maps.places.Autocomplete(
          destInputRef.current,
          {
            types: ['geocode', 'establishment'], // Allow cities, neighborhoods, streets, and establishments
            fields: ['place_id', 'name', 'geometry', 'formatted_address', 'types'],
          }
        );

        destAutocomplete.addListener('place_changed', () => {
          const place = destAutocomplete.getPlace();
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

  const handleSearch = () => {
    if (!sourcePlace || !sourcePlace.place_id || !destPlace || !destPlace.name) {
      alert('Please select both a source café and a destination city');
      return;
    }

    setIsLoading(true);

    // Track search
    analytics.searchSubmit({
      source_city: sourcePlace.name || '',
      dest_city: destPlace.name || '',
      toggles: vibes,
    });

    // Navigate to results with query params
    const params = new URLSearchParams({
      sourcePlaceId: sourcePlace.place_id,
      sourceName: sourcePlace.name || '',
      destCity: destPlace.name || '',
      vibes: JSON.stringify(vibes),
    });

    router.push(`/results?${params.toString()}`);
  };

  const vibeOptions: { key: keyof VibeToggles; label: string }[] = [
    { key: 'roastery', label: 'Roastery' },
    { key: 'lightRoast', label: 'Light roast / filter-first' },
    { key: 'laptopFriendly', label: 'Laptop-friendly' },
    { key: 'nightOwl', label: 'Night-owl' },
    { key: 'cozy', label: 'Cozy' },
    { key: 'minimalist', label: 'Minimalist' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="card p-8 max-w-2xl mx-auto"
    >
      <div className="space-y-6">
        {/* Source café */}
        <div>
          <label htmlFor="source" className="block text-sm font-medium text-charcoal mb-2">
            Your favorite café
          </label>
          <input
            ref={sourceInputRef}
            id="source"
            type="text"
            placeholder="e.g., Cafelix, Florentin, Tel Aviv"
            className="input-field"
          />
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

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="btn-primary w-full text-lg"
        >
          {isLoading ? 'Searching...' : 'Find my twins'}
        </button>
      </div>
    </motion.div>
  );
}
