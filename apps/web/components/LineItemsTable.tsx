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

const SECTION_ORDER: LineItemSection[] = ['payment', 'mandatory_deduction', 'voluntary_deduction', 'employer_contribution'];

type Props = { lineItems: LineItem[] };

/** SPEC.md §8.2 — טבלה מלאה, מסוננת לפי section, עם provenance click לכל שורה. */
export function LineItemsTable({ lineItems }: Props) {
  const { setHighlighted } = useProvenance();

  return (
    <Card>
      <CardTitle>כל השורות</CardTitle>
      <div className="mt-4 flex flex-col gap-6">
        {SECTION_ORDER.map((section) => {
          const rows = lineItems.filter((li) => li.section === section);
          if (rows.length === 0) return null;

          return (
            <div key={section}>
              <h4 className="mb-2 text-sm font-semibold text-ink-muted">{SECTION_LABELS[section]}</h4>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink/15">
                    <th scope="col" className="py-2 text-start font-semibold text-ink">
                      תיאור
                    </th>
                    <th scope="col" className="py-2 text-start font-semibold text-ink">
                      סכום
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, index) => (
                    <tr key={`${item.label}-${index}`} className="border-b border-ink/5">
                      <td className="py-2 text-ink">
                        {item.label}
                        {item.taxable === false && <span className="ms-2 text-xs text-ink-muted">(פטור ממס)</span>}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={!item.prov}
                          onClick={() => item.prov && setHighlighted(item.prov)}
                          className="inline-flex items-center gap-2 rounded-sm px-1 -ms-1 disabled:cursor-default enabled:hover:bg-accent-soft enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-accent"
                          aria-label={`${item.label}: ${formatILS(item.amount)}${item.prov ? ' — הצג במסמך המקורי' : ''}`}
                        >
                          <span dir="ltr" className="font-medium tabular-nums text-ink">
                            {formatILS(item.amount)}
                          </span>
                          {item.prov && <ConfidenceBadge confidence={item.prov.confidence} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
