'use client';

import { useRef, useEffect, useState } from 'react';
import Script from 'next/script';
import { storage } from '@/lib/storage';
import { UserProfile } from '@/types';
import { analytics } from '@/lib/analytics';

interface GoogleSignInProps {
  onSignIn: (user: UserProfile) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function GoogleSignIn({ onSignIn }: GoogleSignInProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(() => {
    // Check if Google Accounts API is already loaded
    return typeof window !== 'undefined' && !!window.google?.accounts?.id;
  });
  const [isPrompting, setIsPrompting] = useState(false);
  const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

  // Only log on client side
  if (typeof window !== 'undefined') {
    console.log('[GoogleSignIn] Component rendered', {
      isScriptLoaded,
      hasGoogleAPI: !!window.google,
      hasAccountsAPI: !!(window.google?.accounts?.id),
      hasButtonRef: !!buttonRef.current,
      CLIENT_ID: CLIENT_ID ? 'present' : 'missing'
    });
  }

  const handleCredentialResponse = (response: any) => {
    console.log('[GoogleSignIn] Credential response received');
    // Decode JWT to get user info (basic decode, no verification needed for client-side)
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const userData = JSON.parse(jsonPayload);
    const userProfile: UserProfile = {
      sub: userData.sub,
      name: userData.name,
      email: userData.email,
      picture: userData.picture,
      token: response.credential, // Save JWT token for API authentication
    };

    console.log('[GoogleSignIn] User profile created', {
      name: userProfile.name,
      hasToken: !!userProfile.token,
      tokenLength: userProfile.token?.length,
    });

    // Store in localStorage
    storage.setUserProfile(userProfile);

    // Save all available user information to DynamoDB
    fetch('/api/user/profile', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${response.credential}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailVerified: userData.email_verified,
        givenName: userData.given_name,
        familyName: userData.family_name,
        locale: userData.locale,
        createdAt: new Date().toISOString(),
      }),
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to save user profile: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('[GoogleSignIn] User profile saved to DynamoDB', {
          userId: data.user?.userId,
          email: data.user?.email,
        });
      })
      .catch(err => {
        console.error('[GoogleSignIn] Failed to save user profile to DynamoDB:', err);
        // Don't block the sign-in flow if DynamoDB save fails
      });

    // Verify it was saved
    const savedProfile = storage.getUserProfile();
    console.log('[GoogleSignIn] Profile saved to localStorage', {
      name: savedProfile?.name,
      hasToken: !!savedProfile?.token,
      tokenLength: savedProfile?.token?.length,
    });

    // Double-check localStorage directly
    const rawData = localStorage.getItem('elsebrew_user_profile');
    console.log('[GoogleSignIn] Raw localStorage data:', rawData ? 'exists' : 'missing');
    if (rawData) {
      const parsed = JSON.parse(rawData);
      console.log('[GoogleSignIn] Parsed localStorage:', {
        name: parsed.name,
        hasToken: !!parsed.token,
        tokenLength: parsed.token?.length,
      });
    }

    // Migrate anonymous IP-based data to user account (async, don't wait)
    fetch('/api/user/migrate-anonymous-data', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${response.credential}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        if (data.migratedCount > 0) {
          console.log(`[GoogleSignIn] Migrated ${data.migratedCount} anonymous interactions to user account`);
        }
      })
      .catch(err => console.warn('[GoogleSignIn] Failed to migrate anonymous data:', err));

    onSignIn(userProfile);

    // Dispatch event for other components
    window.dispatchEvent(new Event('elsebrew_auth_change'));

    // Track sign-in
    analytics.clickSignIn();
  };

  // Initialize Google Sign-In when script is loaded
  useEffect(() => {
    console.log('[GoogleSignIn] useEffect triggered', {
      isScriptLoaded,
      hasGoogleAPI: !!window.google,
      hasAccountsAPI: !!(window.google?.accounts?.id),
    });

    if (isScriptLoaded && window.google?.accounts?.id) {
      console.log('[GoogleSignIn] Initializing Google Sign-In...');

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
      });

      console.log('[GoogleSignIn] Google Sign-In initialized successfully');
    } else {
      console.log('[GoogleSignIn] Skipping initialization - conditions not met');
    }
  }, [isScriptLoaded, CLIENT_ID]);

  const handleCustomButtonClick = () => {
    if (isScriptLoaded && window.google?.accounts?.id) {
      setIsPrompting(true);
      // Try to show the one-tap prompt first
      try {
        window.google.accounts.id.prompt();
        // If prompt doesn't work, render a hidden button and trigger it as fallback
        setTimeout(() => {
          setIsPrompting(false);
          if (buttonRef.current) {
            buttonRef.current.innerHTML = '';
            buttonRef.current.style.display = 'block';
            buttonRef.current.style.position = 'fixed';
            buttonRef.current.style.left = '-9999px';
            
            window.google.accounts.id.renderButton(buttonRef.current, {
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              width: 200,
            });
            
            // Wait a bit for the button to render, then trigger click
            setTimeout(() => {
              const button = buttonRef.current?.querySelector('div[role="button"]') as HTMLElement;
              if (button) {
                button.click();
              }
              if (buttonRef.current) {
                buttonRef.current.style.display = 'none';
              }
            }, 100);
          }
        }, 500);
      } catch (error) {
        console.log('[GoogleSignIn] Prompt failed, using popup');
        setIsPrompting(false);
        // Render hidden button as fallback
        if (buttonRef.current) {
          buttonRef.current.innerHTML = '';
          buttonRef.current.style.display = 'block';
          buttonRef.current.style.position = 'fixed';
          buttonRef.current.style.left = '-9999px';
          
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            width: 200,
          });
          
          setTimeout(() => {
            const button = buttonRef.current?.querySelector('div[role="button"]') as HTMLElement;
            if (button) {
              button.click();
            }
            if (buttonRef.current) {
              buttonRef.current.style.display = 'none';
            }
          }, 100);
        }
      }
    }
  };

  if (!CLIENT_ID) {
    console.warn('[GoogleSignIn] CLIENT_ID is missing');
    return null;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('[GoogleSignIn] Google Script loaded');
          setIsScriptLoaded(true);
        }}
      />
      <button
        onClick={handleCustomButtonClick}
        disabled={!isScriptLoaded || isPrompting}
        className="text-[11px] sm:text-xs px-2 sm:px-5 py-2 bg-espresso/5 hover:bg-espresso/10 text-espresso rounded-lg transition-colors inline-flex items-center space-x-1 sm:space-x-1.5 border-brown border border-transperant hover:border-espresso disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span className="hidden sm:inline">Sign in</span>
        <span className="sm:hidden">Sign in</span>
      </button>
      <div ref={buttonRef} style={{ display: 'none' }} />
    </>
  );
}
