'use client';

import { useEffect, useRef } from 'react';
import { CafeMatch } from '@/types';
import { loadGoogleMaps } from '@/lib/maps-loader';
import { analytics } from '@/lib/analytics';

interface ResultsMapProps {
  results: CafeMatch[];
  center: google.maps.LatLngLiteral;
  selectedIndex: number | null;
  hoveredIndex: number | null;
  onMarkerClick: (index: number) => void;
}

export default function ResultsMap({
  results,
  center,
  selectedIndex,
  hoveredIndex,
  onMarkerClick,
}: ResultsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // Initialize map once
  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const google = await loadGoogleMaps();

      const map = new google.maps.Map(mapRef.current, {
        center: center && center.lat !== 0 && center.lng !== 0 ? center : { lat: 0, lng: 0 },
        zoom: 13,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
        gestureHandling: 'greedy',
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapInstanceRef.current = map;
    };

    initMap();
  }, []);

  // Update markers when results change - always use current results list
  useEffect(() => {
    const updateMarkers = async () => {
      if (!mapInstanceRef.current) return;

      const google = await loadGoogleMaps();

      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      console.log('[Map] Updating markers for results:', {
        resultCount: results.length,
        center,
        firstResultLocation: results[0]?.place.location,
      });

      // Create markers from current results list
      results.forEach((result, index) => {
        // Handle location - could be google.maps.LatLng or plain object from cache
        let position: google.maps.LatLng | google.maps.LatLngLiteral | null = null;
        
        if (result.place.location) {
          const location = result.place.location as any;
          const latType = typeof location.lat;
          console.log(`[Map] Processing location for result ${index} (${result.place.id}):`, {
            hasLocation: !!result.place.location,
            latType,
            location,
          });

          if (latType === 'function') {
            // Already a google.maps.LatLng object
            position = result.place.location as google.maps.LatLng;
            console.log(`[Map] Using LatLng object for result ${index}`);
          } else if (latType === 'number') {
            // Plain object from cache - convert to LatLng
            position = new google.maps.LatLng(location.lat, location.lng);
            console.log(`[Map] Converted plain object to LatLng for result ${index}:`, position);
          } else {
            console.warn(`[Map] Unknown location type for result ${index}:`, location);
          }
        } else {
          console.warn(`[Map] No location for result ${index} (${result.place.id})`);
        }

        if (!position) {
          console.warn(`[Map] Skipping marker for result ${index} - no valid position`);
          return;
        }

        const marker = new google.maps.Marker({
          position,
          map: mapInstanceRef.current!,
          label: {
            text: String(index + 1),
            color: 'white',
            fontWeight: 'bold',
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 20,
            fillColor: '#5B4636',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2,
          },
        });

        marker.addListener('click', () => {
          analytics.resultClick({ rank: index + 1, place_id: results[index].place.id });
          onMarkerClick(index);
        });

        markersRef.current.push(marker);
      });

      // Fit bounds to show all markers, or use center if no markers
      if (results.length > 0) {
        // Collect all valid positions
        const bounds = new google.maps.LatLngBounds();
        let hasValidPositions = false;

        results.forEach(result => {
          if (result.place.location) {
            // Handle location - could be google.maps.LatLng or plain object from cache
            let position: google.maps.LatLng | google.maps.LatLngLiteral | null = null;
            
            if (typeof (result.place.location as any).lat === 'function') {
              position = result.place.location as google.maps.LatLng;
            } else if (typeof (result.place.location as any).lat === 'number') {
              position = new google.maps.LatLng(
                (result.place.location as any).lat,
                (result.place.location as any).lng
              );
            }
            
            if (position) {
              bounds.extend(position);
              hasValidPositions = true;
            }
          }
        });

        if (hasValidPositions) {
          // Fit bounds to show all markers
          mapInstanceRef.current.fitBounds(bounds);
        } else {
          // Fallback: use center if no valid positions
          const isCenterValid = center && center.lat !== 0 && center.lng !== 0;
          if (isCenterValid) {
            mapInstanceRef.current.setCenter(center);
            mapInstanceRef.current.setZoom(13);
          }
        }
      }
    };

    updateMarkers();
  }, [results, center, onMarkerClick]);

  // Update marker styles based on selection/hover
  useEffect(() => {
    const updateMarkerStyles = async () => {
      const highlightIndex = selectedIndex !== null ? selectedIndex : hoveredIndex;
      const google = await loadGoogleMaps();

      markersRef.current.forEach((marker, index) => {
        const isHighlighted = highlightIndex === index;

        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: isHighlighted ? 24 : 20,
          fillColor: isHighlighted ? '#3D2E24' : '#5B4636',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: isHighlighted ? 3 : 2,
        });

        marker.setZIndex(isHighlighted ? 1000 : index);
      });
    };

    updateMarkerStyles();
  }, [selectedIndex, hoveredIndex]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-none sm:rounded-2xl overflow-hidden shadow-lg"
      style={{ minHeight: '400px' }}
    />
  );
}
