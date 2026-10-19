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
