'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CafeMatch } from '@/types';
import { storage } from '@/lib/storage';
import { analytics } from '@/lib/analytics';
import { useState, useEffect } from 'react';

interface DetailsDrawerProps {
  result: CafeMatch | null;
  onClose: () => void;
}

export default function DetailsDrawer({ result, onClose }: DetailsDrawerProps) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (result) {
      setIsSaved(storage.isCafeSaved(result.place.place_id));
    }
  }, [result]);

  if (!result) return null;

  const { place, matchedKeywords, reasoning } = result;

  const getPhotoUrl = () => {
    if (place.photos && place.photos.length > 0) {
      return place.photos[0].getUrl({ maxWidth: 800 });
    }
    return null;
  };

  const getMapsEmbedUrl = () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=place_id:${place.place_id}`;
  };

  const getGoogleMapsUrl = () => {
    return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${place.place_id}`;
  };

  const handleSave = () => {
    const photoUrl = getPhotoUrl();
    storage.saveCafe({
      placeId: place.place_id,
      name: place.name,
      savedAt: Date.now(),
      photoUrl: photoUrl || undefined,
      rating: place.rating,
    });
    setIsSaved(true);
  };

  const handleUnsave = () => {
    storage.removeSavedCafe(place.place_id);
    setIsSaved(false);
  };

  const handleOpenInMaps = () => {
    analytics.resultOpenGmaps(place.place_id);
    window.open(getGoogleMapsUrl(), '_blank');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: place.name,
          text: `Check out ${place.name} on Elsebrew`,
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

  const photoUrl = getPhotoUrl();
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
          className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with photo */}
          {photoUrl && (
            <div className="w-full h-64 relative">
              <img src={photoUrl} alt={place.name} className="w-full h-full object-cover" />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          <div className="p-6">
            {/* Close button if no photo */}
            {!photoUrl && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            )}

            {/* Title and rating */}
            <div className="mb-4">
              <h2 className="text-2xl font-serif font-bold mb-2">{place.name}</h2>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                {place.rating && (
                  <div className="flex items-center space-x-1">
                    <span className="text-yellow-500">★</span>
                    <span className="font-medium">{place.rating.toFixed(1)}</span>
                    {place.user_ratings_total && (
                      <span>({place.user_ratings_total} reviews)</span>
                    )}
                  </div>
                )}
                {place.price_level && (
                  <span className="font-medium">{getPriceLevel(place.price_level)}</span>
                )}
              </div>
            </div>

            {/* Address */}
            {place.formatted_address && (
              <p className="text-sm text-gray-600 mb-4">{place.formatted_address}</p>
            )}

            {/* Opening hours */}
            {place.opening_hours?.isOpen?.() !== undefined && (
              <div className="mb-4">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    place.opening_hours.isOpen()
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {place.opening_hours.isOpen() ? 'Open now' : 'Closed'}
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
              {isSaved ? (
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
