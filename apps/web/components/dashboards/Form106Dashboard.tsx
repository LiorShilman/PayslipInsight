'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { formatILS } from '@payslip-insight/core';
import type { Form106RetirementFund } from '@payslip-insight/core';
import { RetirementSavingsChart } from '@/components/charts/RetirementSavingsChart';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Form106ItemsTable } from '@/components/Form106ItemsTable';
import { DocumentViewer } from '@/components/viewer/DocumentViewer';
import { ProvenanceProvider } from '@/lib/provenance-context';
import type { Form106ExtractionResult } from '@/lib/types';

const FUND_LABELS: Record<Form106RetirementFund, string> = {
  pension: 'פנסיה',
  severance: 'פיצויים',
  studyFund: 'קרן השתלמות',
  disabilityInsurance: 'אובדן כושר עבודה',
  other: 'אחר',
};

const TOTALS_LABELS: { key: 'taxableWages' | 'incomeTaxWithheld' | 'totalEmployerPensionContribution' | 'nationalInsuranceInsuredIncome'; label: string }[] = [
  { key: 'taxableWages', label: 'משכורת חייבת במס' },
  { key: 'incomeTaxWithheld', label: 'מס הכנסה שנוכה במקור' },
  { key: 'totalEmployerPensionContribution', label: 'סך הפרשות מעסיק לקצבה' },
  { key: 'nationalInsuranceInsuredIncome', label: 'הכנסה מבוטחת בביטוח לאומי' },
];

/** "רגע הפירוק" — אותו אפקט חשיפה מדורגת כמו PayslipDashboard (SPEC.md §8.5). */
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

type Props = { result: Form106ExtractionResult };

export function Form106Dashboard({ result }: Props) {
  const reveal = useReveal();
  const { form106, derived, validation, pages } = result;
  const blockingFailures = validation.filter((v) => v.severity === 'blocking' && !v.passed);
  const needsReview = blockingFailures.length > 0;

  const totalsRows = TOTALS_LABELS.map(({ key, label }) => ({ label, value: form106.totals[key]?.value ?? null })).filter(
    (r): r is { label: string; value: number } => r.value !== null,
  );

  // ייצוא מקומי בלבד — לא נשלח ולא נשמר בשום שרת (SPEC.md §13.1, CLAUDE.md #9-10).
  function downloadJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-insight-form106-${form106.meta.taxYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ProvenanceProvider>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent">טופס 106 · שנת מס {form106.meta.taxYear}</p>
              <h1 className="font-display text-3xl font-semibold text-ink">
                {needsReview ? 'יש כמה דברים לבדוק' : 'הסיכום השנתי שלך מהמעסיק'}
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
            הניתוח הזה הוא כלי הבנה בלבד — לא ייעוץ מס. כל דגל הוא הצעה לבדיקה, לא קביעה.
          </p>
          {needsReview && (
            <p
              role="alert"
              className="mt-4 rounded-sm border border-accent-alert/40 bg-accent-alert-soft p-3 text-sm text-accent-alert"
            >
              חלק מהמספרים לא הסתדרו בבדיקת החשבון האוטומטית ({blockingFailures.length} חוקים) — שווה לבדוק מול
              מחלקת השכר לפני שמסתמכים על הניתוח.
            </p>
          )}
          {form106.extraction.warnings.length > 0 && (
            <details className="mt-4 rounded-sm border border-amber/40 bg-amber-soft p-3 text-sm text-ink print:hidden">
              <summary className="cursor-pointer font-semibold text-amber">
                {form106.extraction.warnings.length} דברים שכדאי לדעת על החילוץ
              </summary>
              <ul className="mt-2 list-disc space-y-1 break-words ps-5 text-ink-muted">
                {form106.extraction.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px] print:grid-cols-1">
          <div className="flex flex-col gap-6">
            {totalsRows.length > 0 && (
              <motion.div custom={0} initial="hidden" animate="show" variants={reveal}>
                <Card>
                  <CardTitle>נתוני מפתח</CardTitle>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                    {totalsRows.map((r) => (
                      <div key={r.label}>
                        <dt className="text-ink-muted">{r.label}</dt>
                        <dd dir="ltr" className="mt-0.5 text-lg font-semibold text-ink">
                          {formatILS(r.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              </motion.div>
            )}

            <motion.div custom={1} initial="hidden" animate="show" variants={reveal}>
              <RetirementSavingsChart breakdown={derived.fundBreakdown} fundLabels={FUND_LABELS} />
            </motion.div>

            <motion.div custom={2} initial="hidden" animate="show" variants={reveal}>
              <Form106ItemsTable lineItems={form106.lineItems} />
            </motion.div>
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
