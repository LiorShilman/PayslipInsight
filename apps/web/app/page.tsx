'use client';

import { FileText, Lock, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ProcessingStages } from '@/components/ProcessingStages';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ApiError, ExtractionResult } from '@/lib/types';

type Status = 'idle' | 'processing' | 'needs_password' | 'error';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(file: File, passwordValue?: string) {
    setStatus('processing');
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    if (passwordValue) formData.append('password', passwordValue);

    try {
      const response = await fetch('/api/documents', { method: 'POST', body: formData });
      const json: unknown = await response.json();

      if (!response.ok) {
        const apiError = json as ApiError;
        if (apiError.error.code === 'PASSWORD_REQUIRED' || apiError.error.code === 'WRONG_PASSWORD') {
          setPendingFile(file);
          setStatus('needs_password');
          setErrorMessage(apiError.error.code === 'WRONG_PASSWORD' ? apiError.error.messageHe : null);
          return;
        }
        setErrorMessage(apiError.error.messageHe);
        setStatus('error');
        return;
      }

      const result = json as ExtractionResult;
      sessionStorage.setItem('payslip-insight:result', JSON.stringify(result));
      router.push('/dashboard');
    } catch {
      setErrorMessage('שגיאת תקשורת. יש לבדוק את החיבור ולנסות שוב.');
      setStatus('error');
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void submit(file);
  }

  if (status === 'processing') {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6">
        <ProcessingStages />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <header className="mb-10 text-center">
        <p className="mb-2 text-sm font-semibold tracking-wide text-accent">Payslip Insight</p>
        <h1 className="font-display text-4xl font-semibold text-ink">מה קורה בתלוש שלך?</h1>
        <p className="mt-3 text-ink-muted">
          העלה תלוש שכר, ותוך שניות תראה בדיוק לאן הלך כל שקל — ברוטו, ניכויים, ומה המעסיק שילם מעליך.
        </p>
      </header>

      <Card className="mb-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div className="text-sm text-ink">
            <p className="font-semibold">מה קורה לנתונים שלך</p>
            <p className="mt-1 text-ink-muted">
              הקובץ נשלח לעיבוד חד-פעמי ולא נשמר בשום שרת. תעודת הזהות מוסתרת ל-4 הספרות האחרונות בלבד. סגירת
              הדפדפן מוחקת את כל מה שהוצג.
            </p>
          </div>
        </div>
      </Card>

      {status === 'needs_password' && (
        <Card className="mb-6 border-accent/40">
          <div className="flex items-start gap-3">
            <Lock className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div className="w-full">
              <p className="font-semibold text-ink">המסמך מוגן בסיסמה</p>
              {errorMessage && <p className="mt-1 text-sm text-accent-alert">{errorMessage}</p>}
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pendingFile) void submit(pendingFile, password);
                }}
              >
                <label className="sr-only" htmlFor="pdf-password">
                  סיסמת המסמך
                </label>
                <input
                  id="pdf-password"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 flex-1 rounded-sm border border-ink/20 px-3 text-sm"
                  autoFocus
                />
                <Button type="submit" size="sm">
                  המשך
                </Button>
              </form>
            </div>
          </div>
        </Card>
      )}

      {status === 'error' && errorMessage && (
        <p role="alert" className="mb-6 rounded-sm border border-accent-alert/40 bg-accent-alert-soft p-4 text-sm text-accent-alert">
          {errorMessage}
        </p>
      )}

      <label
        htmlFor="payslip-file"
        className="flex cursor-pointer flex-col items-center gap-3 rounded-sm border-2 border-dashed border-ink/25 bg-surface p-12 text-center transition-colors hover:border-accent"
      >
        <FileText className="h-8 w-8 text-accent" aria-hidden />
        <span className="font-semibold text-ink">בחר קובץ תלוש</span>
        <span className="text-sm text-ink-muted">PDF, PNG או JPG — עד 10MB</span>
        <input
          ref={fileInputRef}
          id="payslip-file"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className="sr-only"
          onChange={handleFileChange}
        />
      </label>
    </main>
  );
}
