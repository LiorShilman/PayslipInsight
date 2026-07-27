'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { RetirementFund } from '@payslip-insight/core';
import { EmployerCostCard } from '@/components/EmployerCostCard';
import { GrossToNetWaterfall } from '@/components/charts/GrossToNetWaterfall';
import { MoneyFlowSankey } from '@/components/charts/MoneyFlowSankey';
import { PayCompositionChart } from '@/components/charts/PayCompositionChart';
import { RetirementSavingsChart } from '@/components/charts/RetirementSavingsChart';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { LineItemsTable } from '@/components/LineItemsTable';
import { TrueNetCard } from '@/components/TrueNetCard';
import { YtdComparisonCard } from '@/components/YtdComparisonCard';
import { DocumentViewer } from '@/components/viewer/DocumentViewer';
import { ProvenanceProvider } from '@/lib/provenance-context';
import type { PayslipExtractionResult } from '@/lib/types';

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
] as const;

const RETIREMENT_FUND_LABELS: Record<RetirementFund, string> = {
  pension: 'פנסיה',
  severance: 'פיצויים',
  studyFund: 'קרן השתלמות',
  managerInsurance: 'ביטוח מנהלים',
};

/** "רגע הפירוק" — האלמנט החתימתי (SPEC.md §8.5): כל סקציה נחשפת בסטאגר עם אפקט "חותמת". */
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

type Props = { result: PayslipExtractionResult };

export function PayslipDashboard({ result }: Props) {
  const reveal = useReveal();
  const { payslip, derived, validation, pages } = result;
  const blockingFailures = validation.filter((v) => v.severity === 'blocking' && !v.passed);
  const needsReview = blockingFailures.length > 0;
  const hasSavingsData = derived.trueNet.employeeSavings > 0 || derived.trueNet.employerSavings > 0;

  // ייצוא מקומי בלבד — לא נשלח ולא נשמר בשום שרת (SPEC.md §13.1, CLAUDE.md #9-10).
  // הקובץ נבנה ב-client ויורד ישירות למכשיר של המשתמש.
  function downloadJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-insight-${payslip.meta.period.year}-${String(payslip.meta.period.month).padStart(2, '0')}.json`;
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
                {MONTH_NAMES[payslip.meta.period.month - 1]} {payslip.meta.period.year}
              </p>
              <h1 className="font-display text-3xl font-semibold text-ink">
                {needsReview ? 'יש כמה דברים לבדוק' : 'הנה לאן הלך כל שקל'}
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
          {/* מוסתר בהדפסה: הערות תפעוליות על איכות החילוץ שימושיות על המסך
              אבל לא רלוונטיות לתיעוד מודפס — כמו DocumentViewer למעלה. */}
          {payslip.extraction.warnings.length > 0 && (
            <details className="mt-4 rounded-sm border border-amber/40 bg-amber-soft p-3 text-sm text-ink print:hidden">
              <summary className="cursor-pointer font-semibold text-amber">
                {payslip.extraction.warnings.length} דברים שכדאי לדעת על החילוץ
              </summary>
              <ul className="mt-2 list-disc space-y-1 break-words ps-5 text-ink-muted">
                {payslip.extraction.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </header>

        {/* print:grid-cols-1 — עמודות זו-לצד-זו נשברות רע בין עמודי הדפסה
            (הדפדפן לא יודע ליישר sibling columns על פני page-break), אז
            בהדפסה עוברים לזרימה חד-טורית: כל הגרפים ואז המסמך המקורי. */}
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px] print:grid-cols-1">
          <div className="flex flex-col gap-6">
            <motion.div custom={0} initial="hidden" animate="show" variants={reveal}>
              <Card>
                <CardTitle>איך הכסף זורם</CardTitle>
                <p className="mt-1 text-sm text-ink-muted">מהברוטו שלך, לכל יעד — ניכויים ונטו לתשלום.</p>
                <div className="mt-6">
                  <MoneyFlowSankey payslip={payslip} />
                </div>
              </Card>
            </motion.div>

            <motion.div
              custom={1}
              initial="hidden"
              animate="show"
              variants={reveal}
              className="grid gap-6 md:grid-cols-2"
            >
              <PayCompositionChart payDistribution={derived.payDistribution} />
              <EmployerCostCard
                derived={derived}
                grossPay={payslip.totals.grossPay.value}
                netPay={payslip.totals.netPay.value}
              />
            </motion.div>

            {hasSavingsData && (
              <motion.div
                custom={2}
                initial="hidden"
                animate="show"
                variants={reveal}
                className="grid gap-6 md:grid-cols-2"
              >
                <TrueNetCard trueNet={derived.trueNet} />
                <RetirementSavingsChart
                  breakdown={derived.retirementBreakdown}
                  fundLabels={RETIREMENT_FUND_LABELS}
                />
              </motion.div>
            )}

            {derived.yearToDateComparison.length > 0 && (
              <motion.div custom={3} initial="hidden" animate="show" variants={reveal}>
                <YtdComparisonCard
                  yearToDateComparison={derived.yearToDateComparison}
                  monthNumber={payslip.meta.period.month}
                />
              </motion.div>
            )}

            <motion.div custom={4} initial="hidden" animate="show" variants={reveal}>
              <Card>
                <CardTitle>ברוטו → נטו, צעד אחר צעד</CardTitle>
                <div className="mt-6">
                  <GrossToNetWaterfall payslip={payslip} waterfall={derived.waterfall} />
                </div>
              </Card>
            </motion.div>

            <motion.div custom={5} initial="hidden" animate="show" variants={reveal}>
              <LineItemsTable lineItems={payslip.lineItems} />
            </motion.div>
          </div>

          {/* מוסתר בהדפסה: תמונת סריקה גבוהה + break-inside-avoid יוצרים עמוד
              כמעט-ריק כשהיא לא נכנסת בשארית העמוד הנוכחי. גם מיותר להדפיס —
              המשתמש כבר מחזיק את קובץ המקור שהעלה. */}
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
