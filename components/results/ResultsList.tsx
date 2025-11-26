'use client';

import { CafeMatch } from '@/types';
import { motion } from 'framer-motion';
import { analytics } from '@/lib/analytics';
import { useState, useEffect } from 'react';
import { storage } from '@/lib/storage';

interface ResultsListProps {
  results: CafeMatch[];
  onSelectResult: (result: CafeMatch, index: number) => void;
  selectedIndex: number | null;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
}

export default function ResultsList({
  results,
  onSelectResult,
  selectedIndex,
  hoveredIndex,
  onHover,
}: ResultsListProps) {
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check saved status for all results
    const checkSaved = async () => {
      const saved = new Set<string>();
      for (const result of results) {
        const isSaved = await storage.isPlaceSaved(result.place.id);
        if (isSaved) {
          saved.add(result.place.id);
        }
      }
      setSavedPlaceIds(saved);
    };
    checkSaved();
  }, [results]);
  const getPhotoUrl = (place: CafeMatch['place']) => {
    // Check for cached photoUrl first (from restored results)
    if (place.photoUrl) {
      return place.photoUrl;
    }
    // Otherwise use Google Maps photos
    if (place.photos && place.photos.length > 0) {
      try {
        const photo = place.photos[0] as any;
        // Try new API first (getURI), then fallback to legacy (getUrl)
        if (typeof photo.getURI === 'function') {
          return photo.getURI({ maxWidth: 400 });
        } else if (typeof photo.getUrl === 'function') {
          return photo.getUrl({ maxWidth: 400 });
        }
      } catch (error) {
        console.warn('Error getting photo URL:', error);
      }
    }
    return null;
  };

  const getPriceLevel = (level?: number) => {
    if (!level) return '';
    return '$'.repeat(level);
  };

  const handleToggleSave = async (e: React.MouseEvent, place: CafeMatch['place'], photoUrl: string | null) => {
    e.stopPropagation(); // Prevent card click
    
    const isCurrentlySaved = savedPlaceIds.has(place.id);
    const userProfile = storage.getUserProfile();

    // Optimistic update - change UI immediately
    if (isCurrentlySaved) {
      setSavedPlaceIds(prev => {
        const next = new Set(prev);
        next.delete(place.id);
        return next;
      });
    } else {
      setSavedPlaceIds(prev => new Set(prev).add(place.id));
    }

    // Then handle the actual save/unsave in the background
    if (isCurrentlySaved) {
      // Unsave
      storage.removeSavedCafe(place.id);
      
      // Also remove from API if logged in
      if (userProfile?.token) {
        try {
          const response = await fetch(`/api/user/saved-places?placeId=${place.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${userProfile.token}`,
            },
          });

          if (response.status === 401) {
            storage.setUserProfile(null);
          } else if (!response.ok) {
            // Revert on failure
            setSavedPlaceIds(prev => new Set(prev).add(place.id));
            // Restore to localStorage
            storage.saveCafe({
              placeId: place.id,
              name: place.displayName,
              savedAt: Date.now(),
              photoUrl: photoUrl || undefined,
              rating: place.rating,
            });
          }
        } catch (error) {
          console.error('Error deleting from API:', error);
          // Revert on failure
          setSavedPlaceIds(prev => new Set(prev).add(place.id));
          // Restore to localStorage
          storage.saveCafe({
            placeId: place.id,
            name: place.displayName,
            savedAt: Date.now(),
            photoUrl: photoUrl || undefined,
            rating: place.rating,
          });
        }
      }
    } else {
      // Save
      let saveSuccess = false;
      
      if (userProfile?.token) {
        try {
          const response = await fetch('/api/user/saved-places', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userProfile.token}`,
            },
            body: JSON.stringify({
              placeId: place.id,
              name: place.displayName,
              address: place.formattedAddress || '',
              rating: place.rating,
              priceLevel: place.priceLevel,
              photoUrl: photoUrl || undefined,
            }),
          });

          if (response.status === 401) {
            storage.setUserProfile(null);
            // Continue with localStorage fallback
          } else if (response.ok) {
            saveSuccess = true;
            const data = await response.json();
            if (data.localStorage) {
              storage.saveCafe({
                placeId: place.id,
                name: place.displayName,
                savedAt: Date.now(),
                photoUrl: photoUrl || undefined,
                rating: place.rating,
              });
            }
          }
        } catch (error) {
          console.error('Error saving place:', error);
          // Continue with localStorage fallback
        }
      }
      
      // Save to localStorage (either as fallback or primary for anonymous users)
      try {
        storage.saveCafe({
          placeId: place.id,
          name: place.displayName,
          savedAt: Date.now(),
          photoUrl: photoUrl || undefined,
          rating: place.rating,
        });
        saveSuccess = true;
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }

      // Revert if save failed
      if (!saveSuccess) {
        setSavedPlaceIds(prev => {
          const next = new Set(prev);
          next.delete(place.id);
          return next;
        });
      } else {
        analytics.resultSaveGoogle(place.id);
      }
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 overflow-y-auto overflow-x-visible h-full px-3 sm:px-6 py-3 sm:py-6">
      {results.map((result, index) => {
        const isSelected = selectedIndex === index;
        const isHovered = hoveredIndex === index;
        const photoUrl = getPhotoUrl(result.place);

        return (
          <motion.div
            key={result.place.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`
              card p-4 cursor-pointer transition-all duration-200
              ${isSelected || isHovered ? 'ring-2 ring-espresso shadow-lg scale-[1.02]' : ''}
            `}
            onClick={() => {
              onSelectResult(result, index);
              analytics.resultClick({
                rank: index + 1,
                place_id: result.place.id,
              });
            }}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="flex gap-3 sm:gap-4">
              {/* Photo */}
              {photoUrl && (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                  <img
                    src={photoUrl}
                    alt={result.place.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg truncate">
                      {index + 1}. {result.place.displayName}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {result.place.rating && (
                      <div className="flex items-center space-x-1">
                        <span className="text-yellow-500">★</span>
                        <span className="text-sm font-medium">{result.place.rating.toFixed(1)}</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => handleToggleSave(e, result.place, photoUrl)}
                      className="flex-shrink-0 text-espresso hover:opacity-80 transition-opacity"
                      title={savedPlaceIds.has(result.place.id) ? 'Unsave' : 'Save'}
                    >
                      {savedPlaceIds.has(result.place.id) ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-2">
                {getPriceLevel(result.place.priceLevel) && (
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                      {getPriceLevel(result.place.priceLevel)}
                    </span>
                  )}
                  {result.place.regularOpeningHours?.isOpen?.() !== undefined && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        result.place.regularOpeningHours.isOpen()
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {result.place.regularOpeningHours.isOpen() ? 'Open now' : 'Closed'}
                    </span>
                  )}
                  {result.distanceToCenter && (
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                      {result.distanceToCenter.toFixed(1)} km from center
                    </span>
                  )}
                </div>

                {/* Reasoning */}
                {result.reasoning && (
                  <p className="text-sm text-gray-600 italic line-clamp-3 mb-2">
                    {result.reasoning}
                  </p>
                )}

                {/* Additional info badges */}
                {result.imageAnalysis && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                      {result.imageAnalysis}
                    </span>
                  </div>
                )}

                {/* Matched keywords */}
                {result.matchedKeywords.length > 0 && !result.reasoning && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.matchedKeywords.map((keyword, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 bg-espresso/10 text-espresso rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
