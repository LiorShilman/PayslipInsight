import { formatILS } from '@payslip-insight/core';
import type { DerivedMetrics } from '@payslip-insight/core';
import { Card, CardTitle } from '@/components/ui/card';

type Props = {
  derived: DerivedMetrics;
  grossPay: number;
  netPay: number;
};

function formatPercent(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

const RATE_LABELS: { key: keyof DerivedMetrics['contributionRates']; label: string }[] = [
  { key: 'pensionEmployee', label: 'תגמולי עובד' },
  { key: 'pensionEmployer', label: 'תגמולי מעסיק' },
  { key: 'severance', label: 'פיצויים' },
  { key: 'studyFundEmployee', label: 'קרן השתלמות (עובד)' },
  { key: 'studyFundEmployer', label: 'קרן השתלמות (מעסיק)' },
];

/** SPEC.md §8.2 — עלות מעביד מול נטו, עם פירוק ההפרשות. */
export function EmployerCostCard({ derived, grossPay, netPay }: Props) {
  const rows = [
    { label: 'עלות מעביד', value: derived.employerTotalCost, emphasis: true },
    { label: 'ברוטו', value: grossPay, emphasis: false },
    { label: 'נטו לתשלום', value: netPay, emphasis: false },
  ];
  const maxValue = Math.max(...rows.map((r) => r.value));

  return (
    <Card>
      <CardTitle>מה אתה עולה למעסיק</CardTitle>
      <p className="mt-1 text-sm text-ink-muted">
        לעומת מה שנכנס בפועל לחשבון שלך — כולל כל מה שהמעסיק מפריש מעליך.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className={row.emphasis ? 'font-semibold text-ink' : 'text-ink-muted'}>{row.label}</span>
              <span dir="ltr" className={row.emphasis ? 'font-semibold text-accent' : 'text-ink'}>
                {formatILS(row.value)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-ink/5">
              <div
                className={row.emphasis ? 'h-full rounded-full bg-accent' : 'h-full rounded-full bg-ink/30'}
                style={{ width: `${(row.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-ink/10 pt-4 text-sm">
        {RATE_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-baseline justify-between">
            <dt className="text-ink-muted">{label}</dt>
            <dd dir="ltr" className="font-medium text-ink">
              {formatPercent(derived.contributionRates[key])}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
