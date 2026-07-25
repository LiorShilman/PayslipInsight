import { formatILS } from '@payslip-insight/core';
import type { DerivedMetrics } from '@payslip-insight/core';
import { Card, CardTitle } from '@/components/ui/card';

type Segment = { key: string; label: string; value: number; color: string };

type Props = { trueNet: DerivedMetrics['trueNet'] };

/**
 * "הנטו האמיתי": מה שנכנס לבנק הוא רק חלק מהערך שנוצר החודש — חיסכון
 * ארוך-טווח (עובד + מעסיק) הוא כסף אמיתי, פשוט לא נזיל היום. מוצג רק
 * כשיש בכלל חיסכון כזה בתלוש — אחרת זה זהה לנטו לבנק ולא מוסיף מידע.
 */
export function TrueNetCard({ trueNet }: Props) {
  if (trueNet.employeeSavings === 0 && trueNet.employerSavings === 0) return null;

  const segments: Segment[] = [
    { key: 'bank', label: 'נטו לבנק', value: trueNet.bankNet, color: 'var(--color-accent)' },
    { key: 'employee', label: 'חיסכון שלך (עובד)', value: trueNet.employeeSavings, color: 'var(--color-amber)' },
    { key: 'employer', label: 'הפקדות מעסיק', value: trueNet.employerSavings, color: 'var(--color-info)' },
  ].filter((s) => s.value > 0);

  return (
    <Card>
      <CardTitle>הערך האמיתי של החודש</CardTitle>
      <p className="mt-1 text-sm text-ink-muted">
        מה שנכנס לבנק הוא רק חלק מהערך שנוצר החודש — חיסכון לטווח ארוך הוא כסף שלך, פשוט לא נזיל היום.
      </p>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-muted">סך הערך שנוצר</span>
          <span dir="ltr" className="font-display text-2xl font-semibold text-ink">
            {formatILS(trueNet.total)}
          </span>
        </div>
        <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-ink/5" role="img" aria-label="פילוח הערך האמיתי">
          {segments.map((s) => (
            <div
              key={s.key}
              style={{ width: `${(s.value / trueNet.total) * 100}%`, backgroundColor: s.color }}
              title={`${s.label}: ${formatILS(s.value)}`}
            />
          ))}
        </div>
      </div>

      <ul className="mt-5 flex flex-col gap-2 text-sm">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              {s.label}
            </span>
            <span className="flex items-baseline gap-2">
              <span dir="ltr" className="font-medium text-ink">
                {formatILS(s.value)}
              </span>
              <span className="text-xs text-ink-muted">{Math.round((s.value / trueNet.total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
