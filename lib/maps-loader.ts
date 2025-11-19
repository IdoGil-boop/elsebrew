import { Loader } from '@googlemaps/js-api-loader';

let loaderInstance: Loader | null = null;
let mapsPromise: Promise<typeof google> | null = null;

export const loadGoogleMaps = (): Promise<typeof google> => {
  if (mapsPromise) {
    return mapsPromise;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    const error = new Error('Google Maps API key is not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.');
    console.error('[Maps Loader] Configuration error:', error.message);
    throw error;
  }

  console.log('[Maps Loader] Initializing with API key:', apiKey.substring(0, 10) + '...');

  loaderInstance = new Loader({
    apiKey,
    version: 'weekly',
    libraries: ['places'],
  });

  mapsPromise = loaderInstance.load().catch((error) => {
    console.error('[Maps Loader] Failed to load Google Maps:', {
      error: error.message,
      stack: error.stack,
    });
    // Reset promise so it can be retried
    mapsPromise = null;
    throw new Error(`Google Maps API failed to load: ${error.message}. This might be due to API key restrictions or quota limits.`);
  });

  return mapsPromise;
};

export const getGoogleMaps = async () => {
  await loadGoogleMaps();
  return google;
};
