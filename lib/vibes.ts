import { AdvancedPlaceField } from './googlePlaceFields';

export type VibeCategory = 'ambiance' | 'food-drink' | 'amenities' | 'accessibility' | 'timing' | 'coffee-specialty';

export interface VibeDefinition {
  id: string;
  label: string;
  description: string;
  category: VibeCategory;
  icon: string;
  googleField?: AdvancedPlaceField; // For Google-mapped vibes
  queryKeywords?: string[]; // For custom vibes or keyword enhancement
  isPremium: boolean; // All vibes are premium now
}

/**
 * Comprehensive vibe definitions
 * Includes all relevant Google Places Atmosphere fields + custom vibes
 */
export const VIBE_DEFINITIONS: Record<string, VibeDefinition> = {
  // AMBIANCE VIBES
  cozy: {
    id: 'cozy',
    label: 'Cozy',
    description: 'Warm, intimate atmosphere',
    category: 'ambiance',
    icon: '🛋️',
    queryKeywords: ['cozy', 'intimate', 'warm'],
    isPremium: true,
  },
  minimalist: {
    id: 'minimalist',
    label: 'Minimalist',
    description: 'Clean, modern design',
    category: 'ambiance',
    icon: '⚪',
    queryKeywords: ['minimalist', 'modern', 'clean design'],
    isPremium: true,
  },
  outdoorSeating: {
    id: 'outdoorSeating',
    label: 'Outdoor Seating',
    description: 'Patio or terrace seating available',
    category: 'ambiance',
    icon: '☀️',
    googleField: 'outdoorSeating',
    queryKeywords: ['outdoor', 'patio', 'terrace'],
    isPremium: true,
  },
  liveMusic: {
    id: 'liveMusic',
    label: 'Live Music',
    description: 'Features live music performances',
    category: 'ambiance',
    icon: '🎵',
    googleField: 'liveMusic',
    queryKeywords: ['live music', 'acoustic', 'performance'],
    isPremium: true,
  },
  sportsFriendly: {
    id: 'sportsFriendly',
    label: 'Sports Friendly',
    description: 'Great for watching sports',
    category: 'ambiance',
    icon: '📺',
    googleField: 'goodForWatchingSports',
    queryKeywords: ['sports', 'game', 'watch'],
    isPremium: true,
  },
  instagrammable: {
    id: 'instagrammable',
    label: 'Instagrammable',
    description: 'Aesthetic, photogenic interior',
    category: 'ambiance',
    icon: '📸',
    queryKeywords: ['aesthetic', 'photogenic', 'instagram', 'beautiful'],
    isPremium: true,
  },

  // COFFEE SPECIALTY VIBES
  roastery: {
    id: 'roastery',
    label: 'Roastery',
    description: 'Roasts their own coffee beans',
    category: 'coffee-specialty',
    icon: '🔥',
    queryKeywords: ['roastery', 'roaster', 'roasts own'],
    isPremium: true,
  },
  lightRoast: {
    id: 'lightRoast',
    label: 'Light Roast / Filter-First',
    description: 'Specializes in light roasts and filter coffee',
    category: 'coffee-specialty',
    icon: '☕',
    queryKeywords: ['light roast', 'filter', 'specialty coffee', 'third wave'],
    isPremium: true,
  },
  singleOrigin: {
    id: 'singleOrigin',
    label: 'Single Origin',
    description: 'Offers single origin coffee',
    category: 'coffee-specialty',
    icon: '🌍',
    queryKeywords: ['single origin', 'origin', 'traceable'],
    isPremium: true,
  },
  pourOver: {
    id: 'pourOver',
    label: 'Pour Over',
    description: 'Specializes in pour over coffee',
    category: 'coffee-specialty',
    icon: '⏱️',
    queryKeywords: ['pour over', 'v60', 'chemex', 'manual brew'],
    isPremium: true,
  },
  coldBrew: {
    id: 'coldBrew',
    label: 'Cold Brew',
    description: 'Great cold brew coffee',
    category: 'coffee-specialty',
    icon: '🧊',
    queryKeywords: ['cold brew', 'iced coffee'],
    isPremium: true,
  },
  nitro: {
    id: 'nitro',
    label: 'Nitro Coffee',
    description: 'Serves nitro cold brew',
    category: 'coffee-specialty',
    icon: '🍺',
    queryKeywords: ['nitro', 'nitrogen', 'nitro coffee'],
    isPremium: true,
  },

  // FOOD & DRINK VIBES
  brunch: {
    id: 'brunch',
    label: 'Brunch',
    description: 'Serves brunch menu',
    category: 'food-drink',
    icon: '🥐',
    googleField: 'servesBrunch',
    queryKeywords: ['brunch'],
    isPremium: true,
  },
  servesBreakfast: {
    id: 'servesBreakfast',
    label: 'Breakfast',
    description: 'Serves breakfast',
    category: 'food-drink',
    icon: '🍳',
    googleField: 'servesBreakfast',
    queryKeywords: ['breakfast', 'morning'],
    isPremium: true,
  },
  servesLunch: {
    id: 'servesLunch',
    label: 'Lunch',
    description: 'Serves lunch menu',
    category: 'food-drink',
    icon: '🥗',
    googleField: 'servesLunch',
    queryKeywords: ['lunch'],
    isPremium: true,
  },
  servesDinner: {
    id: 'servesDinner',
    label: 'Dinner',
    description: 'Serves dinner',
    category: 'food-drink',
    icon: '🍽️',
    googleField: 'servesDinner',
    queryKeywords: ['dinner', 'evening'],
    isPremium: true,
  },
  servesVegetarian: {
    id: 'servesVegetarian',
    label: 'Vegetarian Options',
    description: 'Has vegetarian food options',
    category: 'food-drink',
    icon: '🥬',
    googleField: 'servesVegetarianFood',
    queryKeywords: ['vegetarian', 'vegan'],
    isPremium: true,
  },
  oatMilk: {
    id: 'oatMilk',
    label: 'Oat Milk',
    description: 'Offers oat milk alternative',
    category: 'food-drink',
    icon: '🌾',
    googleField: 'servesVegetarianFood', // Maps to veg options
    queryKeywords: ['oat milk', 'plant milk', 'dairy free'],
    isPremium: true,
  },
  bakedGoods: {
    id: 'bakedGoods',
    label: 'Baked Goods',
    description: 'Great pastries and baked items',
    category: 'food-drink',
    icon: '🥐',
    queryKeywords: ['pastries', 'baked goods', 'croissant', 'cake'],
    isPremium: true,
  },
  servesBeer: {
    id: 'servesBeer',
    label: 'Serves Beer',
    description: 'Serves beer',
    category: 'food-drink',
    icon: '🍺',
    googleField: 'servesBeer',
    queryKeywords: ['beer', 'craft beer'],
    isPremium: true,
  },
  servesWine: {
    id: 'servesWine',
    label: 'Serves Wine',
    description: 'Serves wine',
    category: 'food-drink',
    icon: '🍷',
    googleField: 'servesWine',
    queryKeywords: ['wine'],
    isPremium: true,
  },
  servesCocktails: {
    id: 'servesCocktails',
    label: 'Serves Cocktails',
    description: 'Serves cocktails',
    category: 'food-drink',
    icon: '🍸',
    googleField: 'servesCocktails',
    queryKeywords: ['cocktails', 'mixed drinks'],
    isPremium: true,
  },

  // AMENITIES VIBES
  laptopFriendly: {
    id: 'laptopFriendly',
    label: 'Laptop Friendly',
    description: 'Great for working remotely',
    category: 'amenities',
    icon: '💻',
    googleField: 'restroom', // Proxy field
    queryKeywords: ['workspace', 'wifi', 'laptop friendly', 'remote work', 'coworking'],
    isPremium: true,
  },
  allowsDogs: {
    id: 'allowsDogs',
    label: 'Dog Friendly',
    description: 'Welcomes dogs',
    category: 'amenities',
    icon: '🐕',
    googleField: 'allowsDogs',
    queryKeywords: ['dog friendly', 'pet friendly'],
    isPremium: true,
  },
  takeout: {
    id: 'takeout',
    label: 'Takeout Available',
    description: 'Offers takeout service',
    category: 'amenities',
    icon: '🥡',
    googleField: 'takeout',
    queryKeywords: ['takeout', 'to go'],
    isPremium: true,
  },
  delivery: {
    id: 'delivery',
    label: 'Delivery',
    description: 'Offers delivery service',
    category: 'amenities',
    icon: '🚗',
    googleField: 'delivery',
    queryKeywords: ['delivery'],
    isPremium: true,
  },
  dineIn: {
    id: 'dineIn',
    label: 'Dine In',
    description: 'Offers dine-in service',
    category: 'amenities',
    icon: '🪑',
    googleField: 'dineIn',
    queryKeywords: ['dine in', 'sit down'],
    isPremium: true,
  },
  reservable: {
    id: 'reservable',
    label: 'Accepts Reservations',
    description: 'Can make reservations',
    category: 'amenities',
    icon: '📅',
    googleField: 'reservable',
    queryKeywords: ['reservation', 'book', 'booking'],
    isPremium: true,
  },
  goodForGroups: {
    id: 'goodForGroups',
    label: 'Good for Groups',
    description: 'Accommodates large groups',
    category: 'amenities',
    icon: '👥',
    googleField: 'goodForGroups',
    queryKeywords: ['groups', 'party', 'gathering'],
    isPremium: true,
  },
  goodForChildren: {
    id: 'goodForChildren',
    label: 'Kid Friendly',
    description: 'Family and kid friendly',
    category: 'amenities',
    icon: '👶',
    googleField: 'goodForChildren',
    queryKeywords: ['kids', 'children', 'family'],
    isPremium: true,
  },
  menuForChildren: {
    id: 'menuForChildren',
    label: "Kids' Menu",
    description: 'Has menu items for children',
    category: 'amenities',
    icon: '🧒',
    googleField: 'menuForChildren',
    queryKeywords: ["kids menu", 'children menu'],
    isPremium: true,
  },
  parking: {
    id: 'parking',
    label: 'Parking Available',
    description: 'Has parking options',
    category: 'amenities',
    icon: '🅿️',
    googleField: 'parkingOptions',
    queryKeywords: ['parking', 'car park'],
    isPremium: true,
  },
  restroom: {
    id: 'restroom',
    label: 'Restroom',
    description: 'Has restroom facilities',
    category: 'amenities',
    icon: '🚻',
    googleField: 'restroom',
    queryKeywords: ['restroom', 'bathroom'],
    isPremium: true,
  },

  // ACCESSIBILITY VIBES
  accessibleFriendly: {
    id: 'accessibleFriendly',
    label: 'Wheelchair Accessible',
    description: 'Wheelchair accessible facilities',
    category: 'accessibility',
    icon: '♿',
    googleField: 'accessibilityOptions',
    queryKeywords: ['accessible', 'wheelchair', 'disability'],
    isPremium: true,
  },

  // TIMING VIBES
  nightOwl: {
    id: 'nightOwl',
    label: 'Night Owl',
    description: 'Open late into the night',
    category: 'timing',
    icon: '🌙',
    queryKeywords: ['late night', 'open late', 'night'],
    isPremium: true,
  },
};

