'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { X, Search, Lock, Sparkles, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAllVibes, getVibeCategories, VibeDefinition, VibeCategory } from '@/lib/vibes';

interface VibeSelectorProps {
  selectedVibes: Record<string, boolean>;
  onVibesChange: (vibes: Record<string, boolean>) => void;
  recommendedVibeIds?: string[];
  isPremium: boolean;
  onUpgradeClick: () => void;
}

export default function VibeSelector({
  selectedVibes,
  onVibesChange,
  recommendedVibeIds = [],
  isPremium,
  onUpgradeClick,
}: VibeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<VibeCategory | 'all' | 'recommended'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Check scrollability of tabs container
  useEffect(() => {
    const checkScrollability = () => {
      if (!tabsContainerRef.current) return;
      const container = tabsContainerRef.current;
      const canScroll = container.scrollWidth > container.clientWidth;
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(canScroll && container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
    };

    if (isOpen) {
      // Check immediately and after a short delay to account for rendering
      checkScrollability();
      const timeoutId = setTimeout(checkScrollability, 100);
      
      const container = tabsContainerRef.current;
      if (container) {
        container.addEventListener('scroll', checkScrollability);
      }
      window.addEventListener('resize', checkScrollability);
      
      return () => {
        clearTimeout(timeoutId);
        if (container) {
          container.removeEventListener('scroll', checkScrollability);
        }
        window.removeEventListener('resize', checkScrollability);
      };
    }
  }, [isOpen]);

  const allVibes = useMemo(() => getAllVibes(), []);
  const categories = useMemo(() => getVibeCategories(), []);

  // Get recommended vibes (top 3)
  const recommendedVibes = useMemo(() => {
    console.log('[VibeSelector] Computing recommendedVibes:', {
      recommendedVibeIds,
      allVibesCount: allVibes.length,
    });
    
    const filtered = allVibes.filter(v => recommendedVibeIds.includes(v.id));
    console.log('[VibeSelector] Filtered recommended vibes:', {
      filteredCount: filtered.length,
      vibes: filtered.map(v => ({ id: v.id, label: v.label })),
    });
    
    const result = filtered.slice(0, 3);
    console.log('[VibeSelector] Final recommended vibes (top 3):', result.map(v => ({ id: v.id, label: v.label })));
    return result;
  }, [allVibes, recommendedVibeIds]);

  // Filter vibes by selected tab and search
  const filteredVibes = useMemo(() => {
    let vibes = allVibes;

    // Filter by selected tab
    if (selectedTab === 'recommended') {
      vibes = vibes.filter(v => recommendedVibeIds.includes(v.id));
    } else if (selectedTab !== 'all') {
      vibes = vibes.filter(v => v.category === selectedTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      vibes = vibes.filter(
        v =>
          v.label.toLowerCase().includes(query) ||
          v.description.toLowerCase().includes(query)
      );
    }

    return vibes;
  }, [allVibes, selectedTab, searchQuery, recommendedVibeIds]);

  const selectedCount = Object.values(selectedVibes).filter(Boolean).length;

  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabsContainerRef.current) return;
    const container = tabsContainerRef.current;
    
    // Find all tab buttons
    const tabs = Array.from(container.querySelectorAll('button'));
    if (tabs.length === 0) return;
    
    const containerRect = container.getBoundingClientRect();
    const currentScrollLeft = container.scrollLeft;
    
    if (direction === 'right') {
      // Find the first tab that's partially or fully hidden on the right
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        const tabRect = tab.getBoundingClientRect();
        
        // Check if this tab is hidden on the right
        if (tabRect.right > containerRect.right) {
          // Scroll just enough to show this tab (align its left edge with container's left edge, or scroll by its width)
          const scrollAmount = tabRect.width + 4; // Tab width + gap
          container.scrollTo({ 
            left: currentScrollLeft + scrollAmount, 
            behavior: 'smooth' 
          });
          return;
        }
      }
      // If all tabs are visible, scroll by one tab width
      if (tabs.length > 0) {
        const scrollAmount = tabs[0].getBoundingClientRect().width + 4;
        container.scrollTo({ 
          left: currentScrollLeft + scrollAmount, 
          behavior: 'smooth' 
        });
      }
    } else {
      // Find the first tab that's partially or fully hidden on the left
      for (let i = tabs.length - 1; i >= 0; i--) {
        const tab = tabs[i];
        const tabRect = tab.getBoundingClientRect();
        
        // Check if this tab is hidden on the left
        if (tabRect.left < containerRect.left) {
          // Scroll just enough to show this tab
          const scrollAmount = tabRect.width + 4; // Tab width + gap
          container.scrollTo({ 
            left: currentScrollLeft - scrollAmount, 
            behavior: 'smooth' 
          });
          return;
        }
      }
      // If all tabs are visible, scroll by one tab width
      if (tabs.length > 0) {
        const scrollAmount = tabs[0].getBoundingClientRect().width + 4;
        container.scrollTo({ 
          left: currentScrollLeft - scrollAmount, 
          behavior: 'smooth' 
        });
      }
    }
  };

  const handleVibeToggle = (vibeId: string, isPremiumVibe: boolean) => {
    if (!isPremium && isPremiumVibe) {
      onUpgradeClick();
      return;
    }

    onVibesChange({
      ...selectedVibes,
      [vibeId]: !selectedVibes[vibeId],
    });
  };

  const handleApplyRecommended = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (!isPremium) {
      console.log('[VibeSelector] Not premium, calling onUpgradeClick');
      onUpgradeClick();
      return;
    }

    // Apply all recommended vibes
    const updatedVibes = { ...selectedVibes };
    recommendedVibes.forEach(vibe => {
      updatedVibes[vibe.id] = true;
    });
    onVibesChange(updatedVibes);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Label and Trigger */}
      <label className="block text-sm font-medium text-charcoal mb-2">
        Vibe preferences {!isPremium && <span className="text-xs text-gray-500">(Premium feature)</span>}
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`input-field w-full flex items-center justify-between ${
          !isPremium ? 'opacity-60' : ''
        }`}
      >
        <span className="text-sm text-gray-700">
          {selectedCount > 0 ? `${selectedCount} vibe${selectedCount > 1 ? 's' : ''} selected` : 'Select vibes'}
        </span>
        <div className="flex items-center gap-2">
          {!isPremium && <Lock className="w-4 h-4 text-gray-400" />}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Inline Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Premium Banner for Free Users */}
          {!isPremium && (
            <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-amber-800">
                    Upgrade to Premium to unlock vibe filters
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpgradeClick();
                  }}
                  className="text-xs px-2 py-1 bg-espresso text-white rounded-lg hover:bg-espresso/90 transition-colors font-medium whitespace-nowrap"
                >
                  Upgrade
                </button>
              </div>
            </div>
          )}

          <div className="p-3">
            {/* Search Bar */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search vibes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full pl-8 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-espresso/20 focus:border-espresso transition-all"
              />
            </div>

            {/* Recommended for You Section */}
            {recommendedVibes.length > 0 && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={handleApplyRecommended}
                  className="w-full text-left mb-1.5 group cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 -mx-1 transition-colors"
                >
                  <div className="text-[10px] font-semibold text-espresso flex items-center gap-1.5 group-hover:text-espresso/80 transition-colors">
                    <Sparkles className="w-3 h-3" />
                    <span>Recommended for you</span>
                    {!isPremium && <Lock className="w-2.5 h-2.5 text-gray-400" />}
                  </div>
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {recommendedVibes.map((vibe) => {
                    const isSelected = selectedVibes[vibe.id] === true;
                    const isLocked = !isPremium && vibe.isPremium;
                    return (
                      <button
                        key={vibe.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isLocked) {
                            onUpgradeClick();
                          } else {
                            handleVibeToggle(vibe.id, vibe.isPremium);
                          }
                        }}
                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-espresso text-white'
                            : 'bg-espresso/10 text-espresso hover:bg-espresso/20'
                        } ${isLocked ? 'opacity-50 cursor-pointer' : 'cursor-pointer'}`}
                      >
                        <span>{vibe.label}</span>
                        {isLocked && <Lock className="w-2.5 h-2.5" />}
                        {isSelected && (
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Minimal Tabs - Scrollable with indicators */}
            <div className="relative mb-2 overflow-hidden">
              {/* Left fade indicator with clickable arrow */}
              {canScrollLeft && (
                <div className="absolute left-0 top-0 bottom-1 w-10 bg-gradient-to-r from-white via-white to-transparent z-10 flex items-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollTabs('left');
                    }}
                    className="p-1 hover:bg-white/50 rounded transition-colors"
                    aria-label="Scroll categories left"
                  >
                    <ChevronLeft className="w-4 h-4 text-espresso/70 drop-shadow-sm" />
                  </button>
                </div>
              )}
              {/* Right fade indicator with clickable arrow */}
              {canScrollRight && (
                <div className="absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-white via-white to-transparent z-10 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollTabs('right');
                    }}
                    className="p-1 hover:bg-white/50 rounded transition-colors"
                    aria-label="Scroll categories right"
                  >
                    <ChevronRight className="w-4 h-4 text-espresso/70 drop-shadow-sm" />
                  </button>
                </div>
              )}
              <div
                ref={tabsContainerRef}
                className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
              >
              {recommendedVibeIds.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTab('recommended');
                  }}
                  className={`flex-shrink-0 px-2 py-1 text-[10px] font-medium whitespace-nowrap rounded transition-colors ${
                    selectedTab === 'recommended'
                      ? 'bg-espresso text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Recommended
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTab('all');
                }}
                className={`flex-shrink-0 px-2 py-1 text-[10px] font-medium whitespace-nowrap rounded transition-colors ${
                  selectedTab === 'all'
                    ? 'bg-espresso text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTab(cat.id);
                  }}
                  className={`flex-shrink-0 px-2 py-1 text-[10px] font-medium whitespace-nowrap rounded transition-colors ${
                    selectedTab === cat.id
                      ? 'bg-espresso text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
              </div>
            </div>

            {/* Simple Vibes List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredVibes.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-xs">No vibes found</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {filteredVibes.map((vibe) => {
                    const isSelected = selectedVibes[vibe.id] === true;
                    const isLocked = !isPremium && vibe.isPremium;

                    return (
                      <button
                        key={vibe.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isLocked) {
                            onUpgradeClick();
                          } else {
                            handleVibeToggle(vibe.id, vibe.isPremium);
                          }
                        }}
                        className={`w-full px-2 py-1.5 text-left transition-all flex items-center justify-between group ${
                          isSelected
                            ? 'bg-espresso/10'
                            : 'hover:bg-gray-50'
                        } ${isLocked ? 'opacity-50 cursor-pointer' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`text-xs ${isSelected ? 'font-medium text-espresso' : 'text-gray-700'}`}>
                            {vibe.label}
                          </span>
                          {isLocked && <Lock className="w-2.5 h-2.5 text-gray-400" />}
                        </div>
                        {isSelected && (
                          <svg
                            className="w-3.5 h-3.5 text-espresso flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-2 pt-2 flex items-center justify-between border-t">
              <div className="text-[10px] text-gray-600">
                {selectedCount} selected
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onVibesChange({});
                }}
                className="text-[10px] px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors font-medium"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
