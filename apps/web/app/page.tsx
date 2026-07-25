'use client';

import { FileText, Lock, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ProcessingStages, type Stage } from '@/components/ProcessingStages';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ApiError } from '@/lib/types';

type Status = 'idle' | 'processing' | 'needs_password' | 'error';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('reading');
  const [labels, setLabels] = useState<string[]>([]);

  async function submit(file: File, passwordValue?: string) {
    setStatus('processing');
    setErrorMessage(null);
    setStage('reading');
    setLabels([]);

    const formData = new FormData();
    formData.append('file', file);
    if (passwordValue) formData.append('password', passwordValue);

    try {
      const response = await fetch('/api/documents', { method: 'POST', body: formData });

      // תגובה שלא-SSE מגיעה רק משגיאות לפני שהחילוץ התחיל (סיסמה, קובץ לא תקין) —
      // ראה app/api/documents/route.ts. מ-extract ואילך זה תמיד text/event-stream.
      if (!(response.headers.get('content-type') ?? '').includes('text/event-stream')) {
        const apiError = (await response.json()) as ApiError;
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

      const reader = response.body?.getReader();
      if (!reader) throw new Error('no response body');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const raw of events) {
          const eventName = raw.match(/^event: (.+)$/m)?.[1];
          const dataRaw = raw.match(/^data: (.+)$/m)?.[1];
          if (!eventName || !dataRaw) continue;
          const data = JSON.parse(dataRaw);

          if (eventName === 'stage') {
            setStage(data.stage as Stage);
          } else if (eventName === 'progress') {
            setLabels((prev) => [...prev, data.label as string]);
          } else if (eventName === 'done') {
            sessionStorage.setItem('payslip-insight:result', JSON.stringify(data));
            router.push('/dashboard');
            return;
          } else if (eventName === 'error') {
            setErrorMessage(data.messageHe as string);
            setStatus('error');
            return;
          }
        }
      }
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
        <ProcessingStages stage={stage} labels={labels} />
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
