import { AnalyticsEvent } from '@/types';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    plausible?: (event: string, options?: { props: Record<string, any> }) => void;
  }
}

export const track = (event: AnalyticsEvent) => {
  const { name, params = {} } = event;

  // GA4
  if (typeof window !== 'undefined' && window.gtag && process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID) {
    window.gtag('event', name, params);
  }

  // Plausible (if GA4 not configured)
  if (typeof window !== 'undefined' && window.plausible && !process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID) {
    window.plausible(name, { props: params });
  }

  // Debug log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', name, params);
  }
};

export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag && process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID) {
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
};
