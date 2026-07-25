'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmployerCostCard } from '@/components/EmployerCostCard';
import { GrossToNetWaterfall } from '@/components/charts/GrossToNetWaterfall';
import { MoneyFlowSankey } from '@/components/charts/MoneyFlowSankey';
import { PayCompositionChart } from '@/components/charts/PayCompositionChart';
import { Card, CardTitle } from '@/components/ui/card';
import { LineItemsTable } from '@/components/LineItemsTable';
import { DocumentViewer } from '@/components/viewer/DocumentViewer';
import { ProvenanceProvider } from '@/lib/provenance-context';
import type { ExtractionResult } from '@/lib/types';

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
] as const;

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

export default function DashboardPage() {
  const router = useRouter();
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const reveal = useReveal();

  useEffect(() => {
    const raw = sessionStorage.getItem('payslip-insight:result');
    if (!raw) {
      router.replace('/');
      return;
    }
    setResult(JSON.parse(raw) as ExtractionResult);
  }, [router]);

  if (!result) return null;

  const { payslip, derived, validation, pages } = result;
  const blockingFailures = validation.filter((v) => v.severity === 'blocking' && !v.passed);
  const needsReview = blockingFailures.length > 0;

  return (
    <ProvenanceProvider>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <p className="text-sm font-semibold text-accent">
            {MONTH_NAMES[payslip.meta.period.month - 1]} {payslip.meta.period.year}
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink">
            {needsReview ? 'יש כמה דברים לבדוק' : 'הנה לאן הלך כל שקל'}
          </h1>
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
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-6">
            <motion.div custom={0} initial="hidden" animate="show" variants={reveal}>
              <Card>
                <CardTitle>איך הכסף זורם</CardTitle>
                <p className="mt-1 text-sm text-ink-muted">מהברוטו שלך, לכל יעד — ניכויים ונטו לתשלום.</p>
                <div className="mt-4">
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

            <motion.div custom={2} initial="hidden" animate="show" variants={reveal}>
              <Card>
                <CardTitle>ברוטו → נטו, צעד אחר צעד</CardTitle>
                <div className="mt-4">
                  <GrossToNetWaterfall payslip={payslip} waterfall={derived.waterfall} />
                </div>
              </Card>
            </motion.div>

            <motion.div custom={3} initial="hidden" animate="show" variants={reveal}>
              <LineItemsTable lineItems={payslip.lineItems} />
            </motion.div>
          </div>

          <motion.div
            custom={0.6}
            initial="hidden"
            animate="show"
            variants={reveal}
            className="lg:sticky lg:top-10"
          >
            <DocumentViewer pages={pages} />
          </motion.div>
        </div>
      </main>
    </ProvenanceProvider>
  );
}
