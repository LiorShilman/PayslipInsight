'use client';

import { useEffect, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import type { DocumentPage } from '@/lib/types';
import { useProvenance } from '@/lib/provenance-context';

type Props = { pages: DocumentPage[] };

/** SPEC.md §8.2 — תצוגת המסמך המקורי עם הדגשת bbox לפי provenance. */
export function DocumentViewer({ pages }: Props) {
  const { highlighted } = useProvenance();
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (highlighted) setPageIndex(highlighted.page);
  }, [highlighted]);

  const page = pages[pageIndex];
  if (!page) return null;

  const showOverlay = highlighted && highlighted.page === pageIndex;
  const [x0, y0, x1, y1] = highlighted?.bbox ?? [0, 0, 0, 0];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>המסמך המקורי</CardTitle>
        {pages.length > 1 && (
          <div className="flex items-center gap-2 text-sm print:hidden">
            <button
              type="button"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              className="rounded-sm border border-ink/20 px-2 py-1 disabled:opacity-30"
              aria-label="עמוד קודם"
            >
              →
            </button>
            <span className="text-ink-muted">
              עמוד {pageIndex + 1} / {pages.length}
            </span>
            <button
              type="button"
              disabled={pageIndex === pages.length - 1}
              onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
              className="rounded-sm border border-ink/20 px-2 py-1 disabled:opacity-30"
              aria-label="עמוד הבא"
            >
              ←
            </button>
          </div>
        )}
      </div>

      <div className="relative mt-4 overflow-hidden rounded-sm border border-ink/10 bg-paper">
        {/* data URI base64, לא נכס סטטי — next/image לא רלוונטי כאן */}
        <img
          src={`data:image/png;base64,${page.png}`}
          alt={`עמוד ${pageIndex + 1} מהתלוש`}
          className="block w-full"
        />
        {showOverlay && (
          <div
            className="pointer-events-none absolute border-2 border-accent bg-accent/15 transition-all"
            style={{
              left: `${x0 * 100}%`,
              top: `${y0 * 100}%`,
              width: `${Math.max(0, x1 - x0) * 100}%`,
              height: `${Math.max(0, y1 - y0) * 100}%`,
            }}
          />
        )}
      </div>
      {highlighted && (
        <p className="mt-2 text-xs text-ink-muted">
          מקור: &ldquo;{highlighted.rawText}&rdquo; · ביטחון {Math.round(highlighted.confidence * 100)}%
        </p>
      )}
    </Card>
  );
}
