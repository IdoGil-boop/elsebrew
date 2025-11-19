'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number; // milliseconds
}

const toastStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: '✅',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: '❌',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'ℹ️',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: '😊',
  },
};

export default function Toast({
  message,
  type = 'info',
  isVisible,
  onClose,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const styles = toastStyles[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-4 right-4 z-50 max-w-md"
        >
          <div
            className={`${styles.bg} ${styles.border} border rounded-xl shadow-lg p-4 flex items-start gap-3`}
          >
            <div className="text-xl flex-shrink-0">{styles.icon}</div>
            <div className="flex-1">
              <p className="text-sm text-gray-800">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
