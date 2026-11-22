// A table: its first row a header that stays in sight, each row numbered as
// the sheet numbers it, the sheets as tabs under it with its size. Only the
// rows in sight are drawn; it scrolls both ways.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fill } from '../../words';
import type { RendererProps } from '../factory';
import { extent, TO_TABLE, type Sheet, type Table } from '../table';
import { useWindow } from './window';
import { nameOf } from '../kinds';

/** Each row's height, as the stylesheet sets it. */
const ROW = 32;

/** The widest a column is drawn, in characters; longer cells end in an ellipsis. */
const WIDEST = 40;

function Rows({ sheet }: { sheet: Sheet }) {
  const box = useRef<HTMLDivElement>(null);
  const [head, ...body] = sheet.rows;
  const { columns } = extent(sheet);
  // Each column as wide as its longest cell, up to WIDEST.
  const widths = useMemo(() => {
    const w = new Array<number>(columns).fill(3);
    for (const r of sheet.rows) r.forEach((c, i) => (w[i] = Math.max(w[i], Math.min(WIDEST, c.text.length))));
    return w;
  }, [sheet]);
  const { first, last } = useWindow(box, body.length, ROW, ROW);
  const digits = String(sheet.rows.length).length;
  const cells = (row: Sheet['rows'][number] | undefined, header: boolean) =>
    widths.map((_, i) => {
      const c = row?.[i];
      const Tag = header ? 'th' : 'td';
      return <Tag key={i} class={c?.number && !header ? 'viewer-num' : undefined} title={c && c.text.length > WIDEST ? c.text : undefined}>{c?.text ?? ''}</Tag>;
    });
  return (
    <div class="viewer-table-scroll" ref={box}>
      <table class="viewer-table" style={{ '--digits': `${digits}ch` }}>
        <colgroup>
          <col class="viewer-col-n" />
          {widths.map((n, i) => <col key={i} style={{ width: `calc(${n}ch + 22px)` }} />)}
        </colgroup>
        <thead>
          <tr>
            <th class="viewer-row-n" />
            {cells(head, true)}
          </tr>
        </thead>
        <tbody>
          {first > 0 && <tr class="viewer-gap"><td colSpan={columns + 1} style={{ height: `${first * ROW}px` }} /></tr>}
          {body.slice(first, last).map((row, n) => (
            <tr key={first + n}>
              <td class="viewer-row-n">{first + n + 2}</td>
              {cells(row, false)}
            </tr>
          ))}
          {last < body.length && <tr class="viewer-gap"><td colSpan={columns + 1} style={{ height: `${(body.length - last) * ROW}px` }} /></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function TableFile({ file, bytes, layout, ready, fail }: RendererProps) {
  const [table, setTable] = useState<Table | null>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    let gone = false;
    const read = TO_TABLE[file.kind];
    if (!read || !bytes) return void fail(new Error('no table'));
    read(bytes, file.path).then(
      (t) => !gone && (setTable(t), setAt(0), ready()),
      (e) => !gone && fail(e),
    );
    return () => void (gone = true);
  }, [bytes, file.kind]);
  if (!table) return <div />;
  const sheet = table.sheets[at] ?? { name: '', rows: [] };
  const size = extent(sheet);
  return (
    <div class="viewer-table-box">
      <Rows key={at} sheet={sheet} />
      <div class="viewer-sheets" role="tablist" aria-label={nameOf(file.path)}>
        {table.sheets.length > 1 &&
          table.sheets.map((s, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === at} class={i === at ? 'viewer-sheet viewer-sheet--on' : 'viewer-sheet'} onClick={() => setAt(i)}>
              {s.name}
            </button>
          ))}
        <span class="spacer" />
        <span class="viewer-size">{fill(layout === 'desktop' ? 'file.rows' : 'file.rows_short', { rows: size.rows.toLocaleString(), columns: size.columns.toLocaleString() })}</span>
      </div>
    </div>
  );
}
