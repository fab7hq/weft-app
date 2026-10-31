// The bar says the machine's why in sentences, without "Weft will type … into …".
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { use } from '../src/words';
import { why } from '../src/bar';

use(JSON.parse(readFileSync('web/public/words.json', 'utf8')));

describe('the bar', () => {
  it('joins the lines of a why and drops what the header and box show', () => {
    const evaluating = "Weft will type  /rf:eval debate evl_2  into codex.\nWeft has gathered the change. The agent will run RingFrame's\njudging tasks on it; none of the judges did the work.";
    expect(why(evaluating)).toEqual(["Weft has gathered the change. The agent will run RingFrame's judging tasks on it; none of the judges did the work."]);
    const asking = 'Weft will type  /rf:ask  into claude.\nThe agent will ask you which approach to take, in its own pane.';
    expect(why(asking)).toEqual(['The agent will ask you which approach to take, in its own pane.']);
    const waiting = 'This is the exact wording. Weft will not change it.\ncodex asked you about this and never got an answer, so it is still waiting. Sending it records your yes first.';
    expect(why(waiting)).toHaveLength(2);
  });
});

describe('a dialog\'s yes', () => {
  it('is Send, or the button the machine names, amber when it stops something', async () => {
    const { yesOf } = await import('../src/bar');
    use({ 'act.send': 'Send', 'act.eval': 'Eval', 'dialog.stop_eval.go': 'Stop Eval' });
    expect(yesOf({ go: null })).toEqual({ label: 'Send', tone: 'go' });
    expect(yesOf({ go: { word: 'act.eval', warn: false } })).toEqual({ label: 'Eval', tone: 'go' });
    expect(yesOf({ go: { word: 'dialog.stop_eval.go', warn: true } })).toEqual({ label: 'Stop Eval', tone: 'warn' });
  });
});

describe('what Weft reads of a harness\'s setup', () => {
  beforeEach(() => use(JSON.parse(readFileSync('web/public/words.json', 'utf8'))));
  const notSetUp = { key: 'why.not_set_up', harness: 'claude' };
  const cannotAsk = { key: 'why.cannot_ask', harness: 'codex' };
  const project = (ask: { key: string; harness?: string } | null, rows: { agent: string | null; harness: string; ask: { key: string; harness?: string } | null }[] = []) =>
    ({ project: 'weft', ask, agents: { rows } }) as never;

  it('is a warning, never a stop; every other why-not still stops', async () => {
    const { isSetup } = await import('../src/bar');
    expect(isSetup(notSetUp)).toBe(true);
    expect(isSetup(cannotAsk)).toBe(true);
    for (const key of ['why.closed', 'why.composing', 'why.judging', 'why.no_eval', 'why.ended', 'why.elsewhere', 'why.start_an_agent']) expect(isSetup({ key })).toBe(false);
    expect(isSetup(null)).toBe(false);
  });

  it('says where to set a harness up, and that Weft could not ask another', async () => {
    const { sentence } = await import('../src/bar');
    expect(sentence(notSetUp, 'studio')).toBe('claude is not set up for RingFrame. Set it up on studio from ☰ › Updates…');
    expect(sentence(cannotAsk, 'studio')).toBe('Weft could not ask codex whether it is set up.');
    expect(sentence({ key: 'why.closed', title: 'fix login' }, 'studio')).toBe('fix login is closed. Follow up asks again.');
  });

  it('is found for the harness an Ask goes to: its agent\'s row, else the project\'s', async () => {
    const { setupOf } = await import('../src/bar');
    expect(setupOf(project(notSetUp), 'claude')).toEqual(notSetUp);
    expect(setupOf(project(notSetUp), 'codex')).toBeNull();
    expect(setupOf(project(null, [{ agent: 'a1', harness: 'codex', ask: cannotAsk }]), 'codex', 'a1')).toEqual(cannotAsk);
    expect(setupOf(project(null, [{ agent: 'a1', harness: 'codex', ask: cannotAsk }]), 'codex')).toEqual(cannotAsk);
    expect(setupOf(project({ key: 'why.start_an_agent' }), 'claude')).toBeNull();
    expect(setupOf(project(null, [{ agent: 'a1', harness: 'claude', ask: { key: 'why.elsewhere', harness: 'claude' } }]), 'claude', 'a1')).toBeNull();
    expect(setupOf(undefined, 'claude')).toBeNull();
  });

  it('in the Ask sheet is one line: Weft\'s own reading first, else why the machine would not draft it', async () => {
    const { askWarning } = await import('../src/bar');
    expect(askWarning(notSetUp, 'claude has no RingFrame plugin.', 'studio')).toBe('claude is not set up for RingFrame. Set it up on studio from ☰ › Updates…');
    expect(askWarning(null, 'claude has no RingFrame plugin.', 'studio')).toBe('This agent may not take an Ask: claude has no RingFrame plugin.');
    expect(askWarning(null, 'no route here', 'studio')).toBe('This agent may not take an Ask: no route here.');
    expect(askWarning(null, null, 'studio')).toBeNull();
  });
});
