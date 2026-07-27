'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { formatILS } from '@payslip-insight/core';
import type { PersonalInfoReportFundKind } from '@payslip-insight/schema';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { PersonalInfoReportDepositsTable } from '@/components/PersonalInfoReportDepositsTable';
import { DocumentViewer } from '@/components/viewer/DocumentViewer';
import { ProvenanceProvider } from '@/lib/provenance-context';
import type { PersonalInfoReportExtractionResult } from '@/lib/types';

const FUND_KIND_LABELS: Record<PersonalInfoReportFundKind, string> = {
  pension: 'פנסיה',
  gemel_investment: 'קופת גמל להשקעה',
  study_fund: 'קרן השתלמות',
  manager_insurance: 'ביטוח מנהלים',
  other: 'חיסכון פיננסי',
};

const PROJECTED_BENEFIT_LABELS: { key: 'retirementMonthlyPension' | 'widowMonthlyPension' | 'orphanMonthlyPension' | 'dependentParentMonthlyPension' | 'disabilityMonthlyPension'; label: string }[] = [
  { key: 'retirementMonthlyPension', label: 'קצבת פרישה חודשית' },
  { key: 'widowMonthlyPension', label: 'קצבת אלמן/ה חודשית' },
  { key: 'orphanMonthlyPension', label: 'קצבת יתום חודשית' },
  { key: 'dependentParentMonthlyPension', label: 'קצבת הורה נתמך חודשית' },
  { key: 'disabilityMonthlyPension', label: 'קצבת נכות חודשית' },
];

function formatPercent(rate: number | null): string | null {
  if (rate === null) return null;
  return `${(rate * 100).toLocaleString('he-IL', { maximumFractionDigits: 2 })}%`;
}

/** "רגע הפירוק" — אותו אפקט חשיפה מדורגת כמו Form106Dashboard/PayslipDashboard (SPEC.md §8.5). */
function useReveal(): Variants {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return { hidden: { opacity: 1 }, show: { opacity: 1 } };
  }
  return {
    hidden: { opacity: 0, y: 14, scale: 0.98 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { delay: i * 0.12, duration: 0.45, ease: 'easeOut' },
    }),
  };
}

type Props = { result: PersonalInfoReportExtractionResult };

