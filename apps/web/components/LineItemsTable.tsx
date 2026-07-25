'use client';

import { formatILS } from '@payslip-insight/core';
import type { LineItem, LineItemSection } from '@payslip-insight/schema';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { Card, CardTitle } from '@/components/ui/card';
import { useProvenance } from '@/lib/provenance-context';

const SECTION_LABELS: Record<LineItemSection, string> = {
  payment: 'תשלומים',
  mandatory_deduction: 'ניכויי חובה',
  voluntary_deduction: 'ניכויי רשות',
  employer_contribution: 'הפרשות מעסיק',
};

const SECTION_COLOR: Record<LineItemSection, string> = {
  payment: 'var(--color-ink)',
  mandatory_deduction: 'var(--color-accent-alert)',
  voluntary_deduction: 'var(--color-amber)',
  employer_contribution: 'var(--color-accent)',
};

const SECTION_ORDER: LineItemSection[] = ['payment', 'mandatory_deduction', 'voluntary_deduction', 'employer_contribution'];

type Props = { lineItems: LineItem[] };

/**
 * SPEC.md §8.2 — כל השורות, מסונן לפי section, עם provenance click.
 * במקום <table> נפרד לכל סקציה (שגרם לרוחבי עמודות לא-מיושרים בין
 * סקציות), רשת CSS Grid אחת לכל הרכיב: תווית | בר יחסי לגודל | סכום —
 * אותה תבנית עמודות בכל הסקציות. הבר יחסי לערך הגדול ביותר *באותה סקציה*.
 */
export function LineItemsTable({ lineItems }: Props) {
  const { setHighlighted } = useProvenance();

  const sections = SECTION_ORDER.map((section) => ({
    section,
    rows: lineItems.filter((li) => li.section === section),
  })).filter((s) => s.rows.length > 0);

  return (
    <Card>
      <CardTitle>כל השורות</CardTitle>

      {/* כל סקציה מקבלת "קופסה" צבעונית משלה (רקע+מסגרת בגוון הסקציה) כדי
          שההפרדה תהיה ברורה מעבר לצבע הבר בלבד — עדיין subgrid יחיד כדי
          שהעמודות יישארו מיושרות בין סקציות (ריפוד אחיד לכל הקופסאות). */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(60px,2fr)_auto] gap-y-4">
        {sections.map(({ section, rows }) => {
          const maxAmount = Math.max(...rows.map((r) => r.amount), 1);
          const subtotal = rows.reduce((total, r) => total + r.amount, 0);
          const color = SECTION_COLOR[section];

          return (
            <div
              key={section}
              className="col-span-3 grid grid-cols-subgrid items-center gap-x-3 gap-y-1.5 rounded-lg border p-3"
              style={{
                borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${color} 5%, transparent)`,
              }}
            >
              <h4 className="col-span-3 flex items-baseline justify-between gap-3 text-sm font-semibold">
                <span className="flex items-center gap-2" style={{ color }}>
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                  {SECTION_LABELS[section]}
                </span>
                <span dir="ltr" className="text-xs font-medium text-ink-muted">
                  סה&quot;כ {formatILS(subtotal)}
                </span>
              </h4>
              {rows.map((item, index) => (
                <button
                  key={`${item.label}-${index}`}
                  type="button"
                  disabled={!item.prov}
                  onClick={() => item.prov && setHighlighted(item.prov)}
                  className="col-span-3 grid grid-cols-subgrid items-center gap-x-3 rounded-sm py-1 text-start disabled:cursor-default enabled:hover:bg-accent-soft enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-accent"
                  aria-label={`${item.label}: ${formatILS(item.amount)}${item.prov ? ' — הצג במסמך המקורי' : ''}`}
                >
                  <span className="truncate text-sm text-ink">
                    {item.label}
                    {item.taxable === false && <span className="ms-2 text-xs text-ink-muted">(פטור ממס)</span>}
                  </span>
                  <span className="h-2 rounded-full bg-ink/5">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(item.amount / maxAmount) * 100}%`, backgroundColor: color }}
                    />
                  </span>
                  <span className="flex items-center gap-2">
                    <span dir="ltr" className="text-sm font-medium tabular-nums text-ink">
                      {formatILS(item.amount)}
                    </span>
                    {item.prov && <ConfidenceBadge confidence={item.prov.confidence} />}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-ink-muted">טבלת נתונים (נגישות)</summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only-table">כל שורות התלוש</caption>
          <thead>
            <tr className="border-b border-ink/15">
              <th className="py-1 text-start font-semibold">סקציה</th>
              <th className="py-1 text-start font-semibold">תיאור</th>
              <th className="py-1 text-start font-semibold">סכום</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              <tr key={`${item.label}-${index}`} className="border-b border-ink/5">
                <td className="py-1">{SECTION_LABELS[item.section]}</td>
                <td className="py-1">{item.label}</td>
                <td className="py-1" dir="ltr">
                  {formatILS(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
