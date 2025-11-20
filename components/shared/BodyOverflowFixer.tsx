'use client';

import { useEffect } from 'react';

export default function BodyOverflowFixer() {
  useEffect(() => {
    const previousHtmlOverflowY = document.documentElement.style.overflowY;
    const previousBodyOverflowY = document.body.style.overflowY;

    // Use setProperty with important flag to override any CSS rules
    document.documentElement.style.setProperty('overflow-y', 'visible', 'important');
    document.body.style.setProperty('overflow-y', 'visible', 'important');

    return () => {
      if (previousHtmlOverflowY) {
        document.documentElement.style.overflowY = previousHtmlOverflowY;
      } else {
        document.documentElement.style.removeProperty('overflow-y');
      }
      if (previousBodyOverflowY) {
        document.body.style.overflowY = previousBodyOverflowY;
      } else {
        document.body.style.removeProperty('overflow-y');
      }
    };
  }, []);

  return null;
}

