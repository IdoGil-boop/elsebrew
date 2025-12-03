import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getUserSubscription } from '@/lib/subscription';

import {
  ADVANCED_PLACE_FIELDS,
  ADVANCED_PLACE_FIELD_MASK,
  AdvancedPlaceFieldValues,
  getRelevantFields,
} from '@/lib/googlePlaceFields';

const GOOGLE_PLACES_BASE_URL = 'https://places.googleapis.com/v1';
const MAX_PLACE_DETAILS = 20;

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const user = await getUserFromRequest(request);

    // Get user's subscription tier
    const subscription = await getUserSubscription(user?.sub);

    const body = await request.json();
    const placeIds: unknown = body?.placeIds;
    const vibes: { [key: string]: boolean } = body?.vibes || {};
    const keywords: string[] = body?.keywords || [];
    const freeText: string = body?.freeText || '';
    const forRecommendations: boolean = body?.forRecommendations === true;

    // Premium feature gate: Advanced fields are only available for premium users
    // Exception: Allow fetching fields for recommendations (source places) even for non-premium users
    // Search results (forRecommendations=false) will return empty fields for non-premium users
    if (subscription.tier !== 'premium' && !forRecommendations) {
      console.log('[Places Details API] Free user attempted to access premium fields for search results - returning empty');
      // Return empty fields for free users (unless it's for recommendations from source places)
      if (!Array.isArray(placeIds)) {
        return NextResponse.json(
          { error: 'placeIds must be an array' },
          { status: 400 },
        );
      }

      // Return empty advanced fields for each place ID
      const fieldsByPlaceId = placeIds.reduce(
        (acc: Record<string, AdvancedPlaceFieldValues>, placeId: any) => {
          if (typeof placeId === 'string') {
            acc[placeId] = {};
          }
          return acc;
        },
        {}
      );

      return NextResponse.json({ fieldsByPlaceId });
    }

    if (forRecommendations && subscription.tier !== 'premium') {
      console.log('[Places Details API] Non-premium user fetching fields for recommendations - allowing');
    }

    if (!Array.isArray(placeIds) || placeIds.length === 0) {
      return NextResponse.json(
        { error: 'placeIds must be a non-empty array' },
        { status: 400 },
      );
    }

    // Determine which fields are relevant based on query
    // For recommendations, fetch all fields to get comprehensive vibe matching
    const relevantFields = forRecommendations 
      ? [...ADVANCED_PLACE_FIELDS] 
      : getRelevantFields(vibes, keywords, freeText);
    // Always include photos in the field mask
    const fieldMask = `photos,${relevantFields.length > 0 ? relevantFields.join(',') : ADVANCED_PLACE_FIELD_MASK}`;

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('[Places Details API] GOOGLE_MAPS_API_KEY is not configured');
      return NextResponse.json(
        { 
          error: 'Google Maps API key is not configured',
          details: 'GOOGLE_MAPS_API_KEY environment variable is missing. Please set it in AWS Amplify environment variables.'
        },
        { status: 500 },
      );
    }

    const uniqueIds = Array.from(new Set(placeIds)).slice(0, MAX_PLACE_DETAILS);
    console.log(
      `[Places Details API] Fetching ${uniqueIds.length} places with ${relevantFields.length} relevant fields: ${fieldMask}`,
    );

    const detailResults = await Promise.all(
      uniqueIds.map(async (rawPlaceId) => {
        const placeId = typeof rawPlaceId === 'string' ? rawPlaceId : '';
        if (!placeId) {
          return null;
        }

        const resourceName = placeId.startsWith('places/')
          ? placeId
          : `places/${placeId}`;

        const url = new URL(
          `${GOOGLE_PLACES_BASE_URL}/${encodeURI(resourceName)}`,
        );
        url.searchParams.set('fields', fieldMask);
        url.searchParams.set('key', apiKey);

        try {
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
          });
          const data = await response.json();

          if (!response.ok) {
            console.warn(
              `[Places Details API] Failed for ${placeId}:`,
              data?.error?.message || response.statusText,
            );
            return null;
          }

          const filteredFields: AdvancedPlaceFieldValues & { photoUrls?: string[] } = {};
          // Convert photos to URLs if available
          if (data.photos && Array.isArray(data.photos) && data.photos.length > 0) {
            // Construct photo URLs from photo names
            // Format: places/PLACE_ID/photos/PHOTO_REFERENCE
            const photoUrls = data.photos.slice(0, 4).map((photo: any) => {
              if (photo.name) {
                // Use the Photo API endpoint to get the actual image URL
                // Format: https://places.googleapis.com/v1/{name}/media?maxWidthPx=800&key={apiKey}
                return `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${apiKey}`;
              }
              return null;
            }).filter((url: string | null): url is string => url !== null);
            
            if (photoUrls.length > 0) {
              filteredFields.photoUrls = photoUrls;
            }
          }
          // Include all requested fields (for recommendations, this includes all advanced fields)
          relevantFields.forEach((field) => {
            if (data[field] !== undefined) {
              filteredFields[field] = data[field];
            }
          });
          
          // Also include any other advanced fields that might be present (for recommendations)
          if (forRecommendations) {
            ADVANCED_PLACE_FIELDS.forEach((field) => {
              if (data[field] !== undefined && filteredFields[field] === undefined) {
                filteredFields[field] = data[field];
              }
            });
          }

          return { placeId, fields: filteredFields };
        } catch (error) {
          console.warn(
            `[Places Details API] Error fetching ${placeId}:`,
            error instanceof Error ? error.message : error,
          );
          return null;
        }
      }),
    );

    const fieldsByPlaceId = detailResults.reduce(
      (acc, result) => {
        if (result) {
          acc[result.placeId] = result.fields;
        }
        return acc;
      },
      {} as Record<string, AdvancedPlaceFieldValues>,
    );

    const successCount = Object.keys(fieldsByPlaceId).length;
    const totalFieldsCount = Object.values(fieldsByPlaceId).reduce(
      (sum, fields) => sum + Object.keys(fields).length,
      0,
    );
    console.log(
      `[Places Details API] Successfully fetched fields for ${successCount}/${uniqueIds.length} places (${totalFieldsCount} total fields)`,
    );

    return NextResponse.json({ fieldsByPlaceId });
  } catch (error) {
    console.error('[Places Details API] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorStack ? `Stack: ${errorStack}` : 'Check server logs for details'
      },
      { status: 500 },
    );
  }
}

