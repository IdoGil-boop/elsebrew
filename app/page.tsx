'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import SearchPanel from '@/components/home/SearchPanel';
// Trigger rebuild with env vars
import EmailSignup from '@/components/home/EmailSignup';
// import PricingStrip from '@/components/home/PricingStrip';
import TypingTitle from '@/components/home/TypingTitle';
import { analytics } from '@/lib/analytics';

export default function Home() {
  useEffect(() => {
    analytics.viewHome();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center sm:text-center mb-8 sm:mb-12"
      >
        <TypingTitle />
      </motion.div>

      {/* Search Panel */}
      <div className="mb-12">
        <SearchPanel />
      </div>

      {/* Pricing Strip */}
      {/* <div className="mb-8">
        <PricingStrip />
      </div> */}

      {/* Email Signup */}
      <div className="mb-12">
        <EmailSignup />
      </div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="max-w-3xl mx-auto"
      >
        <h2 className="text-2xl font-serif font-semibold text-center mb-8">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-semibold mb-2">Pick your favorite</h3>
            <p className="text-sm text-gray-600">
              Tell me about a café you love and where you&apos;re headed
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">🤖</div>
            <h3 className="font-semibold mb-2">AI finds matches</h3>
            <p className="text-sm text-gray-600">
              AI searches for spots with a similar vibe using google, reddit, and other sources
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">☕</div>
            <h3 className="font-semibold mb-2">Discover & save</h3>
            <p className="text-sm text-gray-600">
              Browse results on a map and save your favorites to Google Maps
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
