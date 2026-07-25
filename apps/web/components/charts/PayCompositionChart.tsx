'use client';

import { Group } from '@visx/group';
import { Pie } from '@visx/shape';
import { formatILS } from '@payslip-insight/core';
import type { DerivedMetrics } from '@payslip-insight/core';
import { Card, CardTitle } from '@/components/ui/card';

const SIZE = 200;
const RADIUS = SIZE / 2;
const THICKNESS = 34;

type Slice = { key: string; label: string; value: number; color: string };

/** SPEC.md §8.2 — PayCompositionChart: קבוע / משתנה / החזרים / שווי. מקור: derived.payDistribution (M0), עד היום לא הוצג ב-UI. */
export function PayCompositionChart({ payDistribution }: { payDistribution: DerivedMetrics['payDistribution'] }) {
  const slices: Slice[] = [
    { key: 'fixed', label: 'קבוע', value: payDistribution.fixed, color: 'var(--color-ink)' },
    { key: 'variable', label: 'משתנה', value: payDistribution.variable, color: 'var(--color-accent)' },
    { key: 'reimbursement', label: 'החזר הוצאות', value: payDistribution.reimbursement, color: 'var(--color-ink-muted)' },
    { key: 'benefitInKind', label: 'שווי (רכב/טלפון וכו׳)', value: payDistribution.benefitInKind, color: 'var(--color-amber)' },
  ].filter((s) => s.value > 0);

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) return null;

  return (
    <Card>
      <CardTitle>הרכב השכר</CardTitle>
      <p className="mt-1 text-sm text-ink-muted">מה בברוטו שלך צפוי ויציב, ומה משתנה או לא נכנס בפועל לחשבון.</p>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <svg width={SIZE} height={SIZE} role="img" aria-label="גרף הרכב השכר">
          <Group top={RADIUS} left={RADIUS}>
            <Pie
              data={slices}
              pieValue={(d) => d.value}
              outerRadius={RADIUS - 2}
              innerRadius={RADIUS - THICKNESS}
              cornerRadius={2}
              padAngle={0.015}
            >
              {(pie) =>
                pie.arcs.map((arc, i) => (
                  <path key={i} d={pie.path(arc) ?? undefined} fill={slices[i]?.color}>
                    <title>{`${arc.data.label}: ${formatILS(arc.data.value)}`}</title>
                  </path>
                ))
              }
            </Pie>
          </Group>
          <text x={RADIUS} y={RADIUS - 6} textAnchor="middle" fontSize={12} fill="var(--color-ink-muted)" fontFamily="var(--font-body)">
            ברוטו
          </text>
          <text
            x={RADIUS}
            y={RADIUS + 14}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fill="var(--color-ink)"
            fontFamily="var(--font-body)"
          >
            <tspan direction="ltr">{formatILS(total)}</tspan>
          </text>
        </svg>

        <ul className="flex flex-1 flex-col gap-2 text-sm">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                {s.label}
              </span>
              <span className="flex items-baseline gap-2">
                <span dir="ltr" className="font-medium text-ink">
                  {formatILS(s.value)}
                </span>
                <span className="text-xs text-ink-muted">{Math.round((s.value / total) * 100)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
