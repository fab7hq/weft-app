// One shape for every table the viewer draws, whichever library read it:
// sheets, each a name and rows of cells. CSV is read here; a spreadsheet by
// a library loaded only when one is opened.
import { parseCsv, separatorOf } from './csv';
import type { Kind } from './kinds';
import { decode } from './text';

/** A cell as drawn: its text, and whether it is a number (set right, in mono). */
export interface Cell {
  text: string;
  number?: boolean;
}

export interface Sheet {
  name: string;
  rows: Cell[][];
}

export interface Table {
  sheets: Sheet[];
}

/** Reads a file's bytes into a table. */
export type ToTable = (bytes: Uint8Array, path: string) => Promise<Table>;

const NUMBER = /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?%?$/;

/** A text cell; one that reads as a number is set as one. */
export function textCell(text: string): Cell {
  const t = text.trim();
  return t !== '' && /\d/.test(t) && NUMBER.test(t) ? { text, number: true } : { text };
}

export const csvTable: ToTable = async (bytes, path) => ({
  sheets: [{ name: '', rows: parseCsv(decode(bytes), separatorOf(path)).map((r) => r.map(textCell)) }],
});

/** A spreadsheet (xlsx, xls, xlsb, ods): read by hucre, imported on first use. */
export const sheetTable: ToTable = async (bytes) => {
  const { read } = await import('hucre');
  const book = await read(bytes);
  return { sheets: book.sheets.map((s) => ({ name: s.name, rows: s.rows.map((r) => r.map(valueCell)) })) };
};

const numbers = new Intl.NumberFormat(undefined, { maximumFractionDigits: 10 });

/** A spreadsheet's value as drawn: numbers grouped, dates as the day (and the time when it has one). */
export function valueCell(v: unknown): Cell {
  if (v === null || v === undefined) return { text: '' };
  if (typeof v === 'number') return { text: numbers.format(v), number: true };
  if (typeof v === 'boolean') return { text: v ? 'TRUE' : 'FALSE' };
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return { text: '' };
    const iso = v.toISOString();
    return { text: iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 16).replace('T', ' '), number: true };
  }
  return textCell(String(v));
}

/** The reader of each kind drawn as a table. */
export const TO_TABLE: Partial<Record<Kind, ToTable>> = { csv: csvTable, sheet: sheetTable };

/** A sheet's size as `rows × columns` counts it: every row, and its widest. */
export function extent(sheet: Sheet): { rows: number; columns: number } {
  return { rows: sheet.rows.length, columns: sheet.rows.reduce((n, r) => Math.max(n, r.length), 0) };
}
