// Undo (17.17): one dialog, in the bar's place. It lists the project's
// commits from the one the work's first Ask was sent on up to now, newest
// first, that one picked already; the person may pick a later one, and Undo
// has the work's agent put the code back to it.
import { signal } from '@preact/signals';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { commitCount, commitsRead, undoMessage, type Commit } from '../offers';
import { w } from '../words';
import { said } from './Bar';

/** The work being undone, and its commits. */
export const undoing = signal<{ project: string; unit: string; commits: Commit[] } | null>(null);

/** Read the commits Undo offers, then open its dialog. */
export async function undo(project: string, unit: string): Promise<void> {
  const answer = await m.request(commitsRead(project, unit));
  if (answer?.type !== 'ok') return void (said.value = String(answer?.message ?? w('web.why.not_connected')));
  const commits = (answer.commits as { commits: Commit[] }).commits;
  if (commits.some((c) => c.start)) undoing.value = { project, unit, commits };
}

export function UndoDialog() {
  const on = undoing.value;
  const [picked, setPicked] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const chosen = on?.commits.find((c) => c.id === picked) ?? on?.commits.find((c) => c.start);
  const close = () => {
    undoing.value = null;
    setPicked(null);
  };
  // The list can be long: it opens on the commit picked, at its foot.
  useLayoutEffect(() => {
    list.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest' });
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [on?.unit]);
  if (!on || !chosen) return null;
  const go = async () => {
    const answer = await m.request({ type: 'act', ...undoMessage(on.project, on.unit, chosen.id) });
    close();
    if (answer?.type === 'error') said.value = String(answer.message);
  };
  return (
    <div class="pending-bar undo-bar" role="dialog" aria-label={w('dialog.undo.title')}>
      <div class="pending-head">
        <span class="pending-what">{w('dialog.undo.title')}</span>
      </div>
      <div class="undo-put">
        <div class="undo-label">
          <span class="ask-eyebrow">{w('dialog.undo.put_back')}</span>
          <span class="undo-count">{commitCount(on.commits.length)}</span>
        </div>
        <div class="undo-commits" role="radiogroup" aria-label={w('dialog.undo.put_back')} ref={list}>
          {on.commits.map((c) => (
            <button key={c.id} type="button" class="undo-commit" role="radio" aria-checked={c.id === chosen.id} onClick={() => setPicked(c.id)}>
              <span class="undo-dot" />
              <span class="undo-short">{c.short}</span>
              <span class="undo-subject">{c.subject}</span>
              {c.start && <span class="undo-started">{w('dialog.undo.started')}</span>}
              <span class="undo-when">{c.when}</span>
            </button>
          ))}
        </div>
      </div>
      <div class="pending-acts">
        <span class="spacer" />
        <button type="button" class="tree-act" onClick={close}>{w('act.cancel')}</button>
        <button type="button" class="tree-act tree-act--warn" onClick={() => void go()}>{w('offer.undo')}</button>
      </div>
    </div>
  );
}
