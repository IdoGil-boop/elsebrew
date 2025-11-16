'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SavedCafe, UserProfile } from '@/types';
import { storage } from '@/lib/storage';
import { analytics } from '@/lib/analytics';
import Link from 'next/link';
import GoogleSignIn from '@/components/auth/GoogleSignIn';

export default function SavedPage() {
  const [savedCafes, setSavedCafes] = useState<SavedCafe[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    setSavedCafes(storage.getSavedCafes());
    setUser(storage.getUserProfile());

    // Listen for auth changes
    const handleAuthChange = () => {
      setUser(storage.getUserProfile());
    };

    window.addEventListener('elsebrew_auth_change', handleAuthChange);
    return () => window.removeEventListener('elsebrew_auth_change', handleAuthChange);
  }, []);

  const handleRemove = (placeId: string) => {
    storage.removeSavedCafe(placeId);
    setSavedCafes(storage.getSavedCafes());
  };

  const handleOpenInMaps = (placeId: string) => {
    analytics.resultOpenGmaps(placeId);
    const url = `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${placeId}`;
    window.open(url, '_blank');
  };

  // Show sign-in prompt if not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">☕</div>
          <h1 className="text-2xl font-serif font-semibold mb-2">Sign in to view saved cafés</h1>
          <p className="text-gray-600 mb-6">
            Sign in with Google to save and access your favorite café matches across devices
          </p>
          <div className="flex justify-center">
            <GoogleSignIn onSignIn={setUser} />
          </div>
        </div>
      </div>
    );
  }

  if (savedCafes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">☕</div>
          <h1 className="text-2xl font-serif font-semibold mb-2">No saved cafés yet</h1>
          <p className="text-gray-600 mb-6">
            Start exploring and save your favorite café matches
          </p>
          <Link href="/" className="btn-primary inline-block">
            Find cafés
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-serif font-bold mb-2">Saved cafés</h1>
        <p className="text-gray-600 mb-8">
          {savedCafes.length} café{savedCafes.length !== 1 ? 's' : ''} saved
        </p>
      </motion.div>

      <div className="space-y-4">
        {savedCafes.map((cafe, index) => (
          <motion.div
            key={cafe.placeId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="card p-6"
          >
            <div className="flex gap-6">
              {/* Photo */}
              {cafe.photoUrl && (
                <div className="w-32 h-32 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                  <img
                    src={cafe.photoUrl}
                    alt={cafe.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{cafe.name}</h3>
                    {cafe.rating && (
                      <div className="flex items-center space-x-1 text-sm">
                        <span className="text-yellow-500">★</span>
                        <span className="font-medium">{cafe.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-500 mb-4">
                  Saved on {new Date(cafe.savedAt).toLocaleDateString()}
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleOpenInMaps(cafe.placeId)}
                    className="btn-primary"
                  >
                    Open in Maps
                  </button>
                  <button
                    onClick={() => handleRemove(cafe.placeId)}
                    className="btn-secondary"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
