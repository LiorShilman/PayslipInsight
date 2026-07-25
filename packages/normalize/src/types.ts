/** מקטע טקסט בודד שחולץ משכבת הטקסט של PDF, עם קואורדינטות מנורמלות. */
export type TextSpan = {
  text: string;
  /** x0,y0,x1,y1 מנורמל 0-1 ביחס לגודל העמוד. */
  bbox: [number, number, number, number];
};

export type NormalizedPage = {
  index: number;
  /** נקודות (points), 72 ליחידה — כפי שמוגדר ב-PDF. */
  width: number;
  height: number;
  /** null אם אין שכבת טקסט (מסמך סרוק). */
  textLayer: TextSpan[] | null;
  /** רסטר PNG תמיד קיים, גם כשיש שכבת טקסט — ה-Vision צריך אותו. */
  rasterPng: Buffer;
};

export type NormalizedDoc = {
  pageCount: number;
  pages: NormalizedPage[];
  hasTextLayer: boolean;
};

export type IngestErrorCode =
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'PASSWORD_REQUIRED'
  | 'WRONG_PASSWORD'
  | 'TOO_MANY_PAGES';

export class IngestError extends Error {
  readonly code: IngestErrorCode;

  constructor(code: IngestErrorCode, message: string) {
    super(message);
    this.name = 'IngestError';
    this.code = code;
  }
}