export function PersonalInfoReportDashboard({ result }: Props) {
  const reveal = useReveal();
  const { report, derived, validation, pages } = result;
  const blockingFailures = validation.filter((v) => v.severity === 'blocking' && !v.passed);
  const needsReview = blockingFailures.length > 0;

  const { fundMovements } = report;
  const movementRows = [
    { label: 'יתרת פתיחה', value: fundMovements.openingBalance },
    { label: 'הפקדות', value: fundMovements.deposits },
    { label: 'תשואה', value: fundMovements.investmentGains },
    { label: 'דמי ניהול', value: fundMovements.managementFees },
    { label: 'עלות ביטוח נכות', value: fundMovements.disabilityInsuranceCost },
    { label: 'עלות ביטוח מוות', value: fundMovements.deathInsuranceCost },
    { label: 'יתרת סגירה', value: fundMovements.closingBalance },
  ].filter((r): r is { label: string; value: NonNullable<typeof r.value> } => r.value !== null);

  const feeFromDeposits = formatPercent(report.managementFeeRates.feeFromDeposits);
  const feeFromBalance = formatPercent(report.managementFeeRates.feeFromBalance);

  const projectedBenefitRows =
    report.meta.fundKind === 'pension' && report.projectedBenefits
      ? PROJECTED_BENEFIT_LABELS.map(({ key, label }) => ({ label, value: report.projectedBenefits?.[key] ?? null })).filter(
          (r): r is { label: string; value: number } => r.value !== null,
        )
      : [];

  // ייצוא מקומי בלבד — לא נשלח ולא נשמר בשום שרת (SPEC.md §13.1, CLAUDE.md #9-10).
  function downloadJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payslip-insight-personal-info-report.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ProvenanceProvider>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent">
                {FUND_KIND_LABELS[report.meta.fundKind]}
                {report.meta.fundCompanyName ? ` · ${report.meta.fundCompanyName}` : ''}
              </p>
              <h1 className="font-display text-3xl font-semibold text-ink">
                {needsReview ? 'יש כמה דברים לבדוק' : 'דוח המידע האישי שלך'}
              </h1>
            </div>
            <div className="flex shrink-0 gap-2 print:hidden">
              <Button type="button" variant="outline" size="sm" onClick={downloadJson}>
                הורדת נתונים (JSON)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
                הדפסה / שמירה כ-PDF
              </Button>
            </div>
          </div>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            הניתוח הזה הוא כלי הבנה בלבד — לא ייעוץ פנסיוני או השקעתי. כל דגל הוא הצעה לבדיקה, לא קביעה.
          </p>
          {needsReview && (
            <p
              role="alert"
              className="mt-4 rounded-sm border border-accent-alert/40 bg-accent-alert-soft p-3 text-sm text-accent-alert"
            >
              חלק מהמספרים לא הסתדרו בבדיקת החשבון האוטומטית ({blockingFailures.length} חוקים) — שווה לבדוק מול הגוף
              המנהל לפני שמסתמכים על הניתוח.
            </p>
          )}
          {report.extraction.warnings.length > 0 && (
            <details className="mt-4 rounded-sm border border-amber/40 bg-amber-soft p-3 text-sm text-ink print:hidden">
              <summary className="cursor-pointer font-semibold text-amber">
                {report.extraction.warnings.length} דברים שכדאי לדעת על החילוץ
              </summary>
              <ul className="mt-2 list-disc space-y-1 break-words ps-5 text-ink-muted">
                {report.extraction.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px] print:grid-cols-1">
          <div className="flex flex-col gap-6">
            {movementRows.length > 0 && (
              <motion.div custom={0} initial="hidden" animate="show" variants={reveal}>
                <Card>
                  <CardTitle>תנועות בקרן</CardTitle>
                  <ul className="mt-4 divide-y divide-ink/10 text-sm">
                    {movementRows.map((r) => (
                      <li key={r.label} className="flex items-center justify-between gap-4 py-2">
                        <span className="text-ink-muted">{r.label}</span>
                        <span className="flex items-center gap-2">
                          <span dir="ltr" className="font-semibold tabular-nums text-ink">
                            {formatILS(r.value.value)}
                          </span>
                          {r.value.prov && <ConfidenceBadge confidence={r.value.prov.confidence} />}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {derived.netGrowth !== null && (
                    <p className="mt-4 border-t border-ink/10 pt-4 text-sm text-ink-muted">
                      גידול נטו בתקופה: <span dir="ltr" className="font-semibold text-ink">{formatILS(derived.netGrowth)}</span>
                    </p>
                  )}
                </Card>
              </motion.div>
            )}

            {(feeFromDeposits || feeFromBalance || derived.totalFeesAndCosts !== 0) && (
              <motion.div custom={1} initial="hidden" animate="show" variants={reveal}>
                <Card>
                  <CardTitle>דמי ניהול ועלויות</CardTitle>
                  <ul className="mt-4 divide-y divide-ink/10 text-sm">
                    {feeFromDeposits && (
                      <li className="flex items-center justify-between gap-4 py-2">
                        <span className="text-ink-muted">דמי ניהול מהפקדה</span>
                        <span dir="ltr" className="font-semibold tabular-nums text-ink">
                          {feeFromDeposits}
                        </span>
                      </li>
                    )}
                    {feeFromBalance && (
                      <li className="flex items-center justify-between gap-4 py-2">
                        <span className="text-ink-muted">דמי ניהול מצבירה</span>
                        <span dir="ltr" className="font-semibold tabular-nums text-ink">
                          {feeFromBalance}
                        </span>
                      </li>
                    )}
                    <li className="flex items-center justify-between gap-4 py-2">
                      <span className="text-ink-muted">סה"כ דמי ניהול ועלויות בתקופה</span>
                      <span dir="ltr" className="font-semibold tabular-nums text-ink">
                        {formatILS(derived.totalFeesAndCosts)}
                      </span>
                    </li>
                  </ul>
                </Card>
              </motion.div>
            )}

            {report.investmentTracks.length > 0 && (
              <motion.div custom={2} initial="hidden" animate="show" variants={reveal}>
                <Card>
                  <CardTitle>מסלולי השקעה ותשואות</CardTitle>
                  <ul className="mt-4 divide-y divide-ink/10 text-sm">
                    {report.investmentTracks.map((track, i) => (
                      <li key={i} className="flex items-center justify-between py-2">
                        <span className="text-ink">{track.trackName}</span>
                        <span dir="ltr" className="font-medium tabular-nums text-ink">
                          {formatPercent(track.returnRate) ?? '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}

            {projectedBenefitRows.length > 0 && (
              <motion.div custom={3} initial="hidden" animate="show" variants={reveal}>
                <Card>
                  <CardTitle>תחזית תשלומים עתידיים</CardTitle>
                  <p className="mt-1 text-xs text-ink-muted">כפי שמוצג בדוח — לא תחזית מחייבת.</p>
                  <ul className="mt-4 divide-y divide-ink/10 text-sm">
                    {projectedBenefitRows.map((r) => (
                      <li key={r.label} className="flex items-center justify-between gap-4 py-2">
                        <span className="text-ink-muted">{r.label}</span>
                        <span dir="ltr" className="font-semibold tabular-nums text-ink">
                          {formatILS(r.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}

            <motion.div custom={4} initial="hidden" animate="show" variants={reveal}>
              <PersonalInfoReportDepositsTable deposits={report.deposits} />
            </motion.div>

            {report.advisor && (report.advisor.name ?? report.advisor.phone) && (
              <motion.div custom={5} initial="hidden" animate="show" variants={reveal}>
                <Card>
                  <CardTitle>איש קשר</CardTitle>
                  <p className="mt-2 flex items-center gap-2 text-sm text-ink">
                    <span>{report.advisor.name ?? '—'}</span>
                    {report.advisor.phone && (
                      <>
                        <span className="text-ink-muted">·</span>
                        <span dir="ltr">{report.advisor.phone}</span>
                      </>
                    )}
                  </p>
                </Card>
              </motion.div>
            )}
          </div>

          <motion.div
            custom={0.6}
            initial="hidden"
            animate="show"
            variants={reveal}
            className="lg:sticky lg:top-10 print:hidden"
          >
            <DocumentViewer pages={pages} />
          </motion.div>
        </div>
      </main>
    </ProvenanceProvider>
  );
}
