/**
 * Production-safe logger
 * - In development: logs everything
 * - In production: only logs errors and warnings
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  /**
   * Debug logs - only shown in development
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Info logs - only shown in development
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Warning logs - always shown
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Error logs - always shown
   */
  error: (...args: any[]) => {
    console.error(...args);
  },
};

/**
 * Suppress Google Maps deprecation warnings in production
 * These are informational only and clutter the console
 */
export function suppressGoogleMapsWarnings() {
  if (typeof window !== 'undefined' && !isDevelopment) {
    const originalWarn = console.warn;
    console.warn = function (...args: any[]) {
      // Suppress specific Google Maps deprecation warnings
      const message = args[0]?.toString() || '';

      const suppressPatterns = [
        'google.maps.places.Autocomplete is not available',
        'google.maps.places.PlacesService is not available',
        'google.maps.Marker is deprecated',
        'Unknown fields requested:',
      ];

      const shouldSuppress = suppressPatterns.some(pattern =>
        message.includes(pattern)
      );

      if (!shouldSuppress) {
        originalWarn.apply(console, args);
      }
    };
  }
}
