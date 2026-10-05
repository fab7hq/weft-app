// A work's Details (M5.1–M5.10, D5.2–D5.7): the TUI's, read from the machine,
// in sections that fold. Proceed when its prompt waits, Follow up, Eval view.
import { useEffect, useState } from 'preact/hooks';
import type { Machine } from '../api';
import * as m from '../machine';
import { back, go } from '../nav';
import { fill, w } from '../words';
import { asking } from './Ask';
import { act } from './Asked';

interface Section {
  act: 'ask' | 'eval' | 'seal';
  state: string;
  aside: string;
  lines: string[];
  open: boolean;
}

interface Detail {
  title: string;
  harness: string;
  provenance: string;
  sections: Section[];
  proceed: boolean;
  eval_view: boolean;
  recorded: string | null;
  holds: boolean | null;
  debate_in: string | null;
  follows: string;
}

/** Where a work sits in the tree. */
const placeOf = (unit: string) => {
  for (const p of m.tree.value) for (const h of p.harnesses) for (const work of h.works) if (work.unit === unit) return { p, h, work };
  return null;
};

/** A chip's tone: amber while under way or when the receipt no longer holds, teal when it holds. */
function tone(s: Section, d: Detail): string {
  if (s.state === w('word.asking') || s.state === 'GATHERED') return 'chip chip--needs';
  if (s.act === 'seal' && s.state === 'DONE') return d.holds === false ? 'chip chip--needs' : 'chip chip--good';
  return 'chip';
}

/** The aside beside a heading, as the web says it. */
function aside(s: Section, d: Detail, open: boolean): string {
  if (s.state !== 'DONE') return s.state.toLowerCase();
  if (s.act === 'ask') return open ? '' : w('web.detail.as_typed');
  if (s.act === 'eval') return open ? s.aside.slice(s.aside.lastIndexOf(', ') + 2) : d.recorded ?? '';
  return s.aside;
}

/** A line as drawn: indented lines read as the line above them says. */
type Drawn = { text: string; dim?: boolean; under?: boolean; rest?: string; mark?: string; judges?: string[] };

/** The TUI's lines for one section, as the web draws them. */
function drawn(s: Section, d: Detail, wide: boolean): Drawn[] {
  let lines = s.lines.filter((l) => l.trim() !== '');
  if (s.state === 'GATHERED' && d.debate_in) lines = [...lines.slice(0, -1), fill('web.detail.debate_in', { harness: d.debate_in })];
  const out: Drawn[] = [];
  // The Eval's verdict is the first thing it says.
  if (s.act === 'eval' && s.state === 'DONE' && s.aside.includes(', ')) out.push({ text: s.aside.slice(0, s.aside.lastIndexOf(', ')), mark: 'needs' });
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const under: string[] = [];
    while (lines[i + 1]?.startsWith('  ')) under.push(lines[++i].trim());
    const mark = line.startsWith('✗ ') ? '✗' : line.startsWith('✓ ') ? '✓' : undefined;
    if (line.startsWith(w('eval.judge'))) {
      // The judges are behind the line that counts them.
      const last = out[out.length - 1];
      if (last) (last.judges ??= []).push(line.replace(/\s{2,}/g, '  '));
      continue;
    }
    // The Eval's and the Seal's readings are dim beside what they found; the
    // Ask's labels are dim beside the words.
    const dim = s.act !== 'ask' || line.endsWith(':') || (s.state === w('word.asking') && i === lines.length - 1);
    if (mark) {
      const said = { text: line.slice(2), mark };
      if (wide) out.push({ ...said, rest: under.map((u) => ` — ${u}`).join('') });
      else out.push(said, ...under.map((u) => ({ text: u, dim: true, under: true })));
    } else if (under.length && line === line.toUpperCase()) out.push({ text: `${line}: ${under.join(', ')}`, dim: true });
    else out.push({ text: line, dim }, ...under.map((u) => ({ text: u, dim: true, under: true })));
  }
  // On a desktop the Eval's first two readings share a line.
  if (wide && s.act === 'eval') {
    const at = out.findIndex((l) => l.judges);
    if (at > 0 && !out[at - 1].mark) out.splice(at - 1, 2, { ...out[at], text: `${out[at - 1].text} · ${out[at].text}`, dim: true });
  }
  return out;
}

