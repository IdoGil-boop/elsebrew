'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { analytics } from '@/lib/analytics';

export default function EmailSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) return;

    // Track submission
    analytics.emailSubscribeSubmit();

    // In a real app, this would POST to the Mailchimp form action
    // For now, just show success
    setStatus('success');
    setEmail('');

    setTimeout(() => {
      setStatus('idle');
    }, 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="card p-6 max-w-md mx-auto text-center"
    >
      <h3 className="text-lg font-semibold mb-2">Stay in the loop</h3>
      <p className="text-sm text-gray-600 mb-4">
        Get notified when I launch new features
      </p>

      {status === 'success' ? (
        <div className="text-green-600 font-medium">✓ Thanks for subscribing!</div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="input-field flex-1"
            required
          />
          <button type="submit" className="btn-primary">
            Subscribe
          </button>
        </form>
      )}
    </motion.div>
  );
}
