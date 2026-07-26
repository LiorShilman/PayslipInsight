import { formatILS } from '@payslip-insight/core';
import type { DerivedMetrics, YtdMetric } from '@payslip-insight/core';
import { Card, CardTitle } from '@/components/ui/card';

const METRIC_LABELS: Record<YtdMetric, string> = {
  grossPay: 'ברוטו',
  incomeTax: 'מס הכנסה',
  nationalInsurance: 'ביטוח לאומי',
  healthTax: 'מס בריאות',
  pensionEmployee: 'תגמולי עובד',
  pensionEmployer: 'תגמולי מעסיק',
  severance: 'פיצויים',
  studyFundEmployee: 'קרן השתלמות (עובד)',
  studyFundEmployer: 'קרן השתלמות (מעסיק)',
};

type Props = { yearToDateComparison: DerivedMetrics['yearToDateComparison']; monthNumber: number };

/**
 * "החודש הזה" מול הקצב הממוצע מתחילת השנה — נתוני yearToDate כבר נחלצים
 * בכל תלוש (packages/schema) אבל לא הוצגו עד היום. ratio מעל/מתחת לממוצע
 * הוא חישוב פשוט, לא ניחוש — מוצג רק למדדים שיש להם ערך yearToDate בפועל.
 */
export function YtdComparisonCard({ yearToDateComparison, monthNumber }: Props) {
  if (yearToDateComparison.length === 0) return null;

  return (
    <Card>
      <CardTitle>החודש הזה מול הקצב השנתי</CardTitle>
      <p className="mt-1 text-sm text-ink-muted">
        השוואה בין מה שקרה החודש לממוצע החודשי שלך מתחילת השנה ({monthNumber} חודשים).
      </p>

      <div className="mt-6 flex flex-col gap-5">
        {yearToDateComparison.map((row) => {
          const delta = row.ytdAverage === 0 ? null : (row.thisMonth - row.ytdAverage) / row.ytdAverage;
          const maxValue = Math.max(row.thisMonth, row.ytdAverage, 1);

          return (
            <div key={row.metric}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-ink">{METRIC_LABELS[row.metric]}</span>
                {delta !== null && Math.abs(delta) >= 0.01 && (
                  <span dir="ltr" className={delta >= 0 ? 'text-accent' : 'text-accent-alert'}>
                    {delta >= 0 ? '+' : ''}
                    {Math.round(delta * 100)}% מהממוצע
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs text-ink-muted">החודש</span>
                  <span className="h-2 flex-1 rounded-full bg-ink/5">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${(row.thisMonth / maxValue) * 100}%` }}
                    />
                  </span>
                  <span dir="ltr" className="w-24 shrink-0 text-end text-xs font-medium tabular-nums text-ink">
                    {formatILS(row.thisMonth)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs text-ink-muted">ממוצע</span>
                  <span className="h-2 flex-1 rounded-full bg-ink/5">
                    <span className="block h-full rounded-full bg-ink/25" style={{ width: `${(row.ytdAverage / maxValue) * 100}%` }} />
                  </span>
                  <span dir="ltr" className="w-24 shrink-0 text-end text-xs tabular-nums text-ink-muted">
                    {formatILS(row.ytdAverage)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <details className="mt-5">
        <summary className="cursor-pointer text-sm text-ink-muted">טבלת נתונים (נגישות)</summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only-table">השוואת החודש הנוכחי לממוצע השנתי</caption>
          <thead>
            <tr className="border-b border-ink/15">
              <th className="py-1 text-start font-semibold">מדד</th>
              <th className="py-1 text-start font-semibold">החודש</th>
              <th className="py-1 text-start font-semibold">ממוצע מתחילת שנה</th>
            </tr>
          </thead>
          <tbody>
            {yearToDateComparison.map((row) => (
              <tr key={row.metric} className="border-b border-ink/5">
                <td className="py-1">{METRIC_LABELS[row.metric]}</td>
                <td className="py-1" dir="ltr">
                  {formatILS(row.thisMonth)}
                </td>
                <td className="py-1" dir="ltr">
                  {formatILS(row.ytdAverage)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
