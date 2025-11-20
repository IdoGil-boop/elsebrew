'use client';

import { useState } from 'react';
import { VibeToggles } from '@/types';

interface SearchRefinementProps {
  currentVibes: VibeToggles;
  onRefine: (vibes: VibeToggles) => void;
  isRefining: boolean;
}

export default function SearchRefinement({
  currentVibes,
  onRefine,
  isRefining,
}: SearchRefinementProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [vibes, setVibes] = useState<VibeToggles>(currentVibes);

  const handleToggle = (key: keyof VibeToggles) => {
    setVibes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApply = () => {
    onRefine(vibes);
    setIsExpanded(false);
  };

  const vibeOptions = [
    { key: 'roastery' as const, label: 'Roastery', icon: '🔥' },
    { key: 'lightRoast' as const, label: 'Light roast', icon: '☕' },
    { key: 'laptopFriendly' as const, label: 'Laptop-friendly', icon: '💻' },
    { key: 'nightOwl' as const, label: 'Night owl', icon: '🌙' },
    { key: 'cozy' as const, label: 'Cozy', icon: '🛋️' },
    { key: 'minimalist' as const, label: 'Minimalist', icon: '⚪' },
    { key: 'allowsDogs' as const, label: 'Allows dogs', icon: '🐕' },
    { key: 'servesVegetarian' as const, label: 'Serves vegetarian', icon: '🥗' },
    { key: 'brunch' as const, label: 'Brunch', icon: '🥐' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="btn-secondary flex items-center gap-2"
      >
        <span>🔍</span>
        Refine search
      </button>

      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-6 z-50 w-80">
          <h3 className="font-semibold text-lg mb-4">Refine your search</h3>

          <div className="space-y-3 mb-4">
            {vibeOptions.map((option) => (
              <label
                key={option.key}
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
              >
                <input
                  type="checkbox"
                  checked={vibes[option.key]}
                  onChange={() => handleToggle(option.key)}
                  className="w-5 h-5 rounded border-gray-300 text-espresso focus:ring-espresso"
                />
                <span className="text-xl">{option.icon}</span>
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApply}
              disabled={isRefining}
              className="btn-primary flex-1"
            >
              {isRefining ? 'Applying...' : 'Apply'}
            </button>
            <button
              onClick={() => {
                setVibes(currentVibes);
                setIsExpanded(false);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
