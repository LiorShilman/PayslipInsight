'use client';

import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { formatILS } from '@payslip-insight/core';
import type { DerivedMetrics, RetirementFund } from '@payslip-insight/core';
import { Card, CardTitle } from '@/components/ui/card';

const FUND_LABELS: Record<RetirementFund, string> = {
  pension: 'פנסיה',
  severance: 'פיצויים',
  studyFund: 'קרן השתלמות',
  managerInsurance: 'ביטוח מנהלים',
};

const HEIGHT = 260;
const MARGIN = { top: 28, right: 12, bottom: 32, left: 12 };

type Props = { retirementBreakdown: DerivedMetrics['retirementBreakdown'] };

/** SPEC.md §8.2 — פנסיה/פיצויים/קה"ל: עובד מול מעסיק, לכל קרן בנפרד, בגרף עמודות מקובצות. */
export function RetirementSavingsChart({ retirementBreakdown }: Props) {
  if (retirementBreakdown.length === 0) return null;

  const width = Math.max(420, retirementBreakdown.length * 150);
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxValue = Math.max(...retirementBreakdown.flatMap((r) => [r.employee, r.employer]), 1);

  const fundScale = scaleBand<string>({
    domain: retirementBreakdown.map((r) => r.fund),
    range: [0, innerWidth],
    padding: 0.35,
  });
  const groupScale = scaleBand<string>({
    domain: ['employee', 'employer'],
    range: [0, fundScale.bandwidth()],
    padding: 0.15,
  });
  const yScale = scaleLinear<number>({ domain: [0, maxValue], range: [innerHeight, 0] });

  return (
    <Card>
      <CardTitle>פנסיה, פיצויים וקרן השתלמות</CardTitle>
      <p className="mt-1 text-sm text-ink-muted">כמה אתה מפקיד וכמה המעסיק מפקיד, לכל קרן בנפרד.</p>

      <div className="mt-6 overflow-x-auto">
        <svg width={width} height={HEIGHT} role="img" aria-labelledby="retirement-title" className="max-w-none">
          <title id="retirement-title">פנסיה, פיצויים וקרן השתלמות — עובד מול מעסיק</title>
          <Group left={MARGIN.left} top={MARGIN.top}>
            <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="var(--color-ink)" strokeOpacity={0.15} />
            {retirementBreakdown.map((row) => {
              const fundX = fundScale(row.fund) ?? 0;
              return (
                <Group key={row.fund}>
                  {(['employee', 'employer'] as const).map((who) => {
                    const value = row[who];
                    if (value === 0) return null;
                    const barX = fundX + (groupScale(who) ?? 0);
                    const barWidth = groupScale.bandwidth();
                    const barY = yScale(value);
                    const barHeight = Math.max(1, innerHeight - barY);
                    const color = who === 'employee' ? 'var(--color-amber)' : 'var(--color-info)';
                    return (
                      <Group key={who}>
                        <rect x={barX} y={barY} width={barWidth} height={barHeight} fill={color} rx={2}>
                          <title>{`${who === 'employee' ? 'עובד' : 'מעסיק'} — ${FUND_LABELS[row.fund]}: ${formatILS(value)}`}</title>
                        </rect>
                        <text
                          x={barX + barWidth / 2}
                          y={barY - 6}
                          textAnchor="middle"
                          fontSize={10.5}
                          fontFamily="var(--font-body)"
                          fill="var(--color-ink)"
                        >
                          <tspan direction="ltr">{formatILS(value)}</tspan>
                        </text>
                      </Group>
                    );
                  })}
                  <text
                    x={fundX + fundScale.bandwidth() / 2}
                    y={innerHeight + 22}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fontFamily="var(--font-body)"
                    fill="var(--color-ink)"
                  >
                    {FUND_LABELS[row.fund]}
                  </text>
                </Group>
              );
            })}
          </Group>
        </svg>
      </div>

      <div className="mt-4 flex items-center gap-5 text-sm">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--color-amber)' }} aria-hidden />
          עובד
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--color-info)' }} aria-hidden />
          מעסיק
        </span>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-ink-muted">טבלת נתונים (נגישות)</summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only-table">פירוט פנסיה, פיצויים וקרן השתלמות</caption>
          <thead>
            <tr className="border-b border-ink/15">
              <th className="py-1 text-start font-semibold">קרן</th>
              <th className="py-1 text-start font-semibold">עובד</th>
              <th className="py-1 text-start font-semibold">מעסיק</th>
            </tr>
          </thead>
          <tbody>
            {retirementBreakdown.map((row) => (
              <tr key={row.fund} className="border-b border-ink/5">
                <td className="py-1">{FUND_LABELS[row.fund]}</td>
                <td className="py-1" dir="ltr">
                  {formatILS(row.employee)}
                </td>
                <td className="py-1" dir="ltr">
                  {formatILS(row.employer)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
