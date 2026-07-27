'use client';

import { formatILS } from '@payslip-insight/core';
import type { PersonalInfoReportDeposit } from '@payslip-insight/schema';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { Card, CardTitle } from '@/components/ui/card';
import { useProvenance } from '@/lib/provenance-context';

type Props = { deposits: PersonalInfoReportDeposit[] };

const SEGMENT_COLORS = {
  employee: 'var(--color-amber)',
  employer: 'var(--color-info)',
  severance: 'var(--color-accent)',
} as const;

/** לגודל התצוגה בלבד — לא ערך המוצג כ"סה"כ" (זה תמיד d.total הגולמי, או '—'). */
function partsSum(d: PersonalInfoReportDeposit): number {
  return (d.employeeContribution ?? 0) + (d.employerContribution ?? 0) + (d.severanceContribution ?? 0);
}

/**
 * סעיף ה' — כרטיס לכל הפקדה חודשית עם בר מוערם (חלק עובד/מעסיק/פיצויים
 * שמרכיבים את הסה"כ), במקום טבלה שטוחה ברוחב 8 עמודות. אורך הבר יחסי
 * להפקדה הגדולה ביותר בתקופה, כדי שאפשר יהיה להשוות בין החודשים במבט
 * אחד. טבלת הנתונים המלאה נשארת כגיבוי נגישות/דיוק ב-<details>, אותו
 * דפוס בדיוק כמו RetirementSavingsChart/Form106ItemsTable.
 */
export function PersonalInfoReportDepositsTable({ deposits }: Props) {
  const { setHighlighted } = useProvenance();
  if (deposits.length === 0) return null;

  const maxTotal = Math.max(...deposits.map((d) => d.total ?? partsSum(d)), 1);

  return (
    <Card>
      <CardTitle>פירוט הפקדות</CardTitle>

      <ul className="mt-4 divide-y divide-ink/10">
        {deposits.map((d, index) => {
          const rowTotal = d.total ?? partsSum(d);
          const rowWidthPct = Math.max(2, (rowTotal / maxTotal) * 100);
          const segments = (
            [
              ['employee', d.employeeContribution],
              ['employer', d.employerContribution],
              ['severance', d.severanceContribution],
            ] as const
          ).filter((s): s is [keyof typeof SEGMENT_COLORS, number] => s[1] !== null && s[1] > 0);

          return (
            <li key={index}>
              <button
                type="button"
                disabled={!d.prov}
                onClick={() => d.prov && setHighlighted(d.prov)}
                className="w-full rounded-sm py-3 text-start disabled:cursor-default enabled:hover:bg-accent-soft enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-accent"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{d.employerName ?? '—'}</span>
                  <span dir="ltr" className="shrink-0 text-xs text-ink-muted">
                    {[d.salaryMonth, d.depositDate].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>

                <div className="mt-2 h-2.5 rounded-full bg-ink/5">
                  <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${rowWidthPct}%` }}>
                    {segments.map(([key, value]) => (
                      <div
                        key={key}
                        className="h-full first:rounded-s-full last:rounded-e-full"
                        style={{ width: `${(value / rowTotal) * 100}%`, backgroundColor: SEGMENT_COLORS[key] }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs text-ink-muted">
                    {d.salaryAmount !== null && `שכר: ${formatILS(d.salaryAmount)}`}
                  </span>
                  <span className="flex items-center gap-2">
                    <span dir="ltr" className="text-sm font-semibold tabular-nums text-ink">
                      {d.total !== null ? formatILS(d.total) : '—'}
                    </span>
                    {d.prov && <ConfidenceBadge confidence={d.prov.confidence} />}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.employee }} aria-hidden />
          חלק עובד
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.employer }} aria-hidden />
          חלק מעסיק
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.severance }} aria-hidden />
          פיצויים
        </span>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-ink-muted">טבלת נתונים (נגישות)</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <caption className="sr-only-table">פירוט הפקדות חודשיות לקרן</caption>
            <thead>
              <tr className="border-b border-ink/15">
                <th className="px-2 py-1 text-start font-semibold">מעסיק</th>
                <th className="px-2 py-1 text-start font-semibold">חודש שכר</th>
                <th className="px-2 py-1 text-start font-semibold">תאריך הפקדה</th>
                <th className="px-2 py-1 text-start font-semibold">שכר</th>
                <th className="px-2 py-1 text-start font-semibold">חלק עובד</th>
                <th className="px-2 py-1 text-start font-semibold">חלק מעסיק</th>
                <th className="px-2 py-1 text-start font-semibold">פיצויים</th>
                <th className="px-2 py-1 text-start font-semibold">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d, index) => (
                <tr key={index} className="border-b border-ink/5">
                  <td className="px-2 py-1">{d.employerName ?? '—'}</td>
                  <td className="px-2 py-1">{d.salaryMonth ?? '—'}</td>
                  <td className="px-2 py-1">{d.depositDate ?? '—'}</td>
                  <td className="px-2 py-1" dir="ltr">
                    {d.salaryAmount !== null ? formatILS(d.salaryAmount) : '—'}
                  </td>
                  <td className="px-2 py-1" dir="ltr">
                    {d.employeeContribution !== null ? formatILS(d.employeeContribution) : '—'}
                  </td>
                  <td className="px-2 py-1" dir="ltr">
                    {d.employerContribution !== null ? formatILS(d.employerContribution) : '—'}
                  </td>
                  <td className="px-2 py-1" dir="ltr">
                    {d.severanceContribution !== null ? formatILS(d.severanceContribution) : '—'}
                  </td>
                  <td className="px-2 py-1" dir="ltr">
                    {d.total !== null ? formatILS(d.total) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
