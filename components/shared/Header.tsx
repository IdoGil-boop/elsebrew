'use client';

import Link from 'next/link';
import Image from 'next/image';
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
      <header className="border-b sticky top-0 z-50" style={{ backgroundColor: '#F6F6F6', borderColor: '#E8DCC8' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col h-40 relative">
            <div className="flex items-center justify-center flex-1">
              <Link href="/" className="flex items-center group">
                <div className="relative">
                  <Image src="/images/logo.png" alt="Elsebrew" width={160} height={160} className="w-40 h-40" style={{ maskImage: 'radial-gradient(ellipse 80% 80% at center, black 60%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at center, black 60%, transparent 100%)' }} />
                </div>
              </Link>
            </div>
            <nav className="flex items-center justify-between absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-2">
              <div></div>
              <div></div>
            </nav>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b sticky top-0 z-50" style={{ backgroundColor: '#F6F6F6', borderColor: '#E8DCC8' }}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex flex-col h-36 sm:h-40 relative">
          {/* Logo - Top */}
          <div className="flex items-center justify-center flex-1">
            <Link href="/" className="flex items-center group">
              <div className="relative">
                <Image src="/images/logo.png" alt="Elsebrew" width={144} height={144} className="w-36 h-36 sm:w-40 sm:h-40" style={{ maskImage: 'radial-gradient(ellipse 80% 80% at center, black 60%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at center, black 60%, transparent 100%)' }} />
              </div>
            </Link>
          </div>

          {/* Navigation - Bottom, positioned at the bottom of header, aligned with search form width */}
          <nav className="flex items-center justify-between absolute bottom-0 left-0 right-0 pb-2">
            <div className="max-w-2xl mx-auto w-full px-3 sm:px-4 lg:px-8 flex items-center justify-between">
              {/* Left: Login section */}
              <div className="flex items-center">
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
                          className="w-8 h-8 rounded-full border"
                          style={{ borderColor: '#E8DCC8' }}
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
                      <div className="absolute left-0 mt-2 w-48 rounded-xl shadow-lg border py-1 z-50" style={{ backgroundColor: '#FCF9F3', borderColor: '#E8DCC8' }}>
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
                          className="block px-4 py-2 text-sm text-charcoal transition-colors hover:opacity-80"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F1E8'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          Saved Places
                        </Link>
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2 text-sm text-charcoal transition-colors hover:opacity-80"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F1E8'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
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
                )}
              </div>

              {/* Right: Buy Me A Coffee */}
              <div className="flex items-center">
                <button
                  onClick={handleBuyMeCoffee}
                  className="text-[11px] sm:text-xs px-3.5 sm:px-5 py-2 bg-espresso/5 hover:bg-espresso/10 text-espresso rounded-lg transition-colors inline-flex items-center space-x-1.5 border-brown border border-transperant hover:border-espresso"
                >
                  <span>☕</span>
                  <span className="hidden sm:inline">Buy Me A Coffee</span>
                  <span className="sm:hidden">Buy Me Coffee</span>
                </button>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
