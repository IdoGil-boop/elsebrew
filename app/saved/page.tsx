'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SavedCafe, UserProfile } from '@/types';
import { storage } from '@/lib/storage';
import { analytics } from '@/lib/analytics';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GoogleSignIn from '@/components/auth/GoogleSignIn';

export default function SavedPage() {
  const router = useRouter();
  const [savedCafes, setSavedCafes] = useState<SavedCafe[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      analytics.track({ name: 'view_saved', params: {} });
    } catch (error) {
      console.error('Error tracking view_saved event:', error);
    }
  }, []);

  useEffect(() => {
    const loadSavedCafes = async () => {
      try {
        setIsLoading(true);
        const userProfile = storage.getUserProfile();
        setUser(userProfile);

        if (!userProfile || !userProfile.token) {
          // Not logged in, use localStorage only
          setSavedCafes(storage.getSavedCafes());
          setIsLoading(false);
          return;
        }

        try {
          // Try to fetch from API first
          const response = await fetch('/api/user/saved-places', {
            headers: {
              'Authorization': `Bearer ${userProfile.token}`,
            },
          });

          // Handle token expiration
          if (response.status === 401) {
            console.log('[Saved Page] Token expired - logging out user');
            storage.setUserProfile(null);
            setUser(null);
            setSavedCafes(storage.getSavedCafes());
            setIsLoading(false);
            return;
          }

          if (response.ok) {
            const data = await response.json();
            if (data.places && data.places.length > 0) {
              // Convert API format to SavedCafe format
              const cafes: SavedCafe[] = data.places.map((place: any) => ({
                placeId: place.placeId,
                name: place.name,
                savedAt: new Date(place.savedAt).getTime(),
                photoUrl: place.photoUrl,
                rating: place.rating,
              }));
              setSavedCafes(cafes);
              // Also sync to localStorage for offline access
              cafes.forEach(cafe => storage.saveCafe(cafe));
            } else if (!data.localStorage) {
              // API returned empty, use localStorage as fallback
              setSavedCafes(storage.getSavedCafes());
            } else {
              // AWS not configured, use localStorage
              setSavedCafes(storage.getSavedCafes());
            }
          } else {
            // API failed, use localStorage
            setSavedCafes(storage.getSavedCafes());
          }
        } catch (error) {
          console.error('Error fetching saved places:', error);
          // Fallback to localStorage
          setSavedCafes(storage.getSavedCafes());
        } finally {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[Saved Page] Error loading saved cafes:', error);
        // Fallback to empty array if everything fails
        setSavedCafes([]);
        setIsLoading(false);
      }
    };

    loadSavedCafes();

    // Listen for auth changes
    const handleAuthChange = () => {
      const updatedUser = storage.getUserProfile();
      setUser(updatedUser);
      if (updatedUser) {
        loadSavedCafes();
      } else {
        setSavedCafes([]);
      }
    };

    window.addEventListener('elsebrew_auth_change', handleAuthChange);
    return () => window.removeEventListener('elsebrew_auth_change', handleAuthChange);
  }, []);

  const handleRemove = async (placeId: string) => {
    try {
      analytics.track({ name: 'saved_cafe_remove', params: { place_id: placeId } });
    } catch (error) {
      console.error('Error tracking saved_cafe_remove event:', error);
    }
    const userProfile = storage.getUserProfile();
    
    // Remove from localStorage
    storage.removeSavedCafe(placeId);
    
    // Also remove from API if logged in
    if (userProfile?.token) {
      try {
        const response = await fetch(`/api/user/saved-places?placeId=${placeId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${userProfile.token}`,
          },
        });

        // Handle token expiration
        if (response.status === 401) {
          console.log('[Saved Page] Token expired during delete - logging out user');
          storage.setUserProfile(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Error deleting from API:', error);
      }
    }
    
    setSavedCafes(storage.getSavedCafes());
  };

  const handleBack = () => {
    const navState = storage.getNavigationState();
    if (navState?.previousRoute === '/results' && navState.searchParams) {
      // Go back to results with the saved search params
      router.push(`/results${navState.searchParams}`);
    } else {
      // Go back to home/search
      router.push('/');
    }
  };

  const handleOpenInMaps = (placeId: string) => {
    analytics.resultOpenGmaps(placeId);
    const url = `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${placeId}`;
    window.open(url, '_blank');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">☕</div>
          <div className="text-lg text-gray-600">Loading saved cafés...</div>
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-espresso transition-colors group"
          >
            <div className="relative w-4 h-4 overflow-hidden">
              <svg
                className="w-4 h-4 absolute transition-all duration-300 group-hover:-translate-x-full group-hover:opacity-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <svg
                className="w-4 h-4 absolute translate-x-full opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            {(() => {
              const navState = storage.getNavigationState();
              return navState?.previousRoute === '/results' ? 'Back to results' : 'Back to search';
            })()}
          </button>
          <div className="h-6 w-px bg-gray-200"></div>
          <div>
            <h1 className="text-4xl font-serif font-bold">Saved cafés</h1>
          </div>
        </div>
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
