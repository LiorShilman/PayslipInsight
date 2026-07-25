'use client';

import { useEffect, useState } from 'react';

const STAGES = ['קורא את המסמך', 'מחלץ נתונים', 'מאמת'] as const;

/** §8.4: מצבים גלויים בזמן עיבוד. השרת מחזיר תשובה אחת (M2 מצומצם, בלי SSE) — מציגים התקדמות משוערת. */
export function ProcessingStages() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink/15 border-t-accent" />
      <ol className="flex gap-3 text-sm">
        {STAGES.map((stage, i) => (
          <li
            key={stage}
            className={i <= stageIndex ? 'font-semibold text-ink' : 'text-ink-muted'}
            aria-current={i === stageIndex ? 'step' : undefined}
          >
            {stage}
            {i < STAGES.length - 1 && <span className="ms-3 text-ink-muted">←</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
