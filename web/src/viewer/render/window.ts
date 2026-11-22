// Only the lines or rows in sight are drawn, and a few around them: a file
// of any length scrolls as one of a screenful.
import { useEffect, useState, type MutableRef } from 'preact/hooks';

/** The rows to draw, `first` up to (not including) `last`, for a view scrolled to `top`. */
export function windowOf(top: number, height: number, count: number, rowHeight: number, around = 20): { first: number; last: number } {
  const first = Math.max(0, Math.floor(top / rowHeight) - around);
  const last = Math.min(count, Math.ceil((top + height) / rowHeight) + around);
  return { first, last: Math.max(first, last) };
}

/** The rows of `count` in sight in the scrolled element `box`, kept as it scrolls or changes size. */
export function useWindow(box: MutableRef<HTMLElement | null>, count: number, rowHeight: number, offset = 0): { first: number; last: number } {
  const [view, setView] = useState({ top: 0, height: 800 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const look = () => setView({ top: Math.max(0, el.scrollTop - offset), height: el.clientHeight });
    look();
    el.addEventListener('scroll', look, { passive: true });
    const seen = new ResizeObserver(look);
    seen.observe(el);
    return () => {
      el.removeEventListener('scroll', look);
      seen.disconnect();
    };
  }, [offset]);
  return windowOf(view.top, view.height, count, rowHeight);
}

/** Each line's width in characters, a tab counted as up to the next stop of 4. */
export function widthsOf(lines: string[]): Int32Array {
  const out = new Int32Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.indexOf('\t') < 0) {
      out[i] = l.length;
      continue;
    }
    let w = 0;
    for (const c of l) w = c === '\t' ? w + 4 - (w % 4) : w + 1;
    out[i] = w;
  }
  return out;
}

/** Where each line starts, in rows, when lines wrap at `columns` characters: one more entry than lines, the last the total. */
export function rowsOf(widths: Int32Array, columns: number): Float64Array {
  const out = new Float64Array(widths.length + 1);
  for (let i = 0; i < widths.length; i++) out[i + 1] = out[i] + Math.max(1, Math.ceil(widths[i] / columns));
  return out;
}

/** The lines to draw for a view scrolled to `top`: `first` up to `last`, the rows above the first, and every row.
 * Without `rows`, each line is one row. */
export function spanOf(rows: Float64Array | null, count: number, top: number, height: number, rowHeight: number, around = 20): { first: number; last: number; before: number; total: number } {
  if (!rows) {
    const w = windowOf(top, height, count, rowHeight, around);
    return { ...w, before: w.first, total: count };
  }
  const at = (row: number) => {
    // The line holding this row.
    let lo = 0;
    let hi = count;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (rows[mid] <= row) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const first = Math.max(0, at(top / rowHeight) - around);
  const last = Math.min(count, at((top + height) / rowHeight) + 1 + around);
  return { first, last: Math.max(first, last), before: rows[first], total: rows[count] };
}
