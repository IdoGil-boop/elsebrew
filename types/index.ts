export interface VibeToggles {
  roastery: boolean;
  lightRoast: boolean;
  laptopFriendly: boolean;
  nightOwl: boolean;
  cozy: boolean;
  minimalist: boolean;
}

export interface SearchParams {
  sourcePlaceId: string;
  sourceName: string;
  destinationCity: string;
  destinationCountry?: string;
  vibes: VibeToggles;
}

export interface PlaceBasicInfo {
  id: string; // New API uses 'id' instead of 'place_id'
  displayName: string; // New API uses 'displayName' instead of 'name'
  formattedAddress?: string; // New API uses camelCase
  location?: google.maps.LatLng; // New API uses location directly (lat/lng object)
  types?: string[];
  primaryType?: string; // New API provides a single primary type classification
  rating?: number;
  userRatingCount?: number; // New API uses 'userRatingCount' instead of 'user_ratings_total'
  priceLevel?: number; // New API uses camelCase
  regularOpeningHours?: google.maps.places.PlaceOpeningHours; // New API uses 'regularOpeningHours'
  photos?: google.maps.places.PlacePhoto[];
  photoUrl?: string; // Cached photo URL for restored results
  editorialSummary?: string; // New API uses camelCase, we'll extract the overview
  // Atmosphere & Amenities (Enterprise + Atmosphere SKU)
  outdoorSeating?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  dineIn?: boolean;
  reservable?: boolean;
  goodForGroups?: boolean;
  goodForChildren?: boolean;
  goodForWatchingSports?: boolean;
  liveMusic?: boolean;
  servesCoffee?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesVegetarianFood?: boolean;
  allowsDogs?: boolean;
  restroom?: boolean;
  menuForChildren?: boolean;
  accessibilityOptions?: any; // Contains detailed accessibility info
  paymentOptions?: any; // Payment methods
  parkingOptions?: any; // Parking availability
}

export interface CafeMatch {
  place: PlaceBasicInfo;
  score: number;
  reasoning?: string;
  matchedKeywords: string[];
  distanceToCenter?: number;
  redditData?: RedditData;
  imageAnalysis?: string;
  typeOverlapDetails?: string;
}

export interface RedditData {
  posts: RedditPost[];
  totalMentions: number;
  averageScore: number;
}

export interface RedditPost {
  title: string;
  body: string;
  score: number;
  author: string;
  created_utc: number;
  permalink: string;
  subreddit: string;
}

export interface UserProfile {
  sub: string;
  name: string;
  email: string;
  picture?: string;
  token?: string; // JWT token for authentication
}

export interface SavedCafe {
  placeId: string;
  name: string;
  savedAt: number;
  photoUrl?: string;
  rating?: number;
}

export interface AnalyticsEvent {
  name: string;
  params?: Record<string, any>;
}

export interface SearchState {
  searchId: string; // Unique identifier for this search
  originPlaces: Array<{
    placeId: string;
    name: string;
  }>;
  destination: string;
  vibes: VibeToggles;
  freeText?: string;
  timestamp: string;
}

export interface SearchResultsCache {
  searchState: SearchState;
  allResults: CafeMatch[]; // All fetched results (could be 15, 30, etc.)
  shownPlaceIds: string[]; // Place IDs already shown to user
  currentPage: number; // Which page of Google results we're on (0-indexed)
  hasMorePages: boolean; // Whether Google has more results
  nextPageToken?: string; // Token for fetching next page from Google
}
