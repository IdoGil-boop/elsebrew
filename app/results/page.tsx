'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CafeMatch, PlaceBasicInfo, VibeToggles } from '@/types';
import { loadGoogleMaps } from '@/lib/maps-loader';
import { searchCafes } from '@/lib/places-search';
import { analytics } from '@/lib/analytics';
import ResultsList from '@/components/results/ResultsList';
import ResultsMap from '@/components/results/ResultsMap';
import DetailsDrawer from '@/components/results/DetailsDrawer';

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [results, setResults] = useState<CafeMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<CafeMatch | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });

  useEffect(() => {
    const performSearch = async () => {
      const startTime = Date.now();

      try {
        const sourcePlaceId = searchParams.get('sourcePlaceId');
        const sourceName = searchParams.get('sourceName');
        const destCity = searchParams.get('destCity');
        const vibesParam = searchParams.get('vibes');

        if (!sourcePlaceId || !destCity || !vibesParam) {
          setError('Missing search parameters');
          setIsLoading(false);
          return;
        }

        const vibes: VibeToggles = JSON.parse(vibesParam);
        const google = await loadGoogleMaps();

        // Get source place details
        const map = new google.maps.Map(document.createElement('div'));
        const service = new google.maps.places.PlacesService(map);

        const sourcePlace = await new Promise<PlaceBasicInfo>((resolve, reject) => {
          service.getDetails(
            {
              placeId: sourcePlaceId,
              fields: [
                'place_id',
                'name',
                'types',
                'rating',
                'user_ratings_total',
                'price_level',
                'opening_hours',
                'photos',
                'editorial_summary',
              ],
            },
            (place, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                resolve({
                  place_id: place.place_id!,
                  name: place.name!,
                  types: place.types,
                  rating: place.rating,
                  user_ratings_total: place.user_ratings_total,
                  price_level: place.price_level,
                  opening_hours: place.opening_hours,
                  photos: place.photos,
                  editorial_summary: (place as any).editorial_summary?.overview,
                });
              } else {
                reject(new Error('Failed to get source place details'));
              }
            }
          );
        });

        // Geocode destination
        const geocoder = new google.maps.Geocoder();
        const geocodeResult = await geocoder.geocode({ address: destCity });

        if (!geocodeResult.results[0]) {
          throw new Error('Failed to geocode destination');
        }

        const destGeometry = geocodeResult.results[0].geometry;
        const destCenter = destGeometry.location;
        const destBounds = destGeometry.viewport;

        setMapCenter({
          lat: destCenter.lat(),
          lng: destCenter.lng(),
        });

        // Search for matching cafes
        const matches = await searchCafes(google, sourcePlace, destCenter, destBounds, vibes);

        // Fetch Reddit data and image analysis for all matches in parallel with timeout
        const matchesWithData = await Promise.all(
          matches.map(async (match) => {
            // Use Promise.race with timeout to avoid slow API calls
            const fetchWithTimeout = async (promise: Promise<any>, timeoutMs: number) => {
              const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeoutMs)
              );
              try {
                return await Promise.race([promise, timeout]);
              } catch {
                return undefined;
              }
            };

            // Fetch both in parallel with 3 second timeout each
            const [redditData, imageAnalysis] = await Promise.all([
              fetchWithTimeout(
                (async () => {
                  const response = await fetch('/api/reddit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      cafeName: match.place.name,
                      city: destCity,
                    }),
                  });
                  return response.ok ? await response.json() : undefined;
                })(),
                3000 // 3 second timeout
              ),

              fetchWithTimeout(
                (async () => {
                  if (match.place.photos && match.place.photos.length > 0) {
                    const photoUrl = match.place.photos[0].getUrl({ maxWidth: 800 });
                    const response = await fetch('/api/analyze-image', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ imageUrl: photoUrl }),
                    });
                    if (response.ok) {
                      const data = await response.json();
                      return data.analysis;
                    }
                  }
                  return undefined;
                })(),
                3000 // 3 second timeout
              ),
            ]);

            return {
              ...match,
              redditData,
              imageAnalysis,
            };
          })
        );

        // Generate all reasonings in one batch request for diversity
        let matchesWithReasoning = matchesWithData;
        try {
          const batchResponse = await fetch('/api/reason-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: {
                name: sourcePlace.name,
                price_level: sourcePlace.price_level,
                rating: sourcePlace.rating,
              },
              candidates: matchesWithData.map(match => ({
                name: match.place.name,
                price_level: match.place.price_level,
                rating: match.place.rating,
                user_ratings_total: match.place.user_ratings_total,
                editorial_summary: match.place.editorial_summary,
                keywords: match.matchedKeywords,
                redditData: match.redditData,
                imageAnalysis: match.imageAnalysis,
              })),
              city: destCity,
              vibes: vibes,
            }),
          });

          if (batchResponse.ok) {
            const { reasonings } = await batchResponse.json();
            matchesWithReasoning = matchesWithData.map((match, index) => ({
              ...match,
              reasoning: reasonings[index] || 'Similar vibe and quality.',
            }));
          }
        } catch (err) {
          console.error('Failed to fetch batch reasoning:', err);
        }

        setResults(matchesWithReasoning);

        // Track results loaded
        const latency = Date.now() - startTime;
        analytics.resultsLoaded({
          candidate_count: matchesWithReasoning.length,
          latency_ms: latency,
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Search error:', err);
        setError(err instanceof Error ? err.message : 'Search failed');
        setIsLoading(false);
      }
    };

    performSearch();
  }, [searchParams]);

  const handleSelectResult = (result: CafeMatch, index: number) => {
    setSelectedResult(result);
    setSelectedIndex(index);
  };

  const handleCloseDrawer = () => {
    setSelectedResult(null);
    setSelectedIndex(null);
  };

  const handleMarkerClick = (index: number) => {
    setSelectedResult(results[index]);
    setSelectedIndex(index);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">☕</div>
          <div className="text-lg text-gray-600">Finding your café twins...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-espresso transition-colors mx-auto"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to search
          </button>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🤷</div>
          <h2 className="text-xl font-semibold mb-2">No matches found</h2>
          <p className="text-gray-600 mb-4">
            Try adjusting your vibe preferences or choosing a different destination
          </p>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-espresso transition-colors mx-auto"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            New search
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">
                {results.length} café{results.length !== 1 ? 's' : ''} found
              </h1>
              <p className="text-sm text-gray-600">
                {searchParams.get('sourceName')} → {searchParams.get('destCity')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-espresso transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                New search
              </button>
            </div>
          </div>
        </div>

        {/* Results grid */}
        <div className="flex-1">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* List */}
              <div className="h-[calc(100vh-180px)]">
                <ResultsList
                  results={results}
                  onSelectResult={handleSelectResult}
                  selectedIndex={selectedIndex}
                  hoveredIndex={hoveredIndex}
                  onHover={setHoveredIndex}
                />
              </div>

              {/* Map */}
              <div className="hidden lg:block h-[calc(100vh-180px)]">
                <ResultsMap
                  results={results}
                  center={mapCenter}
                  selectedIndex={selectedIndex}
                  hoveredIndex={hoveredIndex}
                  onMarkerClick={handleMarkerClick}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details drawer */}
      {selectedResult && (
        <DetailsDrawer result={selectedResult} onClose={handleCloseDrawer} />
      )}
    </>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-4xl animate-bounce">☕</div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
