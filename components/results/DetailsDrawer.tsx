'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CafeMatch } from '@/types';
import { storage } from '@/lib/storage';
import { analytics } from '@/lib/analytics';
import { useState, useEffect, useRef } from 'react';

interface DetailsDrawerProps {
  result: CafeMatch | null;
  onClose: () => void;
}

export default function DetailsDrawer({ result, onClose }: DetailsDrawerProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkSaved = async () => {
      if (result) {
        setIsChecking(true);
        const saved = await storage.isPlaceSaved(result.place.id);
        setIsSaved(saved);
        setIsChecking(false);
      }
    };
    checkSaved();
  }, [result]);

  // Handle browser back button to close drawer
  useEffect(() => {
    if (!result) return;

    const handlePopState = () => {
      onClose();
    };

    // Push a dummy state when drawer opens
    window.history.pushState({ drawer: true }, '');

    // Listen for back button
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [result, onClose]);

  // Reset photo index when result changes
  useEffect(() => {
    if (result) {
      setCurrentPhotoIndex(0);
    }
  }, [result]);

  if (!result) return null;

  const { place, matchedKeywords, reasoning } = result;

  // Get all available photo URLs (already limited to 4 at API level)
  const getPhotoUrls = (): string[] => {
    const urls: string[] = [];
    
    // Photos are already limited to 4 in places-search.ts to control API costs
    if (place.photos && place.photos.length > 0) {
      for (let i = 0; i < place.photos.length; i++) {
        try {
          const photo = place.photos[i] as any;
          let url: string | null = null;
          
          // Try new API first (getURI), then fallback to legacy (getUrl)
          if (typeof photo.getURI === 'function') {
            url = photo.getURI({ maxWidth: 800 });
          } else if (typeof photo.getUrl === 'function') {
            url = photo.getUrl({ maxWidth: 800 });
          }
          
          if (url) {
            urls.push(url);
          }
        } catch (error) {
          console.warn('Error getting photo URL:', error);
        }
      }
    }
    
    // Fallback to cached photoUrl if no photos from API
    if (urls.length === 0 && place.photoUrl) {
      urls.push(place.photoUrl);
    }
    
    return urls;
  };

  const photoUrls = getPhotoUrls();

  const scrollToPhoto = (index: number) => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const photoWidth = container.clientWidth;
    container.scrollTo({
      left: index * photoWidth,
      behavior: 'smooth',
    });
    setCurrentPhotoIndex(index);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const photoWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    const newIndex = Math.round(scrollLeft / photoWidth);
    if (newIndex !== currentPhotoIndex && newIndex >= 0 && newIndex < photoUrls.length) {
      setCurrentPhotoIndex(newIndex);
    }
  };

  const goToPrevious = () => {
    if (currentPhotoIndex > 0) {
      scrollToPhoto(currentPhotoIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentPhotoIndex < photoUrls.length - 1) {
      scrollToPhoto(currentPhotoIndex + 1);
    }
  };

  const getMapsEmbedUrl = () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=place_id:${place.id}`;
  };

  const getGoogleMapsUrl = () => {
    return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${place.id}`;
  };

  const handleSave = async () => {
    if (isSaved) return; // Already saved, do nothing

    const photoUrl = photoUrls.length > 0 ? photoUrls[0] : null;
    const userProfile = storage.getUserProfile();

    // Save to API if logged in
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

        // Handle token expiration
        if (response.status === 401) {
          console.log('[DetailsDrawer] Token expired - logging out user');
          storage.setUserProfile(null);
          return;
        }

        if (response.ok) {
          const data = await response.json();
          if (data.localStorage) {
            // Also save to localStorage if AWS not configured
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
        // Fallback to localStorage
        storage.saveCafe({
          placeId: place.id,
          name: place.displayName,
          savedAt: Date.now(),
          photoUrl: photoUrl || undefined,
          rating: place.rating,
        });
      }
    } else {
      // Not logged in, save to localStorage only
      storage.saveCafe({
        placeId: place.id,
        name: place.displayName,
        savedAt: Date.now(),
        photoUrl: photoUrl || undefined,
        rating: place.rating,
      });
    }

    setIsSaved(true);
    analytics.resultSaveGoogle(place.id);
  };

  const handleUnsave = async () => {
    storage.removeSavedCafe(place.id);
    
    // Also remove from API if logged in
    const userProfile = storage.getUserProfile();
    if (userProfile?.token) {
      try {
        const response = await fetch(`/api/user/saved-places?placeId=${place.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${userProfile.token}`,
          },
        });

        // Handle token expiration
        if (response.status === 401) {
          console.log('[DetailsDrawer] Token expired during unsave - logging out user');
          storage.setUserProfile(null);
        }
      } catch (error) {
        console.error('Error deleting from API:', error);
      }
    }

    setIsSaved(false);
  };

  const handleOpenInMaps = () => {
    analytics.resultOpenGmaps(place.id);
    window.open(getGoogleMapsUrl(), '_blank');
  };

  const handleShare = async () => {
    analytics.track({ name: 'result_share', params: { place_id: place.id } });
    if (navigator.share) {
      try {
        await navigator.share({
          title: place.displayName,
          text: `Check out ${place.displayName} on Elsebrew`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share canceled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const getPriceLevel = (level?: number) => {
    if (!level) return '';
    return '$'.repeat(level);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[90vh] overflow-y-auto relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky close button - always visible */}
          <button
            onClick={onClose}
            className="sticky top-4 right-4 ml-auto mr-4 mt-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors z-10 border border-gray-200"
            style={{ float: 'right' }}
          >
            ✕
          </button>

          {/* Header with photo carousel */}
          {photoUrls.length > 0 && (
            <div className="w-full h-64 relative -mt-14 overflow-hidden">
              <div
                ref={carouselRef}
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                onScroll={handleScroll}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {photoUrls.map((url, index) => (
                  <div
                    key={index}
                    className="w-full h-full flex-shrink-0 snap-center"
                  >
                    <img
                      src={url}
                      alt={`${place.displayName} - Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              
              {/* Navigation arrows */}
              {photoUrls.length > 1 && (
                <>
                  {currentPhotoIndex > 0 && (
                    <button
                      onClick={goToPrevious}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all z-20"
                      aria-label="Previous photo"
                    >
                      <svg
                        className="w-5 h-5 text-gray-800"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                  )}
                  {currentPhotoIndex < photoUrls.length - 1 && (
                    <button
                      onClick={goToNext}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all z-20"
                      aria-label="Next photo"
                    >
                      <svg
                        className="w-5 h-5 text-gray-800"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  )}
                </>
              )}
              
              {/* Dot indicators */}
              {photoUrls.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                  {photoUrls.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToPhoto(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentPhotoIndex
                          ? 'bg-white w-6'
                          : 'bg-white/50 hover:bg-white/75'
                      }`}
                      aria-label={`Go to photo ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-4 sm:p-6 relative z-10 bg-white">

            {/* Title and rating */}
            <div className="mb-4">
              <h2 className="text-2xl font-serif font-bold mb-2">{place.displayName}</h2>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                {place.rating && (
                  <div className="flex items-center space-x-1">
                    <span className="text-yellow-500">★</span>
                    <span className="font-medium">{place.rating.toFixed(1)}</span>
                    {place.userRatingCount && (
                      <span>({place.userRatingCount} reviews)</span>
                    )}
                  </div>
                )}
                {place.priceLevel && (
                  <span className="font-medium">{getPriceLevel(place.priceLevel)}</span>
                )}
              </div>
            </div>

            {/* Address */}
            {place.formattedAddress && (
              <p className="text-sm text-gray-600 mb-4">{place.formattedAddress}</p>
            )}

            {/* Opening hours */}
            {place.regularOpeningHours?.isOpen?.() !== undefined && (
              <div className="mb-4">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    place.regularOpeningHours.isOpen()
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {place.regularOpeningHours.isOpen() ? 'Open now' : 'Closed'}
                </span>
              </div>
            )}

            {/* Why this matches */}
            {reasoning && (
              <div className="mb-4 p-4 bg-espresso/5 rounded-xl">
                <h3 className="font-semibold text-sm mb-2">Why this matches</h3>
                <p className="text-sm text-gray-700">{reasoning}</p>
              </div>
            )}

            {/* Matched keywords */}
            {matchedKeywords.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {matchedKeywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-espresso/10 text-espresso text-sm rounded-full"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Embedded map */}
            <div className="mb-4">
              <iframe
                src={getMapsEmbedUrl()}
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="rounded-xl"
              />
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleOpenInMaps} className="btn-primary">
                Open in Google Maps
              </button>
              {isChecking ? (
                <button disabled className="btn-secondary opacity-50 cursor-not-allowed">
                  Checking...
                </button>
              ) : isSaved ? (
                <button onClick={handleUnsave} className="btn-secondary">
                  ✓ Saved
                </button>
              ) : (
                <button onClick={handleSave} className="btn-secondary">
                  Save
                </button>
              )}
            </div>

            <button
              onClick={handleShare}
              className="w-full mt-3 text-sm text-espresso hover:underline"
            >
              Share this place
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
