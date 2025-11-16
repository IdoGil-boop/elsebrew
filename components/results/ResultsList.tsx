'use client';

import { CafeMatch } from '@/types';
import { motion } from 'framer-motion';
import { analytics } from '@/lib/analytics';

interface ResultsListProps {
  results: CafeMatch[];
  onSelectResult: (result: CafeMatch, index: number) => void;
  selectedIndex: number | null;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
}

export default function ResultsList({
  results,
  onSelectResult,
  selectedIndex,
  hoveredIndex,
  onHover,
}: ResultsListProps) {
  const getPhotoUrl = (place: CafeMatch['place']) => {
    if (place.photos && place.photos.length > 0) {
      return place.photos[0].getUrl({ maxWidth: 400 });
    }
    return null;
  };

  const getPriceLevel = (level?: number) => {
    if (!level) return '';
    return '$'.repeat(level);
  };

  return (
    <div className="space-y-4 overflow-y-auto overflow-x-visible h-full pr-2">
      {results.map((result, index) => {
        const isSelected = selectedIndex === index;
        const isHovered = hoveredIndex === index;
        const photoUrl = getPhotoUrl(result.place);

        return (
          <motion.div
            key={result.place.place_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`
              card p-4 cursor-pointer transition-all duration-200
              ${isSelected || isHovered ? 'ring-2 ring-espresso shadow-lg scale-[1.02]' : ''}
            `}
            onClick={() => {
              onSelectResult(result, index);
              analytics.resultClick({
                rank: index + 1,
                place_id: result.place.place_id,
              });
            }}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="flex gap-4">
              {/* Photo */}
              {photoUrl && (
                <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                  <img
                    src={photoUrl}
                    alt={result.place.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-lg truncate pr-2">
                    {index + 1}. {result.place.name}
                  </h3>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {result.place.rating && (
                      <div className="flex items-center space-x-1">
                        <span className="text-yellow-500">★</span>
                        <span className="text-sm font-medium">{result.place.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {result.place.price_level && (
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                      {getPriceLevel(result.place.price_level)}
                    </span>
                  )}
                  {result.place.opening_hours?.isOpen?.() !== undefined && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        result.place.opening_hours.isOpen()
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {result.place.opening_hours.isOpen() ? 'Open now' : 'Closed'}
                    </span>
                  )}
                  {result.distanceToCenter && (
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                      {result.distanceToCenter.toFixed(1)} km from center
                    </span>
                  )}
                </div>

                {/* Reasoning */}
                {result.reasoning && (
                  <p className="text-sm text-gray-600 italic line-clamp-3 mb-2">
                    {result.reasoning}
                  </p>
                )}

                {/* Additional info badges */}
                {(result.imageAnalysis || (result.redditData && result.redditData.totalMentions > 0)) && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {result.imageAnalysis && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                        {result.imageAnalysis}
                      </span>
                    )}
                    {result.redditData && result.redditData.totalMentions > 0 && result.redditData.posts.length > 0 && (
                      <a
                        href={result.redditData.posts[0].permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {result.redditData.totalMentions} Reddit mention{result.redditData.totalMentions !== 1 ? 's' : ''} →
                      </a>
                    )}
                  </div>
                )}

                {/* Matched keywords */}
                {result.matchedKeywords.length > 0 && !result.reasoning && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.matchedKeywords.map((keyword, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 bg-espresso/10 text-espresso rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
