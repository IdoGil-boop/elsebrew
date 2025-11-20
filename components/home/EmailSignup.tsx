'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { analytics } from '@/lib/analytics';

export default function EmailSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      // Track submission
      analytics.emailSubscribeSubmit();

      const response = await fetch('/api/email/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }

      setStatus('success');
      setEmail('');

      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
      
      setTimeout(() => {
        setStatus('idle');
        setErrorMessage('');
      }, 5000);
    }
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
      ) : status === 'error' ? (
        <div className="text-red-600 font-medium">{errorMessage}</div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="input-field flex-1"
            required
            disabled={status === 'loading'}
          />
          <button 
            type="submit" 
            className="btn-primary"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>
      )}
    </motion.div>
  );
}
