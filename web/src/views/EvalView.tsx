// The Eval view (M6.1–M6.7, D6.1–D6.7, 17.6): one line per item, what to look
// at first, then what is settled. On a desktop the list beside the chosen
// item's detail; on a phone the list, then each item on its own page. An item
// opens to the lines that show it. While the Eval runs, its ring of reads, and
// the list fills in as the reads come back.
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Machine } from '../api';
import { type EvalDetail, type Item, MARK, type Payload, aside, chosen, pageOf, place, sections, tint, toItem, toLines, windowsOf } from '../evalview';
import * as m from '../machine';
import { back, go, leave, swap } from '../nav';
import { fill, w } from '../words';
import { acting } from './Asked';
import { sealRound } from './Bar';
import { useRead } from './Details';
import { Reading, Running, StopEval } from './Running';
import { evalName } from './Tree';

/** The item last opened on a phone, by Eval: its line stays chosen in the list. */
const opened = signal<Record<string, string>>({});

/** One dot per read, in the kind's colour: filled when that read agrees. */
export function Dots({ dots }: { dots: boolean[] }) {
  return (
    <span class="ev-dots" aria-hidden="true">
      {dots.map((on, i) => (
        <svg key={i} class={on ? 'ev-dot on' : 'ev-dot'} width="7" height="7" viewBox="0 0 7 7">
          <circle cx="3.5" cy="3.5" r="2.75" fill={on ? 'var(--c)' : 'none'} stroke="var(--c)" stroke-width="1.5" />
        </svg>
      ))}
    </span>
  );
}

/** One line: its mark, its text, then its dots or that it is being read again. */
function Row({ item, on, chevron, open }: { item: Item; on: boolean; chevron: boolean; open: () => void }) {
  const end = aside(item);
  return (
    <button class={on ? 'ev-row ev-row--on' : 'ev-row'} style={tint(item.kind)} type="button" aria-current={on || undefined} aria-label={item.text} data-kind={item.kind} onClick={open}>
      <span class="ev-mark">{MARK[item.kind]}</span>
      <span class="ev-text">{item.text}</span>
      {end && ('again' in end ? <span class="faint ev-again">{w('eval_view.reading_again')}</span> : <Dots dots={end.dots} />)}
      {chevron && <span class="ev-chev" aria-hidden="true">›</span>}
    </button>
  );
}

/** What to look at, a divider, what is settled; while the first read is out, only what is there. */
function List({ v, on, chevrons, open }: { v: Payload; on: string | null; chevrons: boolean; open: (key: string) => void }) {
  const { look, settled } = sections(v.items);
  const row = (i: Item) => <Row key={i.key} item={i} on={i.key === on} chevron={chevrons} open={() => open(i.key)} />;
  return (
    <div class="ev-items" role="list" aria-label={w('eval_view.to_look_at')}>
      {(look.length > 0 || v.waiting) && <div class="ev-sec">{w('eval_view.to_look_at')}</div>}
      {look.map(row)}
      {v.waiting && <p class="faint ev-rest">{w('eval_view.rest_later')}</p>}
      {settled.length > 0 && (
        <>
          {look.length > 0 && <div class="ev-div" />}
          <div class="ev-sec">{w('eval_view.settled')}</div>
          {settled.map(row)}
        </>
      )}
    </div>
  );
}

/** An item: what it is, the sentence, why, how sure, what the agent said, what would settle it, and where to read more. */
function Detail({ item, lines }: { item: Item; lines: () => void }) {
  const [reads, setReads] = useState(false);
  return (
    <div class="ev-detail" style={tint(item.kind)}>
      <div class="ev-head">{`${MARK[item.kind]} ${item.head}`}</div>
      <div class="ev-big">{item.big}</div>
      {item.why.map((p, i) => <p key={i} class="ev-why">{p}</p>)}
      {item.again ? (
        <p class="faint ev-sure">{w('eval_view.reading_again')}</p>
      ) : (item.dots.length > 0 || item.sure) && (
        <div class="ev-sure"><Dots dots={item.dots} /><span class="faint">{item.sure}</span></div>
      )}
      {item.said && <p class="ev-why ev-said">{fill('eval_view.agent_said', { quote: item.said })}</p>}
      {item.check && <p class="ev-why">{item.check}</p>}
      {(item.windows.length > 0 || item.reads.length > 0) && (
        <div class="ev-links">
          {item.windows.length > 0 && <button class="ev-link" type="button" onClick={lines}>{`${w('eval_view.lines')} ›`}</button>}
          {item.reads.length > 0 && (
            <button class="ev-link" type="button" aria-expanded={reads} onClick={() => setReads(!reads)}>{`${w('eval_view.reads')} ${reads ? '⌄' : '›'}`}</button>
          )}
        </div>
      )}
      {reads && (
        <div class="ev-reads">
          {item.reads.map((r) => <p key={r.who} class="ev-read"><span class="faint">{`${r.who} · `}</span>{r.said}</p>)}
        </div>
      )}
    </div>
  );
}

