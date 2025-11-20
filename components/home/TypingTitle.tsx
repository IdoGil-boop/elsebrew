'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const CITIES = [
  'Tokyo',
  'Paris',
  'New York',
  'London',
  'Seoul',
  'Melbourne',
  'Barcelona',
  'Copenhagen',
  'Amsterdam',
  'Portland',
  'Stockholm',
  'Vienna',
  'Berlin',
  'Austin',
  'San Francisco',
  'Singapore',
  'Hong Kong',
  'Sydney',
  'Milan',
  'Lisbon',
  'Montreal',
  'Vancouver',
  'Seattle',
  'Chicago',
  'Los Angeles',
  'Miami',
  'Dubai',
  'Istanbul',
  'Rome',
  'Athens',
  'Oslo',
  'Helsinki',
  'Zurich',
  'Munich',
  'Brussels',
  'Dublin',
  'Edinburgh',
  'Toronto',
  'Boston',
  'Washington DC',
  'Buenos Aires',
  'São Paulo',
  'Mexico City',
  'Bangkok',
  'Kyoto',
  'Taipei',
  'Shanghai',
  'Beijing',
  'Hanoi',
  'Wellington',
];

export default function TypingTitle() {
  const [cityIndex, setCityIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentCity = CITIES[cityIndex];
    const typingSpeed = isDeleting ? 50 : 100;
    const pauseAfterComplete = 2000;
    const pauseAfterDelete = 500;

    if (!isDeleting && displayText === currentCity) {
      // Pause after typing complete
      const timeout = setTimeout(() => setIsDeleting(true), pauseAfterComplete);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && displayText === '') {
      // Move to next city
      setIsDeleting(false);
      setCityIndex((prev) => (prev + 1) % CITIES.length);
      const timeout = setTimeout(() => {}, pauseAfterDelete);
      return () => clearTimeout(timeout);
    }

    // Type or delete one character
    const timeout = setTimeout(() => {
      setDisplayText((prev) => {
        if (isDeleting) {
          return currentCity.substring(0, prev.length - 1);
        } else {
          return currentCity.substring(0, prev.length + 1);
        }
      });
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, cityIndex]);

  return (
    <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif font-bold text-espresso mb-4 text-left sm:text-center px-2">
      Find Your Local Café in{' '}
      <span className="inline-block min-w-[200px] sm:min-w-[300px] text-left">
        {displayText}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
          className="inline-block w-1 h-8 sm:h-12 md:h-16 bg-espresso ml-1 align-middle"
        />
      </span>
    </h1>
  );
}
