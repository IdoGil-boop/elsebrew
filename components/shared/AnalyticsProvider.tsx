'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { trackPageView, captureTrafficSource } from '@/lib/analytics';

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

  // Capture UTM parameters and referrer on mount
  useEffect(() => {
    captureTrafficSource();
  }, []);

  // Initialize dataLayer immediately (before scripts load) so events can queue
  useEffect(() => {
    if (GA4_ID && typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function(...args: any[]) {
        window.dataLayer!.push(args);
      };
      window.gtag('js', new Date());
      window.gtag('config', GA4_ID);
    }
  }, [GA4_ID]);

  useEffect(() => {
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);

  // Only render GA4 script if ID is configured
  if (!GA4_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