/**
 * Get all vibe definitions
 */
export function getAllVibes(): VibeDefinition[] {
  return Object.values(VIBE_DEFINITIONS);
}

/**
 * Get vibes by category
 */
export function getVibesByCategory(category: VibeCategory): VibeDefinition[] {
  return Object.values(VIBE_DEFINITIONS).filter(v => v.category === category);
}

/**
 * Get vibe definition by ID
 */
export function getVibeById(id: string): VibeDefinition | undefined {
  return VIBE_DEFINITIONS[id];
}

/**
 * Get all vibe categories
 */
export function getVibeCategories(): Array<{ id: VibeCategory; label: string; icon: string }> {
  return [
    { id: 'coffee-specialty', label: 'Coffee Specialty', icon: '☕' },
    { id: 'ambiance', label: 'Ambiance', icon: '✨' },
    { id: 'food-drink', label: 'Food & Drink', icon: '🍽️' },
    { id: 'amenities', label: 'Amenities', icon: '🎯' },
    { id: 'timing', label: 'Timing', icon: '⏰' },
    { id: 'accessibility', label: 'Accessibility', icon: '♿' },
  ];
}

/**
 * Convert vibes object to selected vibe IDs array
 */
export function getSelectedVibeIds(vibes: Record<string, boolean>): string[] {
  return Object.keys(vibes).filter(key => vibes[key] === true);
}

/**
 * Build query keywords from selected vibes
 */
export function buildVibeQueryKeywords(vibes: Record<string, boolean>): string[] {
  const selectedIds = getSelectedVibeIds(vibes);
  const keywords: string[] = [];

  for (const id of selectedIds) {
    const vibe = VIBE_DEFINITIONS[id];
    if (vibe?.queryKeywords) {
      keywords.push(...vibe.queryKeywords);
    }
  }

  return keywords;
}

/**
 * Get Google Place fields to fetch based on selected vibes
 */
export function getVibeFieldsToFetch(vibes: Record<string, boolean>): AdvancedPlaceField[] {
  const selectedIds = getSelectedVibeIds(vibes);
  const fields = new Set<AdvancedPlaceField>();

  for (const id of selectedIds) {
    const vibe = VIBE_DEFINITIONS[id];
    if (vibe?.googleField) {
      fields.add(vibe.googleField);
    }
  }

  return Array.from(fields);
}

/**
 * Check if a vibe is premium (all vibes are premium now)
 */
export function isVibePremium(vibeId: string): boolean {
  return VIBE_DEFINITIONS[vibeId]?.isPremium ?? false;
}
