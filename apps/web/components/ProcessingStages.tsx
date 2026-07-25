'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type Stage = 'reading' | 'extracting' | 'validating';

const STAGE_ORDER: Stage[] = ['reading', 'extracting', 'validating'];
const STAGE_LABELS: Record<Stage, string> = {
  reading: 'קורא את המסמך',
  extracting: 'מחלץ נתונים',
  validating: 'מאמת',
};

type Props = { stage: Stage; labels: string[] };

/**
 * §8.4: מצבים גלויים בזמן עיבוד. ה-stage מגיע מאירועי SSE אמיתיים מהשרת
 * (לא טיימר מדומה), ו-labels הן שורות שזוהו בפועל תוך כדי הסטרים של המודל —
 * ראה extractNewLabels ב-packages/extract/src/extract.ts.
 */
export function ProcessingStages({ stage, labels }: Props) {
  const reduceMotion = useReducedMotion();
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const recentLabels = labels.slice(-10);

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-6 py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink/15 border-t-accent" />
      <ol className="flex gap-3 text-sm">
        {STAGE_ORDER.map((s, i) => (
          <li
            key={s}
            className={i <= stageIndex ? 'font-semibold text-ink' : 'text-ink-muted'}
            aria-current={i === stageIndex ? 'step' : undefined}
          >
            {STAGE_LABELS[s]}
            {i < STAGE_ORDER.length - 1 && <span className="ms-3 text-ink-muted">←</span>}
          </li>
        ))}
      </ol>

      {recentLabels.length > 0 && (
        <ul className="flex max-w-md flex-wrap justify-center gap-2" aria-label="שורות שזוהו עד כה">
          <AnimatePresence initial={false}>
            {recentLabels.map((label, i) => (
              <motion.li
                key={`${labels.length - recentLabels.length + i}-${label}`}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-full border border-ink/15 bg-surface px-3 py-1 text-xs text-ink-muted"
              >
                {label}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
