'use client';

import { useRef } from 'react';
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
  const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

  const handleCredentialResponse = (response: any) => {
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
    };

    // Store in localStorage
    storage.setUserProfile(userProfile);
    onSignIn(userProfile);

    // Dispatch event for other components
    window.dispatchEvent(new Event('elsebrew_auth_change'));

    // Track sign-in
    analytics.clickSignIn();
  };

  if (!CLIENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.google && buttonRef.current) {
            window.google.accounts.id.initialize({
              client_id: CLIENT_ID,
              callback: handleCredentialResponse,
            });

            window.google.accounts.id.renderButton(buttonRef.current, {
              theme: 'outline',
              size: 'medium',
              text: 'signin_with',
              shape: 'rectangular',
            });
          }
        }}
      />
      <div ref={buttonRef} />
    </>
  );
}
