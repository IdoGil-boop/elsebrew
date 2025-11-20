export const ADVANCED_PLACE_FIELDS = [
  'outdoorSeating',
  'takeout',
  'delivery',
  'dineIn',
  'reservable',
  'goodForGroups',
  'goodForChildren',
  'goodForWatchingSports',
  'liveMusic',
  'servesCoffee',
  'servesBreakfast',
  'servesBrunch',
  'servesLunch',
  'servesDinner',
  'servesBeer',
  'servesWine',
  'servesVegetarianFood',
  'allowsDogs',
  'restroom',
  'menuForChildren',
  'accessibilityOptions',
  'paymentOptions',
  'parkingOptions',
] as const;

export type AdvancedPlaceField = typeof ADVANCED_PLACE_FIELDS[number];

export type AdvancedPlaceFieldValues = Partial<Record<AdvancedPlaceField, any>>;

export const ADVANCED_PLACE_FIELD_MASK = ADVANCED_PLACE_FIELDS.join(',');

/**
 * Determine which Google API fields are relevant based on user query, vibes, and free text
 * This helps control costs by only fetching fields that are actually needed
 */
export function getRelevantFields(
  vibes: { [key: string]: boolean },
  keywords: string[] = [],
  freeText: string = ''
): AdvancedPlaceField[] {
  const relevantFields = new Set<AdvancedPlaceField>();
  const queryText = `${keywords.join(' ')} ${freeText}`.toLowerCase();

  // Always fetch essential fields
  relevantFields.add('servesCoffee');
  relevantFields.add('outdoorSeating'); // Common preference

  // Vibe-based field selection
  if (vibes.brunch) {
    relevantFields.add('servesBrunch');
    relevantFields.add('servesBreakfast');
  }

  if (vibes.servesVegetarian) {
    relevantFields.add('servesVegetarianFood');
  }

  if (vibes.allowsDogs) {
    relevantFields.add('allowsDogs');
  }

  if (vibes.laptopFriendly) {
    // Laptop-friendly might need restroom, good for groups
    relevantFields.add('restroom');
  }

  if (vibes.nightOwl) {
    relevantFields.add('servesDinner');
    relevantFields.add('servesBeer');
    relevantFields.add('servesWine');
  }

  // Query text analysis
  if (queryText.includes('dine') || queryText.includes('eat in') || queryText.includes('sit down')) {
    relevantFields.add('dineIn');
  }

  if (queryText.includes('takeout') || queryText.includes('take out') || queryText.includes('to go') || queryText.includes('to-go')) {
    relevantFields.add('takeout');
  }

  if (queryText.includes('delivery') || queryText.includes('deliver')) {
    relevantFields.add('delivery');
  }

  if (queryText.includes('reservation') || queryText.includes('reserve') || queryText.includes('book')) {
    relevantFields.add('reservable');
  }

  if (queryText.includes('group') || queryText.includes('party') || queryText.includes('meeting')) {
    relevantFields.add('goodForGroups');
  }

  if (queryText.includes('child') || queryText.includes('kid') || queryText.includes('family')) {
    relevantFields.add('goodForChildren');
    relevantFields.add('menuForChildren');
  }

  if (queryText.includes('sport') || queryText.includes('game') || queryText.includes('watch')) {
    relevantFields.add('goodForWatchingSports');
  }

  if (queryText.includes('music') || queryText.includes('live') || queryText.includes('band')) {
    relevantFields.add('liveMusic');
  }

  if (queryText.includes('breakfast') || queryText.includes('morning')) {
    relevantFields.add('servesBreakfast');
  }

  if (queryText.includes('brunch')) {
    relevantFields.add('servesBrunch');
    relevantFields.add('servesBreakfast');
  }

  if (queryText.includes('lunch')) {
    relevantFields.add('servesLunch');
  }

  if (queryText.includes('dinner') || queryText.includes('evening')) {
    relevantFields.add('servesDinner');
  }

  if (queryText.includes('beer') || queryText.includes('alcohol') || queryText.includes('drink')) {
    relevantFields.add('servesBeer');
    relevantFields.add('servesWine');
  }

  if (queryText.includes('vegetarian') || queryText.includes('vegan') || queryText.includes('plant')) {
    relevantFields.add('servesVegetarianFood');
  }

  if (queryText.includes('dog') || queryText.includes('pet') || queryText.includes('animal')) {
    relevantFields.add('allowsDogs');
  }

  if (queryText.includes('accessibility') || queryText.includes('wheelchair') || queryText.includes('accessible')) {
    relevantFields.add('accessibilityOptions');
  }

  if (queryText.includes('parking') || queryText.includes('car')) {
    relevantFields.add('parkingOptions');
  }

  if (queryText.includes('payment') || queryText.includes('card') || queryText.includes('cash')) {
    relevantFields.add('paymentOptions');
  }

  return Array.from(relevantFields);
}

