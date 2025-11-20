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

  // Render the button when script is loaded and ref is available
  useEffect(() => {
    console.log('[GoogleSignIn] useEffect triggered', {
      isScriptLoaded,
      hasGoogleAPI: !!window.google,
      hasAccountsAPI: !!(window.google?.accounts?.id),
      hasButtonRef: !!buttonRef.current,
      buttonRefElement: buttonRef.current
    });

    if (isScriptLoaded && window.google?.accounts?.id && buttonRef.current) {
      console.log('[GoogleSignIn] Rendering Google Sign-In button...');

      // Clear any existing content
      buttonRef.current.innerHTML = '';

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'medium',
        text: 'signin',
        shape: 'rectangular',
        width: window.innerWidth < 640 ? 90 : 240,
      });

      console.log('[GoogleSignIn] Button rendered successfully');
    } else {
      console.log('[GoogleSignIn] Skipping button render - conditions not met');
    }
  }, [isScriptLoaded, CLIENT_ID]);

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
      <div ref={buttonRef} data-google-signin-container />
    </>
  );
}
