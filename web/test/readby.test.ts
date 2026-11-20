// The Eval dialog's Read by: who reads unless the person picks another, what
// it offers, and the act a pick sends.
import { describe, expect, it } from 'vitest';
import { evalAct, named, noteKey, readerOf, readerTitle, readers } from '../src/readby';

const JUDGES = '{harness} reads the whole change against what you asked, and reads again only where it is unsure.';
const starts = [
  { harness: 'claude-code', title: 'Claude Code' },
  { harness: 'codex', title: 'Codex' },
];

describe('Read by', () => {
  it('finds the harness the dialog\'s sentence names', () => {
    expect(named('Codex reads the whole change against what you asked, and reads again only where it is unsure.', JUDGES)).toBe('Codex');
    expect(named('Claude Code + Codex reads the whole change against what you asked, and reads again only where it is unsure.', JUDGES)).toBe('Claude Code + Codex');
    expect(named('Nothing is typed into the agent\'s pane.', JUDGES)).toBeNull();
    expect(named('Codex reads', 'no harness here')).toBeNull();
  });

  it('starts on the harness Settings route Evals to, else the one the dialog names, else the work\'s', () => {
    expect(readerOf('codex', 'Claude Code', starts, 'grok')).toEqual({ harness: 'codex', note: 'settings' });
    expect(readerOf(undefined, 'Claude Code', starts, 'grok')).toEqual({ harness: 'claude-code', note: 'latest' });
    expect(readerOf(undefined, 'codex', starts, 'grok')).toEqual({ harness: 'codex', note: 'latest' });
    expect(readerOf(undefined, 'Claude Code + Codex', starts, 'grok')).toEqual({ harness: 'grok', note: 'latest' });
    expect(readerOf(undefined, null, starts, 'grok')).toEqual({ harness: 'grok', note: 'latest' });
    expect(noteKey('settings')).toBe('dialog.eval.from_settings');
    expect(noteKey('latest')).toBe('dialog.eval.from_work');
  });

  it('offers every harness the project starts, once, with the first one in it', () => {
    expect(readers(['claude-code', 'codex', 'codex'], 'codex')).toEqual(['claude-code', 'codex']);
    expect(readers(['claude-code', 'codex'], 'grok')).toEqual(['grok', 'claude-code', 'codex']);
    expect(readers([], '')).toEqual([]);
  });

  it('shows each harness by its title, and one the project does not start by its name', () => {
    expect(readerTitle('codex', starts)).toBe('Codex');
    expect(readerTitle('claude-code', starts)).toBe('Claude Code');
    expect(readerTitle('grok', starts)).toBe('grok');
  });

  it('names the harness in the act only when it is not the one Eval reads by anyway', () => {
    expect(evalAct('weft', 'ask_1', 'codex', 'codex')).toEqual({ act: 'eval', project: 'weft', unit: 'ask_1' });
    expect(evalAct('weft', 'ask_1', 'claude-code', 'codex')).toEqual({ act: 'eval', project: 'weft', unit: 'ask_1', start: 'claude-code' });
  });
});
