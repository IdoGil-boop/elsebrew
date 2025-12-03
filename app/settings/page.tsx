'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Crown, Zap, Calendar, CreditCard, LogOut, ArrowLeft } from 'lucide-react';
import { storage } from '@/lib/storage';
import { UserProfile, SubscriptionInfo } from '@/types';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check for success from PayPal redirect
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    
    if (success) {
      setShowSuccess(true);
      // Clear the URL parameter
      window.history.replaceState({}, '', '/settings');
      // Refresh subscription data
      if (userProfile) {
        fetchSubscription(userProfile);
      }
    }
    
    if (canceled) {
      // Clear the URL parameter
      window.history.replaceState({}, '', '/settings');
    }

    // Load user profile
    const profile = storage.getUserProfile();
    setUserProfile(profile);

    if (!profile) {
      router.push('/');
      return;
    }

    // Fetch subscription info
    fetchSubscription(profile);
  }, [searchParams, router]);

  const fetchSubscription = async (profile: UserProfile) => {
    try {
      // In a real app, you'd fetch this from an API endpoint
      // For now, we'll use the subscription from the profile if available
      setSubscription(profile.subscription || {
        tier: 'free',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!userProfile?.token) return;

    setIsPortalLoading(true);

    try {
      const response = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userProfile.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error opening customer portal:', error);
      alert('Failed to open billing portal. Please try again.');
      setIsPortalLoading(false);
    }
  };

  const handleSignOut = () => {
    storage.setUserProfile(null);
    router.push('/?toast=logout');
  };

  const isPremium = subscription?.tier === 'premium';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-espresso border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-espresso transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <h1 className="text-3xl font-bold text-charcoal">Account Settings</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success Message */}
        {showSuccess && (
          <div className="card mb-6 overflow-hidden border-0 shadow-lg relative">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50" />

            {/* Content */}
            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-lg">
                    <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                </div>

                {/* Text Content */}
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl sm:text-3xl font-bold text-charcoal mb-2">
                    Welcome to Premium! ☕
                  </h2>
                  <p className="text-base sm:text-lg text-gray-700 mb-4">
                    Your subscription is now active. Get ready to discover your perfect café matches!
                  </p>

                  {/* Feature Pills */}
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <div className="px-3 py-1.5 bg-white/80 backdrop-blur rounded-full text-xs sm:text-sm font-medium text-charcoal border border-amber-200/50 shadow-sm">
                      ✨ Unlimited Searches
                    </div>
                    <div className="px-3 py-1.5 bg-white/80 backdrop-blur rounded-full text-xs sm:text-sm font-medium text-charcoal border border-amber-200/50 shadow-sm">
                      🎯 40+ Vibe Filters
                    </div>
                    <div className="px-3 py-1.5 bg-white/80 backdrop-blur rounded-full text-xs sm:text-sm font-medium text-charcoal border border-amber-200/50 shadow-sm">
                      💫 AI-Powered Matching
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setShowSuccess(false)}
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-white/80 backdrop-blur hover:bg-white flex items-center justify-center text-gray-600 hover:text-charcoal transition-all shadow-sm hover:shadow"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Call to Action */}
              <div className="mt-6 pt-6 border-t border-amber-200/50">
                <button
                  onClick={() => router.push('/')}
                  className="btn-primary w-full sm:w-auto"
                >
                  Start Searching →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Profile Card */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            {userProfile?.picture && (
              <img
                src={userProfile.picture}
                alt={userProfile.name}
                className="w-16 h-16 rounded-full"
              />
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-charcoal">{userProfile?.name}</h2>
              <p className="text-gray-600">{userProfile?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="btn-secondary flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="card mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-charcoal mb-2">Subscription</h3>
              <div className="flex items-center gap-2">
                {isPremium ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full text-sm font-semibold">
                      <Crown className="w-4 h-4" />
                      Premium
                    </div>
                    {subscription.currentPeriodEnd && (
                      <span className="text-sm text-gray-600">
                        Active until {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">
                    Free Plan
                  </div>
                )}
              </div>
            </div>

            {isPremium && subscription.paypalSubscriptionId && (
              <button
                onClick={handleManageBilling}
                disabled={isPortalLoading}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50"
              >
                {isPortalLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Manage Billing
                  </>
                )}
              </button>
            )}
          </div>

          {/* Plan Features */}
          <div className="border-t pt-6">
            <h4 className="font-semibold text-charcoal mb-4">
              {isPremium ? 'Your Premium Benefits' : 'Free Plan Features'}
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              {isPremium ? (
                <>
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-sm text-charcoal">Unlimited Searches</div>
                      <div className="text-xs text-gray-600 mt-1">Search as much as you want</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">☕</span>
                    <div>
                      <div className="font-medium text-sm text-charcoal">40+ Vibe Filters</div>
                      <div className="text-xs text-gray-600 mt-1">Advanced atmosphere filtering</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">✨</span>
                    <div>
                      <div className="font-medium text-sm text-charcoal">Recommended Vibes</div>
                      <div className="text-xs text-gray-600 mt-1">Personalized suggestions</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">🎯</span>
                    <div>
                      <div className="font-medium text-sm text-charcoal">Full Amenity Details</div>
                      <div className="text-xs text-gray-600 mt-1">Complete cafe information</div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">🔍</span>
                    <div>
                      <div className="font-medium text-sm text-charcoal">Basic Text Search</div>
                      <div className="text-xs text-gray-600 mt-1">Find cafes by location</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-sm text-charcoal">10 Searches / 12 Hours</div>
                      <div className="text-xs text-gray-600 mt-1">Rate limited searches</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {!isPremium && (
              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={() => router.push('/?upgrade=true')}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Crown className="w-5 h-5" />
                  Upgrade to Premium - $5/month
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="card bg-gray-50">
          <h3 className="font-semibold text-charcoal mb-2">Need Help?</h3>
          <p className="text-sm text-gray-600 mb-4">
            Have questions about your subscription or need assistance? We&apos;re here to help!
          </p>
          <a
            href="mailto:support@elsebrew.com"
            className="text-sm text-espresso hover:underline font-medium"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="card p-8">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
