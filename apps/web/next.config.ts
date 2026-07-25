import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // חבילות ה-monorepo הן קוד TS גולמי (בלי build step, ראה tsconfig.base.json) —
  // Next צריך רשימה מפורשת כדי לתמלל אותן.
  transpilePackages: [
    '@payslip-insight/schema',
    '@payslip-insight/core',
    '@payslip-insight/config',
    '@payslip-insight/normalize',
    '@payslip-insight/extract',
  ],
  // חבילות עם בינארי native (.node) — לא ניתנות ל-bundle ע"י webpack, צריך
  // require אמיתי בזמן ריצה בצד שרת בלבד. תבנית מתועדת של Next.js.
  serverExternalPackages: ['@napi-rs/canvas', 'sharp', 'pdfjs-dist'],
  // tsconfig.base.json משתמש ב-moduleResolution: "NodeNext", שדורש סיומת .js
  // מפורשת גם בייבוא של קובצי .ts (זו הדרישה של Node ESM עצמו). Webpack לא
  // יודע ש-"./money.js" צריך לפתור בפועל ל-money.ts בלי הכוונה מפורשת הזו.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
