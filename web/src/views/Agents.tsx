// On a phone, where the open agent is among every open project's running
// agents (web-app.md, "Agents across projects"): the header names it and
// opens the list of them; the dots under it say where it is; a swipe on
// either moves to the next or the previous one, and never scrolls the pane.
import { useRef } from 'preact/hooks';
import * as m from '../machine';
import { swap } from '../nav';
import { tabbed } from '../panes';
import { turnWord, w } from '../words';
import { notSetUp } from './Tabs';

const go = (machine: string, agent: string) => swap({ name: 'agent', machine, agent });

/** A finger moving this far, more across than down, is a swipe. */
const SWIPE = 40;

/** Touch handlers for the header and the dots: a swipe left opens the next agent, right the previous one. */
export function useSwipe(machine: string, open: string) {
  const from = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0];
      from.current = t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e: TouchEvent) => {
      const f = from.current;
      const t = e.changedTouches[0];
      from.current = null;
      if (!f || !t) return;
      const dx = t.clientX - f.x;
      if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(t.clientY - f.y)) return;
      const list = tabbed.value;
      const at = list.findIndex((a) => a.agent === open);
      const next = at < 0 ? undefined : list[at + (dx < 0 ? 1 : -1)];
      if (next) go(machine, next.agent);
    },
  };
}

/** The agent's name in the header: a tap opens the list. */
export function AgentName({ agent, onOpen }: { agent: m.Agent | undefined; onOpen: () => void }) {
  return (
    <button class="agent-name" type="button" aria-haspopup="dialog" onClick={onOpen}>
      <span class="agent-name-text">{agent ? `${agent.project} · ${agent.harness}${notSetUp(agent) ? ' ⚠' : ''}` : ''}</span>
      <span class="agent-name-more" aria-hidden="true">▾</span>
    </button>
  );
}

/** A dot for each running agent, in the tree's order: blue the one shown, amber one waiting for you. */
export function Dots({ open }: { open: string }) {
  return (
    <div class="agent-dots" aria-hidden="true">
      {tabbed.value.map((a) => (
        <span key={a.agent} class={a.agent === open ? 'agent-dot agent-dot--shown' : a.turn === 'waiting' ? 'agent-dot agent-dot--needs-you' : 'agent-dot'} />
      ))}
    </div>
  );
}

/** The list of agents: NEEDS YOU first, when any waits, then each project's, ✓ on the one shown. */
export function AgentList({ machine, open, onClose }: { machine: string; open: string; onClose: () => void }) {
  const from = useRef<number | null>(null);
  const all = tabbed.value;
  const waiting = all.filter((a) => a.turn === 'waiting');
  const projects = [...new Set(all.map((a) => a.project))];
  const pick = (agent: string) => {
    onClose();
    if (agent !== open) go(machine, agent);
  };
  const row = (a: m.Agent, named: boolean) => (
    <button
      key={a.agent}
      type="button"
      class={named ? 'agents-row' : 'agents-row agents-row--in'}
      aria-current={!named && a.agent === open ? 'true' : undefined}
      data-needs-you={a.turn === 'waiting' ? 'true' : undefined}
      onClick={() => pick(a.agent)}
    >
      <span class="agents-dot" aria-hidden="true">●</span>
      <span class="agents-name">{named ? `${a.project} · ${a.harness}` : a.harness}</span>
      <span class="agents-turn">{turnWord(a.turn)}</span>
      {!named && a.agent === open && <span class="agents-shown">✓</span>}
    </button>
  );
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        class="fab7-sheet agents-sheet"
        role="dialog"
        aria-label={w('web.agents')}
        onTouchStart={(e) => (from.current = e.touches[0]?.clientY ?? null)}
        onTouchEnd={(e) => {
          const y = e.changedTouches[0]?.clientY;
          if (from.current !== null && y !== undefined && y - from.current > 60) onClose();
          from.current = null;
        }}
      >
        <span class="agents-handle" aria-hidden="true" />
        <h2 class="agents-title">{w('web.agents')}</h2>
        {waiting.length > 0 && (
          <section aria-label={w('title.needs_you').toUpperCase()}>
            <h3 class="agents-group">{w('title.needs_you').toUpperCase()}</h3>
            {waiting.map((a) => row(a, true))}
          </section>
        )}
        {projects.map((p) => (
          <section key={p} aria-label={p}>
            <h3 class="agents-group">{p.toUpperCase()}</h3>
            {all.filter((a) => a.project === p).map((a) => row(a, false))}
          </section>
        ))}
      </div>
    </div>
  );
}
