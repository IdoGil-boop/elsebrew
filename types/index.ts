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
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: google.maps.places.PlaceGeometry;
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: google.maps.places.PlaceOpeningHours;
  photos?: google.maps.places.PlacePhoto[];
  photoUrl?: string; // Cached photo URL for restored results
  editorial_summary?: string;
}

export interface CafeMatch {
  place: PlaceBasicInfo;
  score: number;
  reasoning?: string;
  matchedKeywords: string[];
  distanceToCenter?: number;
  redditData?: RedditData;
  imageAnalysis?: string;
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
