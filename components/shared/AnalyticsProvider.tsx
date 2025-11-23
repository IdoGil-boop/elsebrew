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

  // Verify GA4 is initialized (the inline script above handles initialization)
  useEffect(() => {
    if (GA4_ID && typeof window !== 'undefined') {
      // Wait a bit for scripts to load, then verify
      setTimeout(() => {
        if (window.gtag && typeof window.gtag === 'function') {
          console.log('[AnalyticsProvider] GA4 verified - gtag is available');
          // Test event
          window.gtag('event', 'ga4_test', { test: true });
          console.log('[AnalyticsProvider] Test event sent');
        } else {
          console.warn('[AnalyticsProvider] GA4 gtag not available yet');
        }
      }, 1000);
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
      {/* Google Analytics 4 - Standard implementation */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA4_ID}', {
              send_page_view: false
            });
            console.log('[GA4] Initialized with ID: ${GA4_ID}');
          `,
        }}
      />
    </>
  );
}
