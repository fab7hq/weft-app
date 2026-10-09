// The Eval view (M6.1–M6.7, D6.1–D6.7): the TUI's, read from the machine by
// its Eval, as pages you drill into. Each fold of the TUI is a page; the crumb goes back.
// While the Eval runs the header counts the judges' stages, read again.
import { useEffect, useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { back, go, leave, stack, swap } from '../nav';
import { w } from '../words';

type State = 'met' | 'not_met' | 'unsettled' | 'judging' | { read: string } | null;

interface Row {
  kind: 'heading' | 'text' | 'group' | 'step' | 'change';
  key: string;
  depth: number;
  mark: string;
  text: string;
  aside: string;
  state: State;
}

interface View {
  eval_id: string;
  closed: boolean;
  header: string;
  by_step: Row[];
  by_file: Row[];
  steps: Record<string, Row[]>;
  changes: Record<string, { n: number | null; text: string; lit: boolean }[]>;
}

/** The sections the Mac heads its rows with, by word. */
const HEADINGS = ['findings', 'unexplained', 'checks', 'limitations'];
const headingOf = (r: Row) => HEADINGS.find((k) => w(`eval_view.${k}`).toUpperCase() === r.text);

/** The rows under the depth-0 row at `at`. */
function under(rows: Row[], at: number): Row[] {
  const out: Row[] = [];
  for (let i = at + 1; i < rows.length && rows[i].depth > 0; i++) out.push(rows[i]);
  return out;
}

/** Each part of an aside, amber where it is what needs reading. */
function Aside({ text, needs = false }: { text: string; needs?: boolean }) {
  const parts = text.split(' · ');
  return (
    <span class="eval-aside">
      {parts.map((p, i) => (
        <span key={i} class={needs || p.endsWith(w('eval.not_met')) || p.includes('unexplained') ? 'needs' : undefined}>
          {(i ? ' · ' : '') + p}
        </span>
      ))}
    </span>
  );
}

function markTone(state: State): string {
  const s = state && typeof state === 'object' ? state.read : state;
  return s === 'met' ? 'good' : s === 'not_met' ? 'needs' : 'dim';
}

function Mark({ row }: { row: Row }) {
  if (!row.mark || row.kind === 'change' || row.kind === 'group') return null;
  return <span class={`eval-mark ${markTone(row.state)}`}>{`${row.mark} `}</span>;
}

/** A change's place reads with one space, as the card writes it. */
const said = (row: Row) => (row.kind === 'change' ? row.text.replace(/ {2,}/g, ' ') : row.text);

/** A row to open, or to read. */
function Item({ row, open, needs }: { row: Row; open?: () => void; needs?: boolean }) {
  const body = (
    <>
      <span class="eval-text">
        <Mark row={row} />
        {said(row)}
      </span>
      <Aside text={row.aside} needs={needs} />
      {open && <span class="eval-more">›</span>}
    </>
  );
  return open ? (
    <button class="eval-row" type="button" onClick={open}>{body}</button>
  ) : (
    <div class="eval-row eval-row--read">{body}</div>
  );
}

/** A page's title: what the crumb back to it says. */
function titleOf(v: View, at: string | undefined): string {
  if (!at) return w('act.eval_view');
  if (at.startsWith('h:')) return w(`eval_view.${at.slice(2)}`);
  if (at.startsWith('s:')) return w('eval_view.a_step');
  const row = [...v.by_step, ...v.by_file].find((r) => r.key === at);
  return row?.text.split(' · ')[0] ?? '';
}

export function EvalView({ machine, project, eval: id, at, files = false, wide = false }: { machine: Machine; project: string; eval: string; at?: string; files?: boolean; wide?: boolean }) {
  const [v, setV] = useState<View | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    void m.request({ type: 'read', what: 'eval_view', project, eval: id })?.then((a) => a.type === 'ok' && setV(a.eval_view as View));
  }, [id, tick]);
  // While the Eval runs, read it again as the judges record.
  useEffect(() => {
    if (!v || v.closed) return;
    const t = setTimeout(() => setTick((n) => n + 1), 2000);
    return () => clearTimeout(t);
  }, [v]);
  const open = (key: string) => go({ name: 'eval', machine: machine.id, project, eval: id, at: key, files });
  const before = stack.value[stack.value.length - 2];
  const crumb = before?.name === 'eval' && v ? titleOf(v, before.at) : w('web.detail.title');

  let page = null;
  if (v) {
    const rows = files ? v.by_file : v.by_step;
    if (!at) {
      const live = !v.closed;
      const parts = v.header.split(' · ');
      page = (
        <>
          <div class="eval-head">
            {live ? (
              <strong>{v.header}</strong>
            ) : (
              <strong>
                <span class={parts[0] === 'aligned' ? 'good' : 'needs'}>{parts[0]}</span>
                {parts.slice(1, 2).map((p) => ` · ${p}`)}
              </strong>
            )}
            <span class="dim">{live ? w('web.eval.live') : parts.slice(2).join(' · ')}</span>
          </div>
          <div class="eval-chips">
            {[false, true].map((f) => (
              <button key={String(f)} class={f === files ? 'eval-chip eval-chip--on' : 'eval-chip'} type="button" aria-pressed={f === files}
                onClick={() => swap({ name: 'eval', machine: machine.id, project, eval: id, files: f })}>
                {w(f ? 'eval_view.by_file' : 'eval_view.by_step')}
              </button>
            ))}
          </div>
          <div class="eval-rows">
            {rows.map((r, i) => {
              if (r.depth > 0) return null;
              const h = headingOf(r);
              if (h) {
                const n = under(rows, i).length;
                return <Item key={r.text} row={{ ...r, text: w(`eval_view.${h}`), aside: String(n) }} needs={h === 'unexplained'} open={() => open(`h:${h}`)} />;
              }
              return <Item key={r.key} row={r} open={() => open(r.key)} />;
            })}
          </div>
        </>
      );
    } else if (at.startsWith('c:')) {
      const lines = v.changes[at.slice(2)] ?? [];
      const row = [...v.by_step, ...v.by_file, ...Object.values(v.steps).flat()].find((r) => r.key === at);
      // The numbers as wide as the widest, so the lines stand in one column.
      const width = Math.max(0, ...lines.map((l) => `${l.n ?? ''}`.length));
      page = (
        <div class="eval-change">
          <div class="eval-head"><strong>{row && said(row)}</strong></div>
          <pre class="eval-code">
            {lines.map((l, i) => {
              const tag = l.text[0];
              return (
                <div key={i}>
                  {`${l.n ?? ''}`.padStart(width)}{' '}
                  <span class={tag === '+' ? 'good' : tag === '-' ? 'needs' : undefined}>{tag === '+' || tag === '-' ? tag : ' '}</span>
                  <span class={l.lit ? 'eval-lit' : undefined}>{l.text.slice(1)}</span>
                </div>
              );
            })}
          </pre>
          {!wide && <p class="eval-caption">{w('web.eval.quoted')}</p>}
        </div>
      );
    } else if (at.startsWith('s:')) {
      const [first, ...rest] = v.steps[at.slice(2)] ?? [];
      // What the step asks, before the first heading, is read dim.
      const heads = rest.findIndex((r) => r.kind === 'heading');
      const step = v.by_step.find((r) => r.key === at);
      page = (
        <>
          <div class="eval-head">
            <strong>{first && <Mark row={first} />}{first?.text}</strong>
            <span class="dim">{step?.aside ?? first?.aside}</span>
          </div>
          {/* What the step says, in one block; its changes as rows to open. */}
          {rest.reduce<{ change: boolean; rows: [Row, number][] }[]>((runs, r, i) => {
            const change = r.kind === 'change';
            const last = runs[runs.length - 1];
            if (last && last.change === change) last.rows.push([r, i]);
            else runs.push({ change, rows: [[r, i]] });
            return runs;
          }, []).map((run) =>
            run.change ? (
              <div key={run.rows[0][1]} class="eval-rows">
                {run.rows.map(([r, i]) => <Item key={i} row={r} open={() => open(r.key)} />)}
              </div>
            ) : (
              <div key={run.rows[0][1]} class="eval-step">
                {run.rows.map(([r, i]) =>
                  r.kind === 'heading' ? <span key={i} class="eval-label">{r.text}</span> : (
                    <p key={i} class={`eval-line${r.depth > 1 || i < heads ? ' dim' : ''}${r.depth > 1 ? ' eval-under' : ''}`}>
                      {r.text.replace(/ {2,}/, ' — ')}
                      {r.aside && ` · ${r.aside}`}
                    </p>
                  ),
                )}
              </div>
            ),
          )}
        </>
      );
    } else {
      // A section, a group or a file: its rows.
      const h = at.startsWith('h:') ? at.slice(2) : null;
      const i = rows.findIndex((r) => (h ? headingOf(r) === h : r.key === at));
      const head = rows[i];
      page = (
        <>
          <div class="eval-head">
            <strong>{h ? w(`eval_view.${h}`) : head?.text}</strong>
            <span class="dim">{h === 'findings' ? w('web.eval.findings') : head?.aside}</span>
          </div>
          <div class="eval-rows">
            {i >= 0 && under(rows, i).map((r, j) => <Item key={j} row={r} open={r.key ? () => open(r.key) : undefined} />)}
          </div>
        </>
      );
    }
  }

  const top = (
    <div class={wide ? 'detail-top eval-top' : 'appbar eval-top'}>
      <button class="back" type="button" onClick={back}>{`‹ ${crumb}`}</button>
      <span class="spacer" />
      <span class="dim eval-id">{v?.eval_id}</span>
    </div>
  );
  if (wide) {
    return (
      <div class="detail-pane" role="region" aria-label={w('act.eval_view')}>
        {top}
        <div class="detail eval eval--wide">{page}</div>
        <div class="detail-acts detail-acts--wide">
          <span class="dim eval-hint">{w('web.eval.click')}</span>
          <span class="spacer" />
          <button class="tree-act" type="button" onClick={() => leave(['eval', 'round', 'seal', 'detail', 'session', 'earlier'])}>{w('act.close')}</button>
        </div>
      </div>
    );
  }
  return (
    <div class="app">
      {top}
      <div class="page eval-page" role="region" aria-label={w('act.eval_view')}>
        <div class="detail eval">{page}</div>
      </div>
    </div>
  );
}

