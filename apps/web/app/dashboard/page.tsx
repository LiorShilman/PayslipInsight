'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Form106Dashboard } from '@/components/dashboards/Form106Dashboard';
import { PayslipDashboard } from '@/components/dashboards/PayslipDashboard';
import { PersonalInfoReportDashboard } from '@/components/dashboards/PersonalInfoReportDashboard';
import type { ExtractionResult } from '@/lib/types';

/**
 * ראוטר דק: קורא את התוצאה מ-sessionStorage ומפצל לפי docType לדשבורד
 * המתאים. SPEC.md §10 — "הוספת סוג מסמך = ... קומפוננטות. הליבה לא
 * משתנה" — זה בדיוק המקום שמממש את זה: כל היגיון התצוגה חי בדשבורד
 * הספציפי, לא כאן.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [result, setResult] = useState<ExtractionResult | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('payslip-insight:result');
    if (!raw) {
      router.replace('/');
      return;
    }
    setResult(JSON.parse(raw) as ExtractionResult);
  }, [router]);

  if (!result) return null;

  if (result.docType === 'form_106') {
    return <Form106Dashboard result={result} />;
  }
  if (result.docType === 'personal_info_report') {
    return <PersonalInfoReportDashboard result={result} />;
  }
  return <PayslipDashboard result={result} />;
}
