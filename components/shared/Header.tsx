'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { storage } from '@/lib/storage';
import { UserProfile } from '@/types';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import { analytics } from '@/lib/analytics';

export default function Header() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [signInKey, setSignInKey] = useState(0); // Force re-render of GoogleSignIn
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('elsebrew_auth_change', handleAuthChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = () => {
    console.log('[Header] Sign out clicked');
    storage.setUserProfile(null);
    setUser(null);
    setIsDropdownOpen(false);
    console.log('[Header] Dispatching auth change event');
    window.dispatchEvent(new Event('elsebrew_auth_change'));
  };

  const handleBuyMeCoffee = () => {
    const buyMeCoffeeUrl = process.env.NEXT_PUBLIC_BUYMEACOFFEE_URL || 'https://www.buymeacoffee.com/yourname';
    analytics.buyMeCoffeeClick();
    window.open(buyMeCoffeeUrl, '_blank');
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
            <nav className="flex items-center space-x-4"></nav>
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
          <nav className="flex items-center space-x-4">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                >
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
                  <svg
                    className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                    <Link
                      href="/saved"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        // Store navigation state when clicking saved link
                        const currentPath = window.location.pathname;
                        const currentSearch = window.location.search;
                        if (currentPath === '/results' && currentSearch) {
                          storage.setNavigationState({
                            previousRoute: '/results',
                            searchParams: currentSearch,
                          });
                        } else if (currentPath === '/') {
                          storage.setNavigationState({
                            previousRoute: '/',
                          });
                        }
                      }}
                      className="block px-4 py-2 text-sm text-charcoal hover:bg-gray-50 transition-colors"
                    >
                      Saved Places
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                )}
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

            {/* Buy Me A Coffee - Right side */}
            <button
              onClick={handleBuyMeCoffee}
              className="text-xs px-5 py-2 bg-espresso/5 hover:bg-espresso/10 text-espresso rounded-lg transition-colors inline-flex items-center space-x-1.5 border-brown border border-transperant hover:border-espresso"
            >
              <span>☕</span>
              <span>Buy Me A Coffee</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
