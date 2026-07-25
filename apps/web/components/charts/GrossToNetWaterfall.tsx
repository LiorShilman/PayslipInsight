'use client';

import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { formatILS } from '@payslip-insight/core';
import type { WaterfallStep } from '@payslip-insight/core';
import type { Payslip } from '@payslip-insight/schema';
import { useProvenance } from '@/lib/provenance-context';

const HEIGHT = 340;
const MARGIN = { top: 16, right: 12, bottom: 92, left: 12 };

type Props = {
  payslip: Payslip;
  waterfall: WaterfallStep[];
};

/** SPEC.md §8.2 — הגרף הראשי. ברוטו → כל ניכוי → נטו, מבוסס על derived.waterfall (M0). */
export function GrossToNetWaterfall({ payslip, waterfall }: Props) {
  const { setHighlighted } = useProvenance();

  const deductionLineItems = payslip.lineItems.filter(
    (li) => li.section === 'mandatory_deduction' || li.section === 'voluntary_deduction',
  );

  function provenanceFor(step: WaterfallStep, index: number) {
    if (step.kind === 'start') return payslip.totals.grossPay.prov;
    if (step.kind === 'end') return payslip.totals.netPay.prov;
    return deductionLineItems[index]?.prov ?? null;
  }

  const maxValue = Math.max(payslip.totals.grossPay.value, ...waterfall.map((s) => s.cumulativeAfter));
  // רוחב יחסי למספר השלבים — לא נדחס לרוחב קבוע. תלושים אמיתיים יכולים
  // להכיל 15+ שורות ניכוי; דחיסה לרוחב קבוע היא מה שגרם להתנגשות תוויות.
  const width = Math.max(720, waterfall.length * 88);
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const xScale = scaleBand<string>({
    domain: waterfall.map((s) => s.key),
    range: [0, innerWidth],
    padding: 0.3,
  });
  const yScale = scaleLinear<number>({
    domain: [0, maxValue],
    range: [innerHeight, 0],
  });

  return (
    <div>
      <div className="overflow-x-auto">
      <svg width={width} height={HEIGHT} role="img" aria-labelledby="waterfall-title" className="max-w-none">
        <title id="waterfall-title">גרף ברוטו לנטו</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="var(--color-ink)" strokeOpacity={0.15} />
          {waterfall.map((step, index) => {
            let y0: number;
            let y1: number;
            if (step.kind === 'deduction') {
              const prevCumulative = step.cumulativeAfter + step.amount;
              y0 = step.cumulativeAfter;
              y1 = prevCumulative;
            } else {
              y0 = 0;
              y1 = step.amount;
            }
            const barY = yScale(y1);
            const barHeight = Math.max(1, yScale(y0) - yScale(y1));
            const barX = xScale(step.key) ?? 0;
            const barWidth = xScale.bandwidth();
            const color =
              step.kind === 'start'
                ? 'var(--color-ink-muted)'
                : step.kind === 'end'
                  ? 'var(--color-accent)'
                  : 'var(--color-accent-alert)';
            const prov = provenanceFor(step, index);

            return (
              <Group key={step.key}>
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  tabIndex={prov ? 0 : -1}
                  role={prov ? 'button' : undefined}
                  aria-label={`${step.label}: ${formatILS(step.amount)}`}
                  className={prov ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent' : undefined}
                  onClick={() => prov && setHighlighted(prov)}
                  onKeyDown={(e) => {
                    if (prov && (e.key === 'Enter' || e.key === ' ')) setHighlighted(prov);
                  }}
                >
                  <title>{`${step.label}: ${formatILS(step.amount)}`}</title>
                </rect>
                <text
                  x={barX + barWidth / 2}
                  y={barY - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fontFamily="var(--font-body)"
                  fill="var(--color-ink)"
                >
                  <tspan direction="ltr">{formatILS(step.amount)}</tspan>
                </text>
                <text
                  x={barX + barWidth / 2}
                  y={innerHeight + 20}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="var(--font-body)"
                  fill="var(--color-ink-muted)"
                  transform={`rotate(-35, ${barX + barWidth / 2}, ${innerHeight + 20})`}
                >
                  {step.label}
                </text>
              </Group>
            );
          })}
        </Group>
      </svg>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-ink-muted">טבלת נתונים (נגישות)</summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only-table">פירוט ברוטו לנטו</caption>
          <thead>
            <tr className="border-b border-ink/15 text-start">
              <th className="py-1 text-start font-semibold">רכיב</th>
              <th className="py-1 text-start font-semibold">סכום</th>
            </tr>
          </thead>
          <tbody>
            {waterfall.map((step) => (
              <tr key={step.key} className="border-b border-ink/5">
                <td className="py-1">{step.label}</td>
                <td className="py-1" dir="ltr">
                  {formatILS(step.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
