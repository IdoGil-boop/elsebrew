'use client';

import { useState } from 'react';
import { X, Check, Zap, Lock } from 'lucide-react';
import { storage } from '@/lib/storage';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  source?: 'vibe-selector' | 'rate-limit' | 'manual';
}

export default function PricingModal({ isOpen, onClose, source = 'manual' }: PricingModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const userProfile = storage.getUserProfile();

      if (!userProfile || !userProfile.token) {
        setError('Please sign in to upgrade to Premium');
        setIsLoading(false);
        return;
      }

      // Call PayPal checkout API
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userProfile.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('[PricingModal] Checkout error details:', data);
        throw new Error(data.details || data.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to PayPal checkout
      window.location.href = url;
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      setError(err.message || 'Failed to start checkout');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal Panel */}
        <div className="relative inline-block w-full max-w-4xl p-8 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-charcoal">Upgrade to Premium</h2>
              <p className="text-gray-600 mt-2">
                Unlock advanced vibe-based search and unlimited searches
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Free Tier */}
            <div className="border-2 border-gray-200 rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-charcoal">Free</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-charcoal">$0</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Basic text search</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Find cafes by location</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">10 searches per 12 hours</span>
                </li>
                <li className="flex items-start gap-2 opacity-40">
                  <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-500">No vibe-based filtering</span>
                </li>
                <li className="flex items-start gap-2 opacity-40">
                  <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-500">Limited atmosphere details</span>
                </li>
              </ul>

              <div className="text-center text-sm text-gray-500 font-medium">
                Current Plan
              </div>
            </div>

            {/* Premium Tier */}
            <div className="border-2 border-espresso rounded-lg p-6 relative bg-gradient-to-br from-amber-50 to-orange-50">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-espresso text-white px-4 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </div>

              <div className="mb-4">
                <h3 className="text-xl font-bold text-charcoal flex items-center gap-2">
                  Premium
                  <Zap className="w-5 h-5 text-amber-500" />
                </h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-espresso">$5</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-900 font-medium">
                    40+ vibe-based filters
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-900 font-medium">
                    Unlimited searches
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-900 font-medium">
                    Full atmosphere details
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-900 font-medium">
                    Recommended vibes based on your cafes
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-900 font-medium">
                    Advanced amenity filtering (outdoor seating, dog-friendly, etc.)
                  </span>
                </li>
              </ul>

              <button
                onClick={handleUpgrade}
                disabled={isLoading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Upgrade to Premium
                  </>
                )}
              </button>

              {error && (
                <div className="mt-3 text-sm text-red-600 text-center">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Feature Comparison */}
          <div className="border-t pt-6">
            <h4 className="font-semibold text-charcoal mb-4">What you get with Premium</h4>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">☕</span>
                </div>
                <div>
                  <h5 className="font-semibold text-sm text-charcoal">Coffee Specialty Vibes</h5>
                  <p className="text-xs text-gray-600 mt-1">
                    Filter by roastery, single origin, pour over, cold brew, and more
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">✨</span>
                </div>
                <div>
                  <h5 className="font-semibold text-sm text-charcoal">Ambiance & Amenities</h5>
                  <p className="text-xs text-gray-600 mt-1">
                    Find places with outdoor seating, live music, laptop-friendly spaces, and more
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🚀</span>
                </div>
                <div>
                  <h5 className="font-semibold text-sm text-charcoal">No Limits</h5>
                  <p className="text-xs text-gray-600 mt-1">
                    Search as much as you want, whenever you want
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-500">
            Cancel anytime. Billing through PayPal. Secure payment processing.
          </div>
        </div>
      </div>
    </div>
  );
}
