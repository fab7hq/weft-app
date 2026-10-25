// Keep a rule (17.14, 17.15): one dialog, in the bar's place. Opening it has
// the work's agent write one rule from the follow-ups. The rule's field takes
// typing from the start: the draft fills it when it comes, unless the person
// wrote first; when none will come, the dialog says why. Cancel stops the wait.
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import * as m from '../machine';
import { keepMessage, offerMessage } from '../offers';
import { fill, w } from '../words';
import { said } from './Bar';

/** The work a rule is being kept from, and what the dialog names it by. */
export const keeping = signal<{ project: string; unit: string; harness: string; title: string } | null>(null);

/** Open the dialog and have the work's agent write the draft. */
export async function keepRule(project: string, unit: string, harness: string, title: string): Promise<void> {
  m.drafted.value = null;
  m.notDrafted.value = null;
  keeping.value = { project, unit, harness, title };
  const answer = await m.request({ type: 'act', ...offerMessage(project, unit, 'keep_rule') });
  if (answer?.type === 'error') {
    keeping.value = null;
    said.value = String(answer.message);
  }
}

export function KeepDialog() {
  const on = keeping.value;
  const mine = <T extends { project: string; unit: string }>(x: T | null) => (on && x && x.project === on.project && x.unit === on.unit ? x : null);
  const draft = mine(m.drafted.value)?.rule ?? null;
  const failed = mine(m.notDrafted.value)?.why ?? null;
  const [text, setText] = useState('');
  const [share, setShare] = useState(false);
  const close = () => {
    keeping.value = null;
    setText('');
    setShare(false);
  };
  const cancel = () => {
    if (on) void m.request({ type: 'act', act: 'drop_draft', project: on.project, unit: on.unit });
    close();
  };
  useEffect(() => {
    if (draft && !text.trim()) setText(draft.rule);
  }, [draft?.rule]);
  useLayoutEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && cancel();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [on?.unit]);
  if (!on) return null;
  const save = async () => {
    // Emptied: say why rather than draw Save disabled.
    if (!text.trim()) return void (said.value = w('dialog.keep_rule.empty'));
    const answer = await m.request({ type: 'act', ...keepMessage(on.project, on.unit, draft, text, share) });
    close();
    if (answer?.type === 'error') said.value = String(answer.message);
  };
  const named = { harness: on.harness, title: on.title };
  const why = draft ? w('dialog.keep_rule.why') : failed ? fill(`dialog.keep_rule.${failed}`, named) : fill('dialog.keep_rule.writing', named);
  return (
    <div class="pending-bar seal-bar keep-bar" role="dialog" aria-label={w('dialog.keep_rule.title')}>
      <div class="pending-head">
        <span class="pending-what">{w('dialog.keep_rule.title')}</span>
      </div>
      <span class="pending-why">{why}</span>
      {!draft && !failed && <div class="keep-writing" aria-busy="true"><span /><span /></div>}
      <textarea class="keep-rule" rows={2} value={text} placeholder={w('dialog.keep_rule.placeholder')} aria-label={w('dialog.keep_rule.title')} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
      <div class="sure-chips" role="radiogroup">
        <button type="button" class="sure-chip" role="radio" aria-checked={!share} onClick={() => setShare(false)}>{w('dialog.keep_rule.mine')}</button>
        <button type="button" class="sure-chip" role="radio" aria-checked={share} onClick={() => setShare(true)}>{w('dialog.keep_rule.team')}</button>
      </div>
      <div class="pending-acts">
        <span class="spacer" />
        <button type="button" class="tree-act" onClick={cancel}>{w('act.cancel')}</button>
        <button type="button" class="tree-act tree-act--go" onClick={() => void save()}>{w('dialog.keep_rule.go')}</button>
      </div>
    </div>
  );
}
