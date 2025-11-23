import { AnalyticsEvent } from '@/types';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    plausible?: (event: string, options?: { props: Record<string, any> }) => void;
    dataLayer?: any[];
  }
}

/**
 * Capture and store source parameter from URL (e.g., ?source=reddit_r_coffee)
 * Stores in sessionStorage so it persists across page navigations
 */
export const captureTrafficSource = (): { source?: string } => {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const source = params.get('source') || undefined;

  // Store in sessionStorage for persistence across navigations
  if (source) {
    sessionStorage.setItem('traffic_source', JSON.stringify({ source }));
  }

  return source ? { source } : {};
};

/**
 * Get stored traffic source from sessionStorage
 */
const getStoredTrafficSource = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = sessionStorage.getItem('traffic_source');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const track = (event: AnalyticsEvent) => {
  const { name, params = {} } = event;

  if (typeof window === 'undefined') return;

  // Get stored traffic source (UTM params + referrer) and merge with event params
  const trafficSource = getStoredTrafficSource();
  const enrichedParams = { ...trafficSource, ...params };

  const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

  // GA4 - use gtag('event', ...) directly (standard GA4 pattern)
  if (GA4_ID && window.gtag && typeof window.gtag === 'function') {
    try {
      // Call gtag with event - this is the standard way to send events
      window.gtag('event', name, enrichedParams);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics] Event sent:', name, enrichedParams);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Analytics] Error calling gtag:', error);
      }
    }
  } else if (GA4_ID && process.env.NODE_ENV === 'development') {
    console.warn('[Analytics] gtag not available - event not sent:', name);
  } else if (process.env.NODE_ENV === 'development') {
    console.warn('[Analytics] NEXT_PUBLIC_GA4_MEASUREMENT_ID not set');
  }

  // Plausible (if GA4 not configured)
  if (window.plausible && !GA4_ID) {
    window.plausible(name, { props: enrichedParams });
  }

  // Debug log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', name, enrichedParams, GA4_ID ? '(GA4 enabled)' : '(GA4 disabled)');
    console.log('[Analytics] dataLayer length:', window.dataLayer?.length);
    console.log('[Analytics] gtag type:', typeof window.gtag);
  }
};

export const trackPageView = (url: string) => {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID) return;

  // Initialize dataLayer if it doesn't exist
  if (!window.dataLayer) {
    window.dataLayer = [];
  }

  // Push page view to dataLayer
  window.dataLayer.push({
    event: 'page_view',
    page_path: url,
  });

  // Also call gtag directly if available
  if (window.gtag) {
    window.gtag('config', process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// Common events
export const analytics = {
  viewHome: () => track({ name: 'view_home' }),

  clickSignIn: () => track({ name: 'click_sign_in' }),

  searchSubmit: (params: {
    source_city: string;
    dest_city: string;
    toggles: any;
    multi_cafe?: boolean;
    has_free_text?: boolean;
  }) => track({ name: 'search_submit', params }),

  resultsLoaded: (params: {
    candidate_count: number;
    latency_ms: number;
  }) => track({ name: 'results_loaded', params }),

  resultClick: (params: {
    rank: number;
    place_id: string;
  }) => track({ name: 'result_click', params }),

  resultSaveGoogle: (place_id: string) =>
    track({ name: 'result_save_google', params: { place_id } }),

  resultOpenGmaps: (place_id: string) =>
    track({ name: 'result_open_gmaps', params: { place_id } }),

  buyMeCoffeeClick: () => track({ name: 'buy_me_coffee_click' }),

  emailSubscribeSubmit: () => track({ name: 'email_subscribe_submit' }),

  ctaUpgradeClick: () => track({ name: 'cta_upgrade_click' }),

  // New events for enhanced features
  saveAll: (params: { count: number }) =>
    track({ name: 'save_all', params }),

  refineSearchOpen: () => track({ name: 'refine_search_open' }),

  refineSearchApply: (params: {
    vibes_changed: boolean;
    free_text_added: boolean;
  }) => track({ name: 'refine_search_apply', params }),

  multiCafeSearch: (params: { cafe_count: number }) =>
    track({ name: 'multi_cafe_search', params }),

  freeTextSearch: (params: { has_text: boolean }) =>
    track({ name: 'free_text_search', params }),

  // Export track for custom events
  track,
};
