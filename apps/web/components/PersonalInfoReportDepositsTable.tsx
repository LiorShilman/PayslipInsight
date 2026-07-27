'use client';

import { formatILS } from '@payslip-insight/core';
import type { PersonalInfoReportDeposit } from '@payslip-insight/schema';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { Card, CardTitle } from '@/components/ui/card';
import { useProvenance } from '@/lib/provenance-context';

type Props = { deposits: PersonalInfoReportDeposit[] };

/**
 * טבלת סעיף ה' — רב-עמודות אמיתית (מעסיק/תאריך/חודש שכר/שכר/חלק
 * עובד/חלק מעסיק/פיצויים/סה"כ), בניגוד ל-Form106ItemsTable שהיא רשימת
 * label+amount שטוחה עם בר פרופורציונלי. טבלת HTML נגישה עם
 * provenance-click לכל שורה (מוחלת על כל ה-tr, השדה עצמו לא מפוצל
 * ל-provenance נפרד לכל תא).
 */
export function PersonalInfoReportDepositsTable({ deposits }: Props) {
  const { setHighlighted } = useProvenance();
  if (deposits.length === 0) return null;

  return (
    <Card>
      <CardTitle>פירוט הפקדות</CardTitle>
      <div className="mt-4 overflow-x-auto">
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
              <tr
                key={index}
                className={
                  d.prov
                    ? 'cursor-pointer border-b border-ink/5 hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'
                    : 'border-b border-ink/5'
                }
                tabIndex={d.prov ? 0 : undefined}
                role={d.prov ? 'button' : undefined}
                onClick={() => d.prov && setHighlighted(d.prov)}
                onKeyDown={(e) => {
                  if (d.prov && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setHighlighted(d.prov);
                  }
                }}
              >
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
                <td className="px-2 py-1">
                  <span className="inline-flex items-center gap-2">
                    <span dir="ltr" className="font-medium tabular-nums">
                      {d.total !== null ? formatILS(d.total) : '—'}
                    </span>
                    {d.prov && <ConfidenceBadge confidence={d.prov.confidence} />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
