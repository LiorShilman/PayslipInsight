import { describe, expect, it } from 'vitest';
import { assertPageCountWithinLimit, validateFileBuffer } from '../src/ingest.js';
import { IngestError } from '../src/types.js';

function bytes(...values: number[]): Buffer {
  return Buffer.from(values);
}

describe('validateFileBuffer', () => {
  it('detects a PDF by magic bytes', () => {
    const buf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(10)]);
    expect(validateFileBuffer(buf)).toBe('pdf');
  });

  it('detects a PNG by magic bytes', () => {
    const buf = Buffer.concat([bytes(0x89, 0x50, 0x4e, 0x47), Buffer.alloc(10)]);
    expect(validateFileBuffer(buf)).toBe('png');
  });

  it('detects a JPEG by magic bytes', () => {
    const buf = Buffer.concat([bytes(0xff, 0xd8, 0xff), Buffer.alloc(10)]);
    expect(validateFileBuffer(buf)).toBe('jpeg');
  });

  it('rejects a file whose extension lies about its content', () => {
    const buf = Buffer.from('this is actually a text file, not a pdf');
    expect(() => validateFileBuffer(buf)).toThrow(IngestError);
    try {
      validateFileBuffer(buf);
    } catch (err) {
      expect(err).toBeInstanceOf(IngestError);
      expect((err as IngestError).code).toBe('UNSUPPORTED_FORMAT');
    }
  });

  it('rejects a file larger than the size limit', () => {
    const oversized = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(11 * 1024 * 1024)]);
    try {
      validateFileBuffer(oversized);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(IngestError);
      expect((err as IngestError).code).toBe('FILE_TOO_LARGE');
    }
  });
});

describe('assertPageCountWithinLimit', () => {
  it('passes for 5 pages or fewer', () => {
    expect(() => assertPageCountWithinLimit(5)).not.toThrow();
  });

  it('throws TOO_MANY_PAGES above the limit', () => {
    try {
      assertPageCountWithinLimit(6);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(IngestError);
      expect((err as IngestError).code).toBe('TOO_MANY_PAGES');
    }
  });
});
