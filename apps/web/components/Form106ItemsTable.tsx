'use client';

import { formatILS } from '@payslip-insight/core';
import type { Form106LineItem } from '@payslip-insight/schema';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { Card, CardTitle } from '@/components/ui/card';
import { useProvenance } from '@/lib/provenance-context';

type Props = { lineItems: Form106LineItem[] };

/**
 * אותה תבנית ויזואלית בדיוק כמו LineItemsTable (תלוש) — grid עם בר יחסי
 * לגודל + provenance click — אבל בלי חלוקה לסקציות צבעוניות: עמוד 2 של
 * טופס 106 הוא טבלה שטוחה אחת, לא ארבע קטגוריות כמו תלוש.
 */
export function Form106ItemsTable({ lineItems }: Props) {
  const { setHighlighted } = useProvenance();
  if (lineItems.length === 0) return null;

  const maxAmount = Math.max(...lineItems.map((li) => Math.abs(li.amount)), 1);

  return (
    <Card>
      <CardTitle>כל השורות</CardTitle>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(60px,2fr)_auto] items-center gap-x-3 gap-y-1.5">
        {lineItems.map((item, index) => (
          <button
            key={`${item.description}-${index}`}
            type="button"
            disabled={!item.prov}
            onClick={() => item.prov && setHighlighted(item.prov)}
            className="col-span-3 grid grid-cols-subgrid items-center gap-x-3 rounded-sm py-1 text-start disabled:cursor-default enabled:hover:bg-accent-soft enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-accent"
            aria-label={`${item.description}: ${formatILS(item.amount)}${item.prov ? ' — הצג במסמך המקורי' : ''}`}
          >
            <span className="truncate text-sm text-ink">
              {item.fieldCode && (
                <span className="me-2 rounded-full bg-ink/5 px-1.5 py-0.5 text-xs text-ink-muted" dir="ltr">
                  {item.fieldCode}
                </span>
              )}
              {item.description}
            </span>
            <span className="h-2 rounded-full bg-ink/5">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${(Math.abs(item.amount) / maxAmount) * 100}%` }}
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

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-ink-muted">טבלת נתונים (נגישות)</summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only-table">כל שורות טופס 106</caption>
          <thead>
            <tr className="border-b border-ink/15">
              <th className="py-1 text-start font-semibold">קוד שדה</th>
              <th className="py-1 text-start font-semibold">תיאור</th>
              <th className="py-1 text-start font-semibold">סכום</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              <tr key={`${item.description}-${index}`} className="border-b border-ink/5">
                <td className="py-1">{item.fieldCode ?? '—'}</td>
                <td className="py-1">{item.description}</td>
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
