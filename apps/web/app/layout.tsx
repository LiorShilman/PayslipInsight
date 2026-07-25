import type { Metadata } from 'next';
import { Frank_Ruhl_Libre, Heebo } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const frankRuhlLibre = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['500', '700'],
  variable: '--font-frank-ruhl',
  display: 'swap',
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heebo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Payslip Insight — ניתוח תלוש שכר',
  description: 'העלה תלוש שכר וקבל ניתוח ויזואלי מיידי של לאן הלך כל שקל.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${frankRuhlLibre.variable} ${heebo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