/** The lines that show an item: each change's file, then its numbered lines, those the reads quoted brighter. */
function LinesOf({ v, item, wide, backTo }: { v: Payload; item: Item; wide: boolean; backTo?: () => void }) {
  return (
    <div class="ev-detail ev-lines" style={tint(item.kind)}>
      <div class="ev-head">{`${MARK[item.kind]} ${fill('eval_view.lines_of', { kind: w(`eval_view.kind.${item.kind}`) })}`}</div>
      {backTo && <button class="ev-link ev-link--back" type="button" onClick={backTo}>{`‹ ${item.text}`}</button>}
      {windowsOf(v, item).map((l) => (
        <div key={l.path} class="ev-window">
          {!wide && <div class="faint">{l.path}</div>}
          <pre class="ev-code">
            {wide && <span class="faint">{l.path}{'\n'}</span>}
            {l.lines.map((line, i) => (
              <span key={i} class="ev-line">
                <span class="ev-n">{line.n ?? ''}</span>
                {/* The diff's mark stays as it is; the quoted words are brighter. */}
                {line.lit ? <>{line.text.slice(0, 1)}<b>{line.text.slice(1)}</b></> : line.text}
                {'\n'}
              </span>
            ))}
          </pre>
        </div>
      ))}
      <p class="faint ev-quoted">{w('eval_view.quoted')}</p>
    </div>
  );
}

export function EvalView({ machine, project, eval: id, at, wide = false }: { machine: Machine; project: string; eval: string; at?: string; wide?: boolean }) {
  const [v, setV] = useState<Payload | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    void m.request({ type: 'read', what: 'eval_view', project, eval: id })?.then((a) => a.type === 'ok' && setV(a.eval_view as Payload));
  }, [id, tick]);
  // While the Eval runs, read it again as the reads come back.
  useEffect(() => {
    if (!v || v.closed) return;
    const t = setTimeout(() => setTick((n) => n + 1), 2000);
    return () => clearTimeout(t);
  }, [v]);
  const d = useRead<EvalDetail>({ project, eval: id }, 'eval', [v?.closed]);
  const page = pageOf(at);
  const running = !!v && !v.closed && !!v.progress;
  const to = (where: string, push: boolean) => (push ? go : swap)({ name: 'eval', machine: machine.id, project, eval: id, at: where });
  const leaveView = () => leave(['eval']);
  const seal = d && (
    <button class="tree-act tree-act--go ev-seal" type="button" aria-busy={acting.value === 'seal' || undefined}
      onClick={() => void sealRound(project, d.eval, d.seal, { title: evalName(d.n), asks: d.asks.length })}>{`${w('act.seal')}…`}</button>
  );
  const foot = running ? <StopEval project={project} eval={id} /> : v?.closed ? seal : null;
  const crumb = (
    <>
      <button class="back ev-back" type="button" onClick={leaveView}>{`‹ ${v?.title ?? ''}`}</button>
      <span class="spacer" />
      {d && <span class="faint ev-n-of">{evalName(d.n)}</span>}
    </>
  );

  if (wide) {
    const key = page.name === 'list' ? (running ? null : chosen(v?.items ?? [])?.key ?? null) : page.key;
    const item = v && key ? v.items.find((i) => i.key === key) ?? null : null;
    let right: ComponentChildren = null;
    if (v && page.name === 'lines' && item) right = <LinesOf v={v} item={item} wide backTo={() => to(toItem(item.key), false)} />;
    else if (v && item) right = <Detail key={item.key} item={item} lines={() => to(toLines(item.key), false)} />;
    else if (v?.progress && running) right = <Running machine={machine} eval={id} progress={v.progress} wide />;
    return (
      <div class="detail-pane ev ev--wide" role="region" aria-label={w('act.eval_view')}>
        <div class="ev-body">
          <div class="ev-side">
            <div class="ev-crumb">{crumb}</div>
            {v && <List v={v} on={key} chevrons={false} open={(k) => to(toItem(k), false)} />}
          </div>
          <div class="ev-pane">{right}</div>
        </div>
        <div class="detail-acts ev-foot">
          <button class="ev-close" type="button" onClick={leaveView}>{w('act.close')}</button>
          <span class="spacer" />
          {foot}
        </div>
      </div>
    );
  }

  // A phone: the list, then each item on its own page, then its lines.
  let top: ComponentChildren = crumb;
  let body: ComponentChildren = null;
  const item = v && page.name !== 'list' ? v.items.find((i) => i.key === page.key) ?? null : null;
  if (v && item && page.name === 'item') {
    const { k, n } = place(v.items, item);
    top = (
      <>
        <button class="back ev-back" type="button" onClick={back}>{`‹ ${w('eval_view.items')}`}</button>
        <span class="spacer" />
        <span class="faint ev-n-of">{fill('eval_view.place', { k: String(k), n: String(n) })}</span>
      </>
    );
    body = <Detail key={item.key} item={item} lines={() => to(toLines(item.key), true)} />;
  } else if (v && item && page.name === 'lines') {
    top = <button class="back ev-back ev-back--long" type="button" onClick={back}>{`‹ ${item.text}`}</button>;
    body = <LinesOf v={v} item={item} wide={false} />;
  } else if (v) {
    const open = (k: string) => {
      opened.value = { ...opened.value, [id]: k };
      to(toItem(k), true);
    };
    const small = running && !v.waiting;
    body = (
      <>
        {running && v.progress && <Running machine={machine} eval={id} progress={v.progress} wide={false} small={small} />}
        <div class={running && v.waiting ? 'ev-under' : undefined}>
          <List v={v} on={running ? null : opened.value[id] ?? null} chevrons={!running} open={open} />
        </div>
        {small && v.progress && <Reading machine={machine} eval={id} progress={v.progress} />}
      </>
    );
  }
  return (
    <div class="app">
      <div class="appbar ev-bar">{top}</div>
      <div class="page ev-page" role="region" aria-label={w('act.eval_view')}>
        <div class={running && !v?.waiting ? 'ev ev--running' : 'ev'}>{body}</div>
      </div>
      {page.name === 'list' && foot && <div class="detail-foot ev-foot-phone"><div class="detail-acts">{foot}</div></div>}
    </div>
  );
}
