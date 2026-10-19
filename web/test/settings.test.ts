// A machine's switches, as its settings say them.
import { describe, expect, it } from 'vitest';
import { KEYS, machineSwitch, type Settings } from '../src/settings';

const said = (machine: Record<string, unknown>): Settings => ({ machine, project: null, effective: {} });

describe('a machine switch', () => {
  it('is Turbo and Start at login off, and Notifications and Suggestions on, until set', () => {
    for (const s of [undefined, said({})]) {
      expect(machineSwitch(s, 'turbo')).toBe(false);
      expect(machineSwitch(s, 'login')).toBe(false);
      expect(machineSwitch(s, 'notify')).toBe(true);
      expect(machineSwitch(s, 'suggest')).toBe(true);
    }
  });

  it('is what the machine says once it says it', () => {
    const s = said({ turbo: true, notify: false, suggest: false, service: { start_at_login: true } });
    expect(machineSwitch(s, 'turbo')).toBe(true);
    expect(machineSwitch(s, 'login')).toBe(true);
    expect(machineSwitch(s, 'notify')).toBe(false);
    expect(machineSwitch(s, 'suggest')).toBe(false);
  });

  it('is kept where the desktop keeps it', () => {
    expect(KEYS.login).toEqual(['service', 'start_at_login']);
    expect(KEYS.turbo).toEqual(['turbo']);
  });
});

import { ENTRIES, at, differs, shownValue } from '../src/settings';

describe('Workflow and a project\'s own settings', () => {
  const s: Settings = {
    machine: { routing: { eval: 'claude' }, eval: { debate: { harness: 'codex', map: { effort: 'low' } } } },
    project: { routing: { eval: 'codex' } },
    effective: {},
  };
  const titles = [{ project: 'weft', harness: 'claude', title: 'Claude Code' }, { project: 'weft', harness: 'codex', title: 'Codex' }];

  it('reads a setting where it is kept, every project\'s or the project\'s own', () => {
    expect(at(s.machine, ['routing', 'eval'])).toBe('claude');
    expect(at(s.project, ['routing', 'eval'])).toBe('codex');
    expect(at(s.machine, ['eval', 'debate', 'map', 'effort'])).toBe('low');
    expect(at(s.machine, ['routing', 'ask'])).toBeUndefined();
  });

  it('shows a harness by its title, and nothing set by what applies then', () => {
    const ask = ENTRIES.find((e) => e.name === 'Ask')!;
    const runs = ENTRIES.find((e) => e.name === 'Runs in')!;
    const model = ENTRIES.find((e) => e.name === 'Map model')!;
    expect(shownValue(ask, 'claude', titles)).toBe('Claude Code');
    expect(shownValue(ask, undefined, titles)).toBe('desktop.settings.agent_you_are_in');
    expect(shownValue(runs, undefined, titles)).toBe('desktop.settings.where_eval_runs');
    expect(shownValue(model, undefined, titles)).toBe('desktop.settings.own_model');
  });

  it('lists only what a project sets for itself, never Turbo', () => {
    expect(differs(s).map((e) => e.name)).toEqual(['Eval']);
    expect(ENTRIES.some((e) => e.key[0] === 'turbo')).toBe(false);
  });
});

import { domainName, withDeny, withRule } from '../src/settings';

describe('RingFrame, written as RingFrame reads it', () => {
  it('sets a rule\'s field in the list that holds it, and takes an emptied rule out', () => {
    const list = [{ id: 'practice.kiss', enabled: false }];
    expect(withRule(list, 'practice.kiss', 'enabled', true)).toEqual([{ id: 'practice.kiss', enabled: true }]);
    expect(withRule(list, 'practice.yagni', 'tier', 'situational')).toEqual([...list, { id: 'practice.yagni', tier: 'situational' }]);
    expect(withRule(list, 'practice.kiss', null, null)).toBeNull();
    expect(withRule(list, 'practice.kiss', 'enabled', null)).toBeNull();
    expect(withRule([], 'own.1', 'text', 'Say it plainly.')).toEqual([{ id: 'own.1', text: 'Say it plainly.', applies_to: ['implement'], tier: 'situational' }]);
  });

  it('adds and removes a line of what judges must not do; emptied, the list denies nothing', () => {
    expect(withDeny(undefined, '+', 'Push.')).toEqual(['Push.']);
    expect(withDeny(['Push.', 'Delete.'], 0, null)).toEqual(['Delete.']);
    expect(withDeny(['Push.'], 0, null)).toEqual([]);
  });

  it('names a practice in words', () => {
    expect(domainName('autonomous-trading')).toBe('Autonomous trading');
  });
});
