'use client';

import { useEffect, useRef, useState } from 'react';
import { CafeMatch } from '@/types';
import { loadGoogleMaps } from '@/lib/maps-loader';
import { analytics } from '@/lib/analytics';

interface DestinationCircle {
  center: google.maps.LatLngLiteral;
  radius: number;
}

interface ResultsMapProps {
  results: CafeMatch[];
  center: google.maps.LatLngLiteral;
  selectedIndex: number | null;
  hoveredIndex: number | null;
  onMarkerClick: (index: number) => void;
  destinationCircle?: DestinationCircle | null;
}

export default function ResultsMap({
  results,
  center,
  selectedIndex,
  hoveredIndex,
  onMarkerClick,
  destinationCircle,
}: ResultsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const destinationCircleRef = useRef<google.maps.Circle | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationCircleDataRef = useRef<DestinationCircle | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const clearDestinationOverlay = () => {
    if (destinationCircleRef.current) {
      destinationCircleRef.current.setMap(null);
      destinationCircleRef.current = null;
    }
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setMap(null);
      destinationMarkerRef.current = null;
    }
  };

  const drawDestinationOverlay = async (circleData: DestinationCircle) => {
    if (!mapInstanceRef.current) return;

    const google =
      (window as any)?.google ??
      (await loadGoogleMaps());

    // Draw a red pin marker for the establishment destination (like Google Maps)
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Draw red pin shape
      ctx.fillStyle = '#EA4335'; // Google Maps red

      // Pin head (circle)
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, 2 * Math.PI);
      ctx.fill();

      // Pin point (triangle)
      ctx.beginPath();
      ctx.moveTo(16, 28);
      ctx.lineTo(8, 20);
      ctx.lineTo(24, 20);
      ctx.closePath();
      ctx.fill();

      // White circle in center
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(16, 16, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    destinationMarkerRef.current = new google.maps.Marker({
      map: mapInstanceRef.current,
      position: circleData.center,
      icon: {
        url: canvas.toDataURL(),
        scaledSize: new google.maps.Size(32, 48),
        anchor: new google.maps.Point(16, 48), // Bottom center anchor (tip of pin)
      },
      zIndex: 1100,
      title: 'Destination',
    });
  };

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
      setIsMapReady(true);

      // If we already have destination data (e.g., restored state), draw it now
      if (destinationCircleDataRef.current) {
        drawDestinationOverlay(destinationCircleDataRef.current);
      }
    };

    initMap();
  }, []);

  // Update markers when results change - always use current results list
  useEffect(() => {
    const updateMarkers = async () => {
      if (!mapInstanceRef.current) return;

      const google =
        (window as any)?.google ??
        (await loadGoogleMaps());

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
      if (results.length > 0 || destinationCircle) {
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

        if (destinationCircle) {
          const { center: destCenter, radius } = destinationCircle;
          const radiusKm = radius / 1000;
          const latDelta = radiusKm / 111;
          const lngDelta = radiusKm / (111 * Math.cos((destCenter.lat * Math.PI) / 180));

          const centerLatLng = new google.maps.LatLng(destCenter.lat, destCenter.lng);
          bounds.extend(centerLatLng);
          bounds.extend(new google.maps.LatLng(destCenter.lat + latDelta, destCenter.lng));
          bounds.extend(new google.maps.LatLng(destCenter.lat - latDelta, destCenter.lng));
          bounds.extend(new google.maps.LatLng(destCenter.lat, destCenter.lng + lngDelta));
          bounds.extend(new google.maps.LatLng(destCenter.lat, destCenter.lng - lngDelta));
          bounds.extend(new google.maps.LatLng(destCenter.lat + latDelta, destCenter.lng + lngDelta));
          bounds.extend(new google.maps.LatLng(destCenter.lat + latDelta, destCenter.lng - lngDelta));
          bounds.extend(new google.maps.LatLng(destCenter.lat - latDelta, destCenter.lng + lngDelta));
          bounds.extend(new google.maps.LatLng(destCenter.lat - latDelta, destCenter.lng - lngDelta));
          hasValidPositions = true;
        }

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
  }, [results, center, onMarkerClick, destinationCircle]);

  // Draw destination circle/marker for point destinations
  useEffect(() => {
    destinationCircleDataRef.current = destinationCircle ?? null;

    const updateDestinationOverlay = async () => {
      clearDestinationOverlay();

      if (!destinationCircle || !isMapReady || !mapInstanceRef.current) {
        return;
      }

      await drawDestinationOverlay(destinationCircle);
    };

    updateDestinationOverlay();

    return () => {
      clearDestinationOverlay();
    };
  }, [destinationCircle, isMapReady]);

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
