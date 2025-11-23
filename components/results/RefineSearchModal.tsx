'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VibeToggles } from '@/types';
import { useRouter } from 'next/navigation';
import { analytics } from '@/lib/analytics';
import { getAuthToken } from '@/lib/storage';
import Toast from '@/components/shared/Toast';

interface RefineSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVibes: VibeToggles;
  currentFreeText?: string;
  sourcePlaceIds: string[];
  sourceNames: string[];
  destCity: string;
}

export default function RefineSearchModal({
  isOpen,
  onClose,
  currentVibes,
  currentFreeText = '',
  sourcePlaceIds,
  sourceNames,
  destCity,
}: RefineSearchModalProps) {
  const router = useRouter();
  const [vibes, setVibes] = useState<VibeToggles>(currentVibes);
  const [freeText, setFreeText] = useState(currentFreeText);
  const [isCheckingRateLimit, setIsCheckingRateLimit] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    setVibes(currentVibes);
    setFreeText(currentFreeText);
  }, [currentVibes, currentFreeText, isOpen]);

  const toggleVibe = (key: keyof VibeToggles) => {
    setVibes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApply = async () => {
    try {
      setIsCheckingRateLimit(true);

      // Check rate limit before navigating
      const authToken = getAuthToken();
      const rateLimitHeaders: HeadersInit = {};
      if (authToken) {
        rateLimitHeaders['Authorization'] = `Bearer ${authToken}`;
      }

      let rateLimitData;
      try {
        const rateLimitResponse = await fetch('/api/rate-limit/check', {
          method: 'POST',
          headers: rateLimitHeaders,
        });

        // Parse JSON even if status is not OK (429 still contains rate limit data)
        rateLimitData = await rateLimitResponse.json();

        if (!rateLimitResponse.ok) {
          // If response is not OK, rateLimitData.allowed should be false, but ensure it is
          if (rateLimitData.allowed !== false) {
            rateLimitData.allowed = false;
          }
        }
      } catch (error) {
        console.error('[RefineSearchModal] Rate limit check failed:', error);
        // On error, allow the search (fail open for better UX)
        rateLimitData = { allowed: true };
      }

      // If rate limit is hit, show message and don't navigate
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
        
        const windowHours = rateLimitData?.windowHours || 12;
        const hoursText = windowHours === 1 ? 'hour' : 'hours';
        const limit = rateLimitData?.limit || 10;
        const message = `You've reached your search limit of ${limit} searches per ${windowHours} ${hoursText}. Your limit will refresh in ${timeUntilReset} (at ${resetTime}).`;
      
        setToastMessage(message);
        setToastType('info');
        setShowToast(true);
        setIsCheckingRateLimit(false);
        return; // Don't navigate, don't close modal
      }

      // Rate limit allows, proceed with navigation
      // Track refinement
      analytics.refineSearchApply({
        vibes_changed: JSON.stringify(vibes) !== JSON.stringify(currentVibes),
        free_text_added: !!freeText.trim() && freeText !== currentFreeText,
      });

      const params = new URLSearchParams({
        sourcePlaceIds: JSON.stringify(sourcePlaceIds),
        sourceNames: JSON.stringify(sourceNames),
        destCity,
        vibes: JSON.stringify(vibes),
        refineSearch: 'true', // Flag to force new search and prioritize refinement
      });

      if (freeText.trim()) {
        params.append('freeText', freeText.trim());
      }

      // Force a new search by updating URL
      router.push(`/results?${params.toString()}`);
      onClose();
    } catch (error) {
      console.error('Error applying refinement:', error);
      setToastMessage('Failed to apply refinement. Please try again.');
      setToastType('error');
      setShowToast(true);
      setIsCheckingRateLimit(false);
    }
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
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
            <div
              onClick={(e) => e.stopPropagation()}
              className="card p-6 max-w-lg w-full pointer-events-auto max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Refine Your Search</h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Current source cafes */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Source Cafés
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sourceNames.map((name, index) => (
                      <div
                        key={index}
                        className="px-3 py-1.5 bg-espresso/10 text-espresso rounded-full text-sm"
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Go back to the home page to change source cafés
                  </p>
                </div>

                {/* Destination */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Destination
                  </label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700">
                    {destCity}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Go back to the home page to change destination
                  </p>
                </div>

                {/* Vibe preferences */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-3">
                    Vibe Preferences
                  </label>
                  <div className="space-y-2">
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
                  </div>
                </div>

                {/* Free text */}
                <div>
                  <label htmlFor="freeText" className="block text-sm font-medium text-charcoal mb-2">
                    Additional Preferences
                    <span className="text-xs text-gray-500 ml-2 font-normal">
                      e.g., &quot;great pastries&quot;, &quot;outdoor seating&quot;
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

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={onClose}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    className="btn-primary flex-1"
                    disabled={isCheckingRateLimit}
                  >
                    {isCheckingRateLimit ? 'Checking...' : 'Apply & Search'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Toast notification - outside AnimatePresence to avoid key conflicts */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </>
  );
}
