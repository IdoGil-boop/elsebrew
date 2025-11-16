'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { storage } from '@/lib/storage';
import { UserProfile } from '@/types';
import GoogleSignIn from '@/components/auth/GoogleSignIn';

export default function Header() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [signInKey, setSignInKey] = useState(0); // Force re-render of GoogleSignIn

  useEffect(() => {
    console.log('[Header] Component mounted');
    setIsClient(true);
    const profile = storage.getUserProfile();
    console.log('[Header] Initial profile:', profile?.name || 'null');
    setUser(profile);

    // Listen for auth changes
    const handleAuthChange = () => {
      console.log('[Header] Auth change event received');
      const updatedProfile = storage.getUserProfile();
      console.log('[Header] Updated profile:', {
        name: updatedProfile?.name || 'null',
        hasToken: !!updatedProfile?.token,
        tokenLength: updatedProfile?.token?.length,
      });
      setUser(updatedProfile);

      // Force re-mount of GoogleSignIn component when user signs out
      if (!updatedProfile) {
        console.log('[Header] User signed out, incrementing signInKey');
        setSignInKey(prev => {
          const newKey = prev + 1;
          console.log('[Header] New signInKey:', newKey);
          return newKey;
        });
      }
    };

    window.addEventListener('elsebrew_auth_change', handleAuthChange);
    return () => window.removeEventListener('elsebrew_auth_change', handleAuthChange);
  }, []);

  const handleSignOut = () => {
    console.log('[Header] Sign out clicked');
    storage.setUserProfile(null);
    setUser(null);
    console.log('[Header] Dispatching auth change event');
    window.dispatchEvent(new Event('elsebrew_auth_change'));
  };

  // Prevent hydration mismatch
  if (!isClient) {
    return (
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="text-2xl transition-transform group-hover:scale-105">☕</div>
              <span className="text-xl font-serif font-semibold text-espresso">
                Elsebrew
              </span>
            </Link>
            <nav className="flex items-center space-x-6"></nav>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="text-2xl transition-transform group-hover:scale-105">☕</div>
            <span className="text-xl font-serif font-semibold text-espresso">
              Elsebrew
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center space-x-6">
            <Link
              href="/saved"
              onClick={() => {
                // Store navigation state when clicking saved link
                const currentPath = window.location.pathname;
                const currentSearch = window.location.search;
                if (currentPath === '/results' && currentSearch) {
                  storage.setNavigationState({
                    previousRoute: '/results',
                    searchParams: currentSearch,
                  });
                  // Results will be stored by the results page when navigating away
                } else if (currentPath === '/') {
                  storage.setNavigationState({
                    previousRoute: '/',
                  });
                }
              }}
              className="text-sm text-charcoal hover:text-espresso transition-colors"
            >
              Saved
            </Link>

            {user ? (
              <div className="flex items-center space-x-3">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-gray-200"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      console.error('Failed to load profile picture:', user.picture);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-espresso text-white flex items-center justify-center text-sm font-medium">
                    {user.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="text-sm text-charcoal">{user.name}</span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-600 hover:text-espresso transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <>
                {console.log('[Header] Rendering GoogleSignIn with key:', signInKey)}
                <GoogleSignIn
                  key={signInKey}
                  onSignIn={(profile) => {
                    console.log('[Header] onSignIn callback received:', {
                      name: profile.name,
                      hasToken: !!profile.token,
                      tokenLength: profile.token?.length,
                    });
                    setUser(profile);
                  }}
                />
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
