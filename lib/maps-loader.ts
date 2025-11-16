import { Loader } from '@googlemaps/js-api-loader';

let loaderInstance: Loader | null = null;
let mapsPromise: Promise<typeof google> | null = null;

export const loadGoogleMaps = (): Promise<typeof google> => {
  if (mapsPromise) {
    return mapsPromise;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Google Maps API key is not configured');
  }

  loaderInstance = new Loader({
    apiKey,
    version: 'weekly',
    libraries: ['places'],
  });

  mapsPromise = loaderInstance.load();
  return mapsPromise;
};

export const getGoogleMaps = async () => {
  await loadGoogleMaps();
  return google;
};
