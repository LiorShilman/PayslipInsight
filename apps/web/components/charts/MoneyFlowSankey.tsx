'use client';

import { sankey, sankeyLinkHorizontal, type SankeyNode } from 'd3-sankey';
import { useMemo } from 'react';
import { formatILS } from '@payslip-insight/core';
import type { Payslip, Provenance } from '@payslip-insight/schema';
import { useProvenance } from '@/lib/provenance-context';

const WIDTH = 680;
const NODE_WIDTH = 14;
const MARGIN = { top: 10, bottom: 10, sourceSide: 90, targetSide: 210 };

type NodeKind = 'source' | 'mandatory' | 'voluntary' | 'net';

type FlowNodeInput = { id: string; name: string; kind: NodeKind; prov: Provenance | null };
type FlowLinkInput = { source: string; target: string; value: number };
type FlowNode = SankeyNode<FlowNodeInput, FlowLinkInput>;

const KIND_COLOR: Record<NodeKind, string> = {
  source: 'var(--color-ink-muted)',
  mandatory: 'var(--color-accent-alert)',
  voluntary: 'var(--color-amber)',
  net: 'var(--color-accent)',
};

type Props = { payslip: Payslip };

/**
 * "איך הכסף זורם ממקום למקום" — הירו הוויזואלי הראשי של הדשבורד.
 * SPEC.md §11.1 מזכיר Sankey במפורש כתלות הצ'ארטים. d3-sankey מחשב רק
 * את ה-layout (קואורדינטות); מרנדרים בעצמנו ב-SVG כמו ב-waterfall.
 *
 * RTL: מריצים את חישוב ה-layout כרגיל (LTR פנימי: מקור בעמודה השמאלית),
 * ואז ממפים מחדש את x0/x1 של כל צומת (x' = WIDTH - x) — בלי טרנספורם
 * SVG חיצוני שדורש "ביטול-היפוך" נפרד לכל טקסט. מכיוון ש-link.source/target
 * הם רפרנסים לאותם אובייקטי צומת, sankeyLinkHorizontal קורא את הקואורדינטות
 * הממופות-מחדש אוטומטית וזורם נכון מימין (ברוטו) לשמאל (יעדים).
 */
export function MoneyFlowSankey({ payslip }: Props) {
  const { setHighlighted } = useProvenance();

  const deductionLineItems = payslip.lineItems.filter(
    (li) => li.section === 'mandatory_deduction' || li.section === 'voluntary_deduction',
  );

  // תלושים אמיתיים יכולים להכיל 10+ שורות ניכוי קטנות — צריך מספיק גובה
  // + ריפוד בין צמתים כדי שהתוויות לא יתנגשו כשהערכים קטנים (וגובה הצומת
  // הפרופורציונלי כמעט אפסי).
  const height = Math.max(320, deductionLineItems.length * 46 + 60);

  const { nodes, links } = useMemo(() => {
    const nodesInput: FlowNodeInput[] = [
      { id: 'gross', name: 'ברוטו', kind: 'source', prov: payslip.totals.grossPay.prov },
      ...deductionLineItems.map((li, i) => ({
        id: `d${i}`,
        name: li.label,
        kind: (li.section === 'mandatory_deduction' ? 'mandatory' : 'voluntary') as NodeKind,
        prov: li.prov,
      })),
      { id: 'net', name: 'נטו לתשלום', kind: 'net' as NodeKind, prov: payslip.totals.netPay.prov },
    ];
    const linksInput: FlowLinkInput[] = [
      ...deductionLineItems.map((li, i) => ({ source: 'gross', target: `d${i}`, value: Math.max(li.amount, 1) })),
      { source: 'gross', target: 'net', value: Math.max(payslip.totals.netPay.value, 1) },
    ];

    const layout = sankey<FlowNodeInput, FlowLinkInput>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(18)
      .extent([
        [MARGIN.sourceSide, MARGIN.top],
        [WIDTH - MARGIN.targetSide, height - MARGIN.bottom],
      ])({
      nodes: nodesInput.map((d) => ({ ...d })),
      links: linksInput.map((d) => ({ ...d })),
    });

    // הופכים למצג RTL: מקור עובר לימין, יעדים לשמאל.
    // x0/x1 מסומנים אופציונליים בטיפוס (לפני הרצת ה-layout) אך מובטחים
    // להיות מלאים כאן — אחרי ריצת הגנרטור.
    for (const node of layout.nodes) {
      const x0 = node.x0 ?? 0;
      const x1 = node.x1 ?? 0;
      node.x0 = WIDTH - x1;
      node.x1 = WIDTH - x0;
    }

    return layout;
  }, [payslip, deductionLineItems, height]);

  const linkPath = sankeyLinkHorizontal<FlowNodeInput, FlowLinkInput>();

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-labelledby="sankey-title" className="w-full">
        <title id="sankey-title">גרף זרימת הכסף מהברוטו לכל יעד</title>
        {links.map((link, i) => {
          const target = link.target as FlowNode;
          return (
            <path
              key={i}
              d={linkPath(link) ?? undefined}
              fill="none"
              stroke={KIND_COLOR[target.kind]}
              strokeOpacity={0.3}
              strokeWidth={Math.max(1, link.width ?? 0)}
            />
          );
        })}
        {nodes.map((node) => {
          const color = KIND_COLOR[node.kind];
          const isSource = node.kind === 'source';
          const x0 = node.x0 ?? 0;
          const x1 = node.x1 ?? 0;
          const y0 = node.y0 ?? 0;
          const y1 = node.y1 ?? 0;
          const midY = (y0 + y1) / 2;

          return (
            <g key={node.id}>
              <rect
                x={x0}
                y={y0}
                width={Math.max(1, x1 - x0)}
                height={Math.max(1, y1 - y0)}
                fill={color}
                rx={2}
                tabIndex={node.prov ? 0 : -1}
                role={node.prov ? 'button' : undefined}
                aria-label={`${node.name}: ${formatILS(isSource ? payslip.totals.grossPay.value : 0)}`}
                className={node.prov ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent' : undefined}
                onClick={() => node.prov && setHighlighted(node.prov)}
                onKeyDown={(e) => {
                  if (node.prov && (e.key === 'Enter' || e.key === ' ')) setHighlighted(node.prov);
                }}
              >
                <title>{node.name}</title>
              </rect>
              <text
                x={isSource ? x1 + 10 : x0 - 10}
                y={midY}
                dominantBaseline="middle"
                textAnchor={isSource ? 'start' : 'end'}
                fontSize={12.5}
                fontWeight={isSource ? 700 : 500}
                fontFamily="var(--font-body)"
                fill="var(--color-ink)"
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>

      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-ink-muted">טבלת נתונים (נגישות)</summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only-table">פירוט זרימת הכסף מהברוטו</caption>
          <thead>
            <tr className="border-b border-ink/15">
              <th className="py-1 text-start font-semibold">יעד</th>
              <th className="py-1 text-start font-semibold">סכום</th>
            </tr>
          </thead>
          <tbody>
            {[...deductionLineItems.map((li) => ({ label: li.label, amount: li.amount })), { label: 'נטו לתשלום', amount: payslip.totals.netPay.value }].map(
              (row) => (
                <tr key={row.label} className="border-b border-ink/5">
                  <td className="py-1">{row.label}</td>
                  <td className="py-1" dir="ltr">
                    {formatILS(row.amount)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </details>
    </div>
  );
}
