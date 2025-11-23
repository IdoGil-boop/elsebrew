import { NextResponse } from 'next/server';

import {
  ADVANCED_PLACE_FIELDS,
  ADVANCED_PLACE_FIELD_MASK,
  AdvancedPlaceFieldValues,
  getRelevantFields,
} from '@/lib/googlePlaceFields';

const GOOGLE_PLACES_BASE_URL = 'https://places.googleapis.com/v1';
const MAX_PLACE_DETAILS = 20;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const placeIds: unknown = body?.placeIds;
    const vibes: { [key: string]: boolean } = body?.vibes || {};
    const keywords: string[] = body?.keywords || [];
    const freeText: string = body?.freeText || '';

    if (!Array.isArray(placeIds) || placeIds.length === 0) {
      return NextResponse.json(
        { error: 'placeIds must be a non-empty array' },
        { status: 400 },
      );
    }

    // Determine which fields are relevant based on query
    const relevantFields = getRelevantFields(vibes, keywords, freeText);
    // Always include photos in the field mask
    const fieldMask = `photos,${relevantFields.length > 0 ? relevantFields.join(',') : ADVANCED_PLACE_FIELD_MASK}`;

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key is not configured' },
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
          // Only include fields that were requested (relevantFields)
          relevantFields.forEach((field) => {
            if (data[field] !== undefined) {
              filteredFields[field] = data[field];
            }
          });

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

