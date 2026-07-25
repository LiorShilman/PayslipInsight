/** §8.2 — דגל על שדה בביטחון נמוך. לעולם לא רק צבע (§8.1) — תמיד גם סימן/טקסט. */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) return null;

  const isLow = confidence < 0.5;
  return (
    <span
      className={
        isLow
          ? 'inline-flex items-center gap-1 rounded-sm bg-accent-alert-soft px-1.5 py-0.5 text-xs font-medium text-accent-alert'
          : 'inline-flex items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent'
      }
      title={`רמת ביטחון בחילוץ: ${Math.round(confidence * 100)}%`}
    >
      {isLow ? '⚠ לא ודאי' : '~ לבדיקה'}
    </span>
  );
}
