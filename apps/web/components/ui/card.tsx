import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** כרטיס בסגנון "שדה בטופס מודפס": מסגרת דקה בצבע הדיו, בלי צל. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-sm border border-ink/15 bg-surface p-6 print:break-inside-avoid', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display text-lg font-semibold text-ink', className)} {...props} />;
}
