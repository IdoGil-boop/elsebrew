import { SavedCafe, UserProfile } from '@/types';

const STORAGE_KEYS = {
  USER_PROFILE: 'elsebrew_user_profile',
  SAVED_CAFES: 'elsebrew_saved_cafes',
};

export const storage = {
  // User profile
  getUserProfile: (): UserProfile | null => {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : null;
  },

  setUserProfile: (profile: UserProfile | null) => {
    if (typeof window === 'undefined') return;
    if (profile) {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    }
  },

  // Saved cafes
  getSavedCafes: (): SavedCafe[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.SAVED_CAFES);
    return data ? JSON.parse(data) : [];
  },

  saveCafe: (cafe: SavedCafe) => {
    if (typeof window === 'undefined') return;
    const saved = storage.getSavedCafes();
    const exists = saved.find(c => c.placeId === cafe.placeId);
    if (!exists) {
      saved.unshift(cafe);
      localStorage.setItem(STORAGE_KEYS.SAVED_CAFES, JSON.stringify(saved));
    }
  },

  removeSavedCafe: (placeId: string) => {
    if (typeof window === 'undefined') return;
    const saved = storage.getSavedCafes();
    const filtered = saved.filter(c => c.placeId !== placeId);
    localStorage.setItem(STORAGE_KEYS.SAVED_CAFES, JSON.stringify(filtered));
  },

  isCafeSaved: (placeId: string): boolean => {
    if (typeof window === 'undefined') return false;
    const saved = storage.getSavedCafes();
    return saved.some(c => c.placeId === placeId);
  },
};