function Line({ line }: { line: Drawn }) {
  const [shown, setShown] = useState(false);
  const cls = `detail-line${line.dim ? ' dim' : ''}${line.under ? ' detail-under' : ''}`;
  if (line.judges) {
    return (
      <>
        <button class={`${cls} detail-judges`} type="button" aria-expanded={shown} onClick={() => setShown(!shown)}>{line.text}</button>
        {shown && line.judges.map((j) => <p key={j} class="detail-line dim">{j}</p>)}
      </>
    );
  }
  if (line.mark === 'needs') return <p class="detail-line needs">{line.text}</p>;
  return (
    <p class={cls}>
      {line.mark && <span class={line.mark === '✗' ? 'needs' : 'good'}>{`${line.mark} `}</span>}
      {line.text}
      {line.rest && <span class="dim">{line.rest}</span>}
    </p>
  );
}

function Part({ s, d, wide }: { s: Section; d: Detail; wide: boolean }) {
  const [open, setOpen] = useState(s.open);
  return (
    <section class="detail-section" aria-label={w(`act.${s.act}`)}>
      <button class="detail-head" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span class="tree-fold">{open ? '▾' : '▸'}</span>
        <span class="detail-name">{w(`act.${s.act}`)}</span>
        <span class="spacer" />
        <span class="detail-aside">{aside(s, d, open)}</span>
      </button>
      {open && drawn(s, d, wide).map((l, i) => <Line key={i} line={l} />)}
    </section>
  );
}

export function Details({ machine, unit, wide = false }: { machine: Machine; unit: string; wide?: boolean }) {
  const [d, setD] = useState<Detail | null>(null);
  const place = placeOf(unit);
  // Read again as the work moves on.
  const at = place && JSON.stringify(place.work);
  useEffect(() => {
    void m.request({ type: 'read', what: 'detail', unit })?.then((a) => a.type === 'ok' && setD(a.detail as Detail));
  }, [unit, at]);
  const followUp = () =>
    d && (asking.value = { project: place?.p.project, agent: place?.h.agent ?? undefined, follow: { unit, title: d.title, follows: d.follows } });
  const evalView = () => go({ name: 'eval', machine: machine.id, unit });
  const acts = d && (
    <div class={wide ? 'detail-acts detail-acts--wide' : 'detail-acts'}>
      {d.proceed && (
        <button class="tree-act tree-act--go" type="button" onClick={() => void act({ act: 'proceed', unit })}>{w('act.proceed')}</button>
      )}
      <button class="tree-act" type="button" onClick={followUp}>{w('act.follow_up')}</button>
      {d.eval_view && <button class="tree-act" type="button" onClick={evalView}>{w('act.eval_view')}</button>}
      {wide && (
        <>
          <span class="spacer" />
          <button class="tree-act" type="button" onClick={back}>{w('act.close')}</button>
        </>
      )}
    </div>
  );
  const body = d && (
    <div class="detail">
      {!wide && <h2>{d.title}</h2>}
      <div class="chips">
        {(['ask', 'eval', 'seal'] as const).map((a) => {
          // Until the Ask is sent the other two have not run, and have no section.
          const s = d.sections.find((x) => x.act === a) ?? { act: a, state: "HAVEN'T RUN", aside: '', lines: [], open: false };
          return <span key={a} class={tone(s, d)}>{`${a.toUpperCase()} ${s.state}`}</span>;
        })}
      </div>
      <p class="detail-line dim">{d.provenance}</p>
      {d.sections.map((s) => <Part key={s.act} s={s} d={d} wide={wide} />)}
    </div>
  );
  if (wide) {
    return (
      <div class="detail-pane" role="region" aria-label={d?.title ?? ''}>
        <div class="detail-top">
          <strong>{d?.title}</strong>
          <span class="spacer" />
          <span class="dim">{d?.harness}</span>
        </div>
        {body}
        {acts}
      </div>
    );
  }
  return (
    <div class="app">
      <div class="appbar">
        <button class="back" type="button" onClick={back}>{`‹ ${place?.p.project ?? machine.name}`}</button>
        <span class="spacer" />
        <span class="dim">{d?.harness}</span>
      </div>
      <div class="page" role="region" aria-label={d?.title ?? ''}>{body}</div>
      {acts}
    </div>
  );
}
