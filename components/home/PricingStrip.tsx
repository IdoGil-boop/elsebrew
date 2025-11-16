'use client';

import { motion } from 'framer-motion';
import { analytics } from '@/lib/analytics';

export default function PricingStrip() {
  const buyMeCoffeeUrl = process.env.NEXT_PUBLIC_BUYMEACOFFEE_URL || 'https://www.buymeacoffee.com/yourname';

  const handleBuyMeCoffee = () => {
    analytics.buyMeCoffeeClick();
    window.open(buyMeCoffeeUrl, '_blank');
  };

  const handleProClick = () => {
    analytics.ctaUpgradeClick();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="card p-6 max-w-4xl mx-auto"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Free tier */}
        <div className="flex-1 text-center md:text-center">
          <div className="text-sm font-semibold text-espresso mb-1">Free for early explorers</div>
          <div className="text-xs text-gray-600">Unlimited searches, real results</div>
        </div>

        {/* Divider */}
        <div className="hidden md:block h-12 w-px bg-gray-200" />

        {/* Buy Me A Coffee */}
        <div className="flex-1 text-center md:text-center">
          <button
            onClick={handleBuyMeCoffee}
            className="btn-secondary inline-flex items-center space-x-2"
          >
            <span>☕</span>
            <span>Buy Me A Coffee</span>
          </button>
        </div>

        {/* Divider */}
        <div className="hidden md:block h-12 w-px bg-gray-200" />

        {/* Pro tier (coming soon) */}
        <div className="flex-1 text-center">
          <div className="text-sm font-semibold text-gray-400 mb-1">Pro • Coming Soon</div>
          <div className="text-xs text-gray-500">Offline maps, advanced filters, saved trips</div>
        </div>

      </div>
    </motion.div>
  );
}
